# SPEC — PONG: Dificultad progresiva y comportamiento de IA

> **Estado:** Propuesto
> **Depende de:** 06-games-table-leaderboard-supabase, specs/game-jam/pong/01-pong-core.md
> **Fecha:** 2026-06-07
> **Objetivo:** Añadir dificultad progresiva al motor de PONG — velocidad de pelota creciente, IA adaptativa por marcador, evento `av:level` y efecto visual de aceleración — sin modificar la integración Supabase ni el wrapper React.

---

## Scope

**In:**

- `public/games/pong/game.js` — modificar el motor core para:
  - Emitir `av:level { level }` cuando la velocidad escala de tramo.
  - Aumentar la velocidad de la pelota (`SPEED_FACTOR`) tras cada rally completado.
  - Ajustar `AI_SPEED` dinámicamente en función del nivel actual.
  - Añadir efecto visual de "flash" en la pelota al impactar una pala (destello amarillo).
  - Clamp de velocidad máxima para que el juego sea difícil pero no injugable.
- `app/_games/pong/PongCanvas.tsx` — añadir listener `av:level` → `onLevelChange(e.detail.level)`.

**Fuera de alcance:**

- Modificar la integración Supabase — la fila `games` y la tabla `scores` no cambian.
- Modificar `GamePlayerClient.tsx`, `api/scores/route.ts` o `supabase/queries.ts`.
- Cambiar el `WINNING_SCORE` (sigue siendo 7).
- Modo 2 jugadores.
- Controles táctiles / soporte móvil.
- Realtime en leaderboard.
- Supabase Auth / RLS.
- Tests automatizados.
- Efectos de sonido (van en spec separado si se piden).
- Persistencia de dificultad entre sesiones (localStorage).
- Selector de dificultad manual — la dificultad es siempre automática y progresiva.

---

## Data model

### Constantes de dificultad en `game.js`

```js
// Velocidad base de la pelota (módulo del vector velocidad inicial)
const BASE_SPEED = 5; // px/frame

// Incremento de velocidad por rally completado (punto anotado por cualquiera)
const SPEED_INCREMENT = 0.25; // px/frame por rally

// Velocidad máxima de la pelota
const MAX_SPEED = 12; // px/frame

// Velocidad base de la IA en nivel 1
const AI_BASE_SPEED = 4; // px/frame

// Incremento de velocidad de la IA por nivel
const AI_SPEED_INCREMENT = 0.6; // px/frame por nivel

// Velocidad máxima de la IA
const AI_MAX_SPEED = 9; // px/frame

// Umbrales de rally para subir de nivel (nivel = tramo de rallies)
// Nivel 1: rallies  0–3   (velocidad base)
// Nivel 2: rallies  4–7
// Nivel 3: rallies  8–11
// Nivel 4: rallies 12–15
// Nivel 5: rallies 16+    (velocidad máxima)
const LEVEL_THRESHOLDS = [0, 4, 8, 12, 16];
```

### Estado adicional en `game.js`

```js
let rallies = 0; // total de puntos anotados en la partida (jugador + IA)
let currentLevel = 1; // nivel de dificultad actual (1–5)
let speedFactor = BASE_SPEED; // velocidad escalar actual de la pelota
let ballFlash = 0; // frames restantes de destello amarillo en la pelota
```

### CustomEvent añadido

| Evento     | `detail`            | Cuándo                                                      |
| ---------- | ------------------- | ----------------------------------------------------------- |
| `av:level` | `{ level: number }` | Cuando `currentLevel` sube al completar un tramo de rallies |

> Este spec añade `av:level` al motor existente. Los eventos `av:score` y `av:gameOver` del spec 01 no cambian.

---

## Implementation plan

1. **Añadir constantes de dificultad a `public/games/pong/game.js`** — Insertar el bloque de constantes (`BASE_SPEED`, `SPEED_INCREMENT`, `MAX_SPEED`, `AI_BASE_SPEED`, `AI_SPEED_INCREMENT`, `AI_MAX_SPEED`, `LEVEL_THRESHOLDS`) al inicio del archivo, justo después de las constantes geométricas (`WIDTH`, `HEIGHT`, `PADDLE_W`, `PADDLE_H`, `BALL_SIZE`, `WINNING_SCORE`, `PADDLE_SPEED`).

   Verificar: el archivo parsea sin errores sintácticos (`node --check public/games/pong/game.js`).

2. **Añadir variables de estado de dificultad** — Insertar `rallies`, `currentLevel`, `speedFactor`, `ballFlash` junto al resto de variables de estado. Incluirlas en `resetState()`:

   ```js
   function resetState() {
     // ... código existente ...
     rallies = 0;
     currentLevel = 1;
     speedFactor = BASE_SPEED;
     ballFlash = 0;
   }
   ```

   Verificar: `resetState()` restaura todos los valores al reiniciar.

3. **Modificar `serveBall()` para usar `speedFactor`** — Reemplazar la asignación de velocidad fija por:

   ```js
   function serveBall(towardPlayer) {
     ball.x = WIDTH / 2;
     ball.y = HEIGHT / 2;
     const angle = (Math.random() * 40 - 20) * (Math.PI / 180); // ±20°
     const dirX = towardPlayer ? -1 : 1;
     ball.vx = dirX * speedFactor * Math.cos(angle);
     ball.vy = speedFactor * Math.sin(angle);
   }
   ```

   > Ángulo aleatorio ±20° evita pelota perfectamente horizontal, que sería injugable a alta velocidad.

   Verificar: la pelota sale en la dirección correcta tras cada punto.

4. **Crear `applyDifficultyAfterRally()`** — Nueva función llamada cada vez que se anota un punto (antes de `serveBall()`):

   ```js
   function applyDifficultyAfterRally() {
     rallies++;

     // Aumentar velocidad de la pelota
     speedFactor = Math.min(MAX_SPEED, BASE_SPEED + rallies * SPEED_INCREMENT);

     // Comprobar si sube de nivel
     let newLevel = 1;
     for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
       if (rallies >= LEVEL_THRESHOLDS[i]) {
         newLevel = i + 1;
         break;
       }
     }
     if (newLevel !== currentLevel) {
       currentLevel = newLevel;
       window.dispatchEvent(
         new CustomEvent("av:level", { detail: { level: currentLevel } })
       );
     }
   }
   ```

   Verificar: con `rallies = 4` el nivel pasa a 2 y se emite `av:level { level: 2 }`.

5. **Integrar `applyDifficultyAfterRally()` en `update()`** — Localizar el bloque de detección de punto en `update()`. Añadir la llamada antes de `serveBall()`:

   ```js
   // Punto para la IA
   if (ball.x < 0) {
     aiScore++;
     applyDifficultyAfterRally();
     if (aiScore >= WINNING_SCORE) {
       triggerGameOver();
       return;
     }
     serveBall(false); // sirve hacia el jugador
   }

   // Punto para el jugador
   if (ball.x > WIDTH) {
     playerScore++;
     window.dispatchEvent(
       new CustomEvent("av:score", { detail: { score: playerScore } })
     );
     applyDifficultyAfterRally();
     if (playerScore >= WINNING_SCORE) {
       triggerGameOver();
       return;
     }
     serveBall(true); // sirve hacia la IA
   }
   ```

   Verificar: el contador de rallies sube en ambos casos (punto jugador y punto IA).

6. **Ajustar velocidad de la IA por nivel en `update()`** — Reemplazar el movimiento de IA con:

   ```js
   const aiSpeed = Math.min(
     AI_MAX_SPEED,
     AI_BASE_SPEED + (currentLevel - 1) * AI_SPEED_INCREMENT
   );
   const aiTarget = ball.y - PADDLE_H / 2;
   if (ai.y < aiTarget) ai.y = Math.min(ai.y + aiSpeed, aiTarget);
   if (ai.y > aiTarget) ai.y = Math.max(ai.y - aiSpeed, aiTarget);
   ai.y = Math.max(0, Math.min(HEIGHT - PADDLE_H, ai.y));
   ```

   Verificar: en nivel 1 la IA se mueve a 4 px/frame; en nivel 5 a 6.4 px/frame (debajo de `AI_MAX_SPEED = 9`).

7. **Activar `ballFlash` al colisionar con cualquier pala** — En los bloques de colisión pelota–pala (jugador e IA):

   ```js
   // Al final del bloque de colisión con pala del jugador:
   ballFlash = 6; // frames de destello

   // Al final del bloque de colisión con pala de la IA:
   ballFlash = 6;
   ```

   Verificar: `ballFlash` se activa en colisión con ambas palas.

8. **Renderizar destello en `draw()`** — Localizar el bloque de dibujo de la pelota. Modificar para usar color dinámico:

   ```js
   if (ballFlash > 0) {
     ctx.fillStyle = "#facc15"; // yellow-400 de Tailwind (color de la card del juego)
     ballFlash--;
   } else {
     ctx.fillStyle = "#ffffff";
   }
   ctx.fillRect(ball.x, ball.y, BALL_SIZE, BALL_SIZE);
   ```

   Verificar: la pelota destella en amarillo durante ~6 frames (~100ms a 60fps) tras cada impacto.

9. **Actualizar `app/_games/pong/PongCanvas.tsx`** — Añadir listener `av:level`:

   ```ts
   const onLevel = (e: Event) => onLevelChange((e as CustomEvent).detail.level);
   window.addEventListener("av:level", onLevel);

   // En el return de cleanup:
   window.removeEventListener("av:level", onLevel);
   ```

   Verificar: `npx tsc --noEmit` sin errores.

10. **`npm run build`** — Build limpio sin errores. Verificar que `/games/pong/play` sigue cargando y jugando correctamente con el sistema de dificultad activo.

---

## Acceptance criteria

- [ ] La pelota arranca con velocidad módulo 5 px/frame en el rally 0.
- [ ] Tras cada rally completado (punto de cualquier contendiente), la velocidad de la pelota aumenta 0.25 px/frame.
- [ ] La velocidad de la pelota nunca supera 12 px/frame (clamp `MAX_SPEED`).
- [ ] Al alcanzar rally 4, se emite `av:level { level: 2 }` y el HUD React refleja "Nivel 2".
- [ ] Al alcanzar rally 8, se emite `av:level { level: 3 }` y el HUD React refleja "Nivel 3".
- [ ] Al alcanzar rally 12, se emite `av:level { level: 4 }`.
- [ ] Al alcanzar rally 16, se emite `av:level { level: 5 }`.
- [ ] `av:level` solo se emite cuando el nivel efectivamente cambia, no en cada rally.
- [ ] La velocidad de la IA en nivel 1 es 4 px/frame; en nivel 5 es 6.4 px/frame.
- [ ] La velocidad de la IA nunca supera 9 px/frame (clamp `AI_MAX_SPEED`).
- [ ] La pelota destella en amarillo (#facc15) durante ~6 frames tras impactar cualquier pala.
- [ ] Al reiniciar (`window.PONG.restart()`), `rallies`, `currentLevel`, `speedFactor` y `ballFlash` se resetean a sus valores iniciales.
- [ ] `npx tsc --noEmit` sin errores tras modificar `PongCanvas.tsx`.
- [ ] `npm run build` limpio. Rutas existentes sin regresiones.

---

## Decisions

- **Sí: Velocidad progresiva por rally, no por nivel.** La granularidad por rally (0.25 px/frame) produce una curva suave y continua. Por nivel (saltos bruscos cada 4 rallies) produciría una sensación escalada artificial; el jugador nota el aumento progresivo como resultado de su propio juego.

- **Sí: 5 niveles con umbral cada 4 rallies.** Una partida típica tiene 7–14 rallies (marcador final 7–x con x entre 0 y 6). Los 5 niveles cubren el rango completo sin que el jugador se quede en el primer nivel toda la partida.

- **Sí: `av:level` solo al cambiar de nivel.** Emitirlo en cada rally saturaría el HUD React con actualizaciones insignificantes. El nivel es un indicador discreto, no continuo.

- **Sí: IA adaptativa por nivel, no por speedFactor.** La IA sigue la pelota por posición, no por velocidad; vincularla a `speedFactor` haría la IA imposible de vencer en niveles altos. La escala separada (`AI_BASE_SPEED + nivel × AI_SPEED_INCREMENT`) permite calibrar la dificultad independientemente.

- **Sí: `AI_MAX_SPEED = 9` vs `MAX_SPEED = 12`.** La pelota siempre puede superar a la IA en velocidad a niveles altos, manteniendo el juego ganables. Si la IA igualara la velocidad máxima de la pelota, la partida se volvería arbitraria.

- **Sí: `serveBall()` con ángulo ±20°.** A velocidades altas (nivel 4–5), una pelota perfectamente horizontal es casi invisible y hace el juego injugable. El ángulo mínimo garantiza que la pelota siempre tenga componente vertical visible.

- **Sí: Flash amarillo (#facc15) al impactar pala.** Feedback visual inmediato sin sonido (el sonido va en spec separado). El amarillo es el color del juego en la plataforma — coherencia visual con la card en `/games`.

- **Sí: `ballFlash = 6` frames (~100ms a 60fps).** Suficiente para ser visible, demasiado corto para ser molesto. No afecta la legibilidad del estado de la pelota.

- **No: Selector de dificultad manual.** Contra el diseño de la plataforma — todos los juegos tienen dificultad implícita progresiva. Un selector requeriría UI adicional en `GamePlayerClient` que no existe.

- **No: Persistencia de dificultad en localStorage.** La dificultad es un estado de partida, no una preferencia del usuario. Cada partida nueva comienza en nivel 1.

- **No: Controles táctiles / mobile.** Fuera de alcance global de la plataforma.

- **No: Supabase Auth / RLS.** Fuera de alcance global de la plataforma.

- **No: Realtime en leaderboard.** Fuera de alcance global de la plataforma.
