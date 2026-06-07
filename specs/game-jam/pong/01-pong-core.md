# SPEC — PONG (canvas core + integración Supabase)

> **Estado:** Propuesto
> **Depende de:** 06-games-table-leaderboard-supabase
> **Fecha:** 2026-06-07
> **Objetivo:** Implementar PONG como juego canvas en Arcade Vault, single-player vs IA, con leaderboard anónimo y categoría VERSUS.

---

## Scope

**In:**

- `public/games/pong/game.js` — NUEVO desde cero. Loop canvas 800×600, lógica de pala del jugador, IA para la pala contraria, física de pelota, sistema de puntuación hasta 7 puntos. Emite CustomEvents `av:score`, `av:gameOver`; expone `window.PONG.pause/resume/restart`.
- `app/_games/pong/PongCanvas.tsx` — NUEVO. Canvas component con `forwardRef`, Script loader y listeners de CustomEvents.
- `app/_lib/game-engines.ts` — Añadir entrada `pong: lazy(() => import(...))`.
- Supabase tabla `games` — INSERT fila con metadata de PONG.

**Fuera de alcance:**

- Modificar `GamePlayerClient.tsx` — ya es genérico y funciona.
- Modificar `app/api/scores/route.ts` — ya es genérico.
- Modificar `app/_lib/supabase/queries.ts` — ya es genérico.
- RLS en Supabase — se añade en spec de auth.
- Controles táctiles / soporte móvil.
- Realtime en leaderboard.
- Tests automatizados.
- Panel admin para gestionar juegos.
- Modo 2 jugadores (multijugador local o en red).
- `av:lives` y `av:level` — PONG no tiene vidas ni niveles en el core; la dificultad progresiva va en el spec 02.
- Efectos de sonido.
- Partículas o animaciones de impacto.

---

## Data model

### Fila en tabla `games` (Supabase)

| Campo   | Valor                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | `pong`                                                                                                                                                                          |
| `title` | `PONG`                                                                                                                                                                          |
| `short` | `Golpea la bola y anota 7 puntos antes que la IA.`                                                                                                                              |
| `long`  | `El clásico de 1972 ahora en modo un jugador. Controla tu pala con el ratón o el teclado y devuelve la bola antes de que cruce tu línea. La IA no perdona — cada rally cuenta.` |
| `cat`   | `VERSUS`                                                                                                                                                                        |
| `cover` | `cover-pong`                                                                                                                                                                    |
| `color` | `yellow`                                                                                                                                                                        |

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'pong',
  'PONG',
  'Golpea la bola y anota 7 puntos antes que la IA.',
  'El clásico de 1972 ahora en modo un jugador. Controla tu pala con el ratón o el teclado y devuelve la bola antes de que cruce tu línea. La IA no perdona — cada rally cuenta.',
  'VERSUS',
  'cover-pong',
  'yellow'
);
```

### CustomEvents emitidos por `game.js`

| Evento        | `detail`            | Cuándo                                                                  |
| ------------- | ------------------- | ----------------------------------------------------------------------- |
| `av:score`    | `{ score: number }` | Cada vez que el jugador anota un punto (score del jugador, no de la IA) |
| `av:gameOver` | `{ score: number }` | Al alcanzar 7 puntos cualquiera de los dos contendientes                |

> `av:lives` no aplica — PONG no tiene vidas; un punto perdido reduce el marcador rival, no una vida.
> `av:level` no aplica en el core — la dificultad progresiva se gestiona en el spec 02.

### window API expuesta por `game.js`

```js
window.PONG = { pause(), resume(), restart() }
```

- `pause()` → `cancelAnimationFrame(rafId)` + flag `paused = true`
- `resume()` → `paused = false; lastTime = performance.now(); rafId = requestAnimationFrame(loop)`
- `restart()` → reinicia estado completo + `rafId = requestAnimationFrame(loop)`

### Estado interno de `game.js`

```js
// Canvas
const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_SIZE = 10;
const WINNING_SCORE = 7;
const PADDLE_SPEED = 6; // px/frame para control por teclado

// Estado de la pelota
let ball = { x, y, vx, vy }; // velocidad inicial ±5px por frame

// Palas
let player = { y }; // pala izquierda, centrada al inicio
let ai = { y }; // pala derecha

// Marcador
let playerScore = 0;
let aiScore = 0;

// Control
let upPressed = false;
let downPressed = false;
let mouseMoved = false; // true si se usó ratón en la sesión actual

// Loop
let paused = false;
let gameOver = false;
let rafId;
let lastTime = 0;
```

### Interface TypeScript del componente wrapper

```ts
interface PongGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

> `onLivesChange` y `onLevelChange` se reciben por contrato del wrapper genérico pero nunca se invocan en el core; quedan disponibles para el spec 02.

---

## Implementation plan

1. **Crear `public/games/pong/game.js`** desde cero.

   a. **Canvas** — Obtener `getElementById('av-canvas')`. Canvas fijo 800×600 (ya declarado en el wrapper). Rellenar fondo negro en cada frame.

   b. **Estado inicial** — Función `resetState()` que:
   - Centra la pelota en `(WIDTH/2, HEIGHT/2)`.
   - Asigna velocidad inicial aleatoria: `vx = (Math.random() > 0.5 ? 1 : -1) * 5`, `vy = (Math.random() * 4 - 2)`.
   - Centra ambas palas verticalmente.
   - Pone `playerScore = 0`, `aiScore = 0`, `gameOver = false`, `paused = false`.

   c. **Input** — Dos modos simultáneos:
   - **Teclado:** listeners `keydown`/`keyup` para `ArrowUp`/`ArrowDown` y `w`/`s` (case-insensitive). Actualizan `upPressed`/`downPressed`.
   - **Ratón:** listener `mousemove` sobre el canvas (coordenada `clientY` → `offsetY`). Mueve `player.y` directo a `offsetY - PADDLE_H/2`, clipeado dentro del canvas.
   - Precedencia: si en el frame actual `mouseMoved === true`, se usa ratón; si no, teclado. `mouseMoved` se resetea a `false` al inicio de cada frame de update.

   d. **Loop** — `requestAnimationFrame` con delta-time. Cada frame:
   - Si `paused` o `gameOver` → solo `draw()`, no `update()`.
   - `update()`: mover pelota, mover pala jugador, mover IA, detectar colisiones, detectar punto.
   - `draw()`: render completo.

   e. **`update()`**:
   - Mover pelota: `ball.x += ball.vx; ball.y += ball.vy`.
   - Rebotar en bordes superior/inferior: si `ball.y <= 0` o `ball.y + BALL_SIZE >= HEIGHT`, invertir `ball.vy`.
   - Mover pala jugador: según teclado (`upPressed` → `player.y -= PADDLE_SPEED`, `downPressed` → `player.y += PADDLE_SPEED`) o ratón. Clipear `player.y` en `[0, HEIGHT - PADDLE_H]`.
   - Mover IA: `ai.y` se mueve hacia `ball.y - PADDLE_H/2` con velocidad `AI_SPEED` (constante `4` px/frame en el core; el spec 02 la hace variable). Clipear en `[0, HEIGHT - PADDLE_H]`.
   - **Colisión pelota–pala jugador:** AABB entre pelota y rectángulo de `player`. Al colisionar: `ball.vx = Math.abs(ball.vx)` (siempre hacia la derecha), ajustar `ball.vy` según offset del impacto respecto al centro de la pala (`impact = (ball.y + BALL_SIZE/2) - (player.y + PADDLE_H/2)`, `ball.vy = impact * 0.25`). Clamp `ball.vy` en `[-6, 6]`.
   - **Colisión pelota–pala IA:** AABB simétricamente. `ball.vx = -Math.abs(ball.vx)`.
   - **Punto:** si `ball.x < 0` → `aiScore++`, respawn. Si `ball.x > WIDTH` → `playerScore++`, dispara `av:score { score: playerScore }`, respawn.
   - **Respawn** tras punto: llama `serveBall()`. Si cualquier score alcanza `WINNING_SCORE` → llama `triggerGameOver()`.

   f. **`serveBall()`** — Resetea posición de la pelota al centro. Velocidad nueva: `vx = ±5` (sirve hacia el último que perdió el punto), `vy` aleatorio `[-3, 3]`.

   g. **`triggerGameOver()`** — `gameOver = true; cancelAnimationFrame(rafId); window.dispatchEvent(new CustomEvent('av:gameOver', { detail: { score: playerScore } }))`.
   - El `score` reportado es siempre el del jugador (entero 0–7), que es el valor rankeable en el leaderboard.

   h. **`draw()`**:
   - Fondo negro `#000`.
   - Línea central punteada (guiones de `HEIGHT/20` px con gap igual, color `rgba(255,255,255,0.3)`).
   - Marcadores numéricos: `playerScore` a `WIDTH*0.25`, `aiScore` a `WIDTH*0.75`, fuente `monospace 48px`, color `rgba(255,255,255,0.7)`.
   - Palas: rectángulos blancos `PADDLE_W × PADDLE_H`, radio de esquinas `4px` (`roundRect`). Pala jugador en `x=20`, IA en `x=WIDTH-20-PADDLE_W`.
   - Pelota: cuadrado blanco `BALL_SIZE × BALL_SIZE`.
   - Sin overlay de game over — el modal React lo gestiona.

   i. **`window.PONG`** — Al final del archivo:

   ```js
   window.PONG = {
     pause() {
       if (!gameOver && !paused) {
         paused = true;
         cancelAnimationFrame(rafId);
       }
     },
     resume() {
       if (!gameOver && paused) {
         paused = false;
         lastTime = performance.now();
         rafId = requestAnimationFrame(loop);
       }
     },
     restart() {
       resetState();
       lastTime = performance.now();
       rafId = requestAnimationFrame(loop);
     },
   };
   ```

   j. **Arrancar el juego** — Llamar `resetState()` y después `rafId = requestAnimationFrame(loop)`.

   Verificar: abrir con un `index.html` local que contenga `<canvas id="av-canvas" width="800" height="600">` — juego carga, pelota rebota, IA responde, marcadores suben.

2. **Crear `app/_games/pong/PongCanvas.tsx`** — Seguir patrón exacto de `AsteroidsCanvas.tsx`. Diferencias:
   - `window.PONG` en lugar de `window.ASTEROIDS`.
   - Sin listeners `av:lives` ni `av:level` (el core no los emite).
   - Solo listener `av:score` → `onScoreChange(e.detail.score)`.
   - Solo listener `av:gameOver` → `onGameOver(e.detail.score)`.
   - Canvas: `<canvas id="av-canvas" width={800} height={600} style={{ display: 'block', width: '100%', aspectRatio: '800/600' }} />`.
   - Cleanup en el `return` del `useEffect`: remover listeners `av:score` y `av:gameOver`, llamar `window.PONG?.pause()`, eliminar `window.PONG`, remover el script del DOM.

   ```tsx
   "use client";

   import { forwardRef, useEffect, useImperativeHandle } from "react";

   export interface PongCanvasHandle {
     pause: () => void;
     resume: () => void;
     restart: () => void;
   }

   interface PongGameProps {
     paused: boolean;
     onScoreChange: (score: number) => void;
     onLivesChange: (lives: number) => void;
     onLevelChange: (level: number) => void;
     onGameOver: (finalScore: number) => void;
   }

   const PongCanvas = forwardRef<PongCanvasHandle, PongGameProps>(
     (
       { paused, onScoreChange, onLivesChange, onLevelChange, onGameOver },
       ref
     ) => {
       useImperativeHandle(ref, () => ({
         pause: () => window.PONG?.pause(),
         resume: () => window.PONG?.resume(),
         restart: () => window.PONG?.restart(),
       }));

       useEffect(() => {
         const onScore = (e: Event) =>
           onScoreChange((e as CustomEvent).detail.score);
         const onGameOverE = (e: Event) =>
           onGameOver((e as CustomEvent).detail.score);

         window.addEventListener("av:score", onScore);
         window.addEventListener("av:gameOver", onGameOverE);

         const script = document.createElement("script");
         script.src = "/games/pong/game.js";
         document.body.appendChild(script);

         return () => {
           window.removeEventListener("av:score", onScore);
           window.removeEventListener("av:gameOver", onGameOverE);
           window.PONG?.pause();
           delete (window as any).PONG;
           script.remove();
         };
       }, []);

       useEffect(() => {
         if (paused) window.PONG?.pause();
         else window.PONG?.resume();
       }, [paused]);

       return (
         <canvas
           id="av-canvas"
           width={800}
           height={600}
           style={{ display: "block", width: "100%", aspectRatio: "800/600" }}
         />
       );
     }
   );

   PongCanvas.displayName = "PongCanvas";
   export default PongCanvas;
   ```

   Verificar: `npx tsc --noEmit` sin errores.

3. **Registrar en `app/_lib/game-engines.ts`** — Añadir entrada:
   `pong: lazy(() => import('../_games/pong/PongCanvas'))`.
   Verificar: `npx tsc --noEmit` sin errores.

4. **INSERT en Supabase** — Ejecutar el SQL del Data model.
   Verificar: fila visible en Supabase dashboard.

5. **`npm run build`** — Build limpio sin errores. Verificar que rutas existentes (`/games`, `/games/asteroids/play`, `/games/tetris/play`, `/games/arkanoid/play`, `/games/snake/play`, `/hall-of-fame`) no presentan regresiones.

---

## Acceptance criteria

- [ ] Fila `pong` presente en tabla `games` de Supabase con `cat = 'VERSUS'` y `color = 'yellow'`.
- [ ] `/games` muestra card de PONG con datos desde Supabase.
- [ ] `/games/pong` muestra info del juego + strip top-5 scores (vacío si no hay scores).
- [ ] `/games/pong/play` carga sin errores de SSR ni TypeScript.
- [ ] Canvas 800×600 renderiza fondo negro, línea central, palas y pelota.
- [ ] Pelota rebota en bordes superior e inferior.
- [ ] Control por ratón: mover el cursor mueve la pala del jugador con precisión.
- [ ] Control por teclado: `ArrowUp`/`W` sube la pala, `ArrowDown`/`S` la baja.
- [ ] La pala de la IA sigue la pelota con velocidad constante (no teleporta).
- [ ] Al anotar el jugador, `av:score` se dispara y el HUD React refleja el marcador.
- [ ] Al llegar cualquier marcador a 7, `av:gameOver` se dispara con el score del jugador.
- [ ] Modal React aparece con la puntuación final; no hay overlay canvas de game over.
- [ ] Botón "PAUSA" congela el game loop; "REANUDAR" lo reanuda correctamente.
- [ ] Input nickname + botón "Publicar score" funciona; score aparece en `/hall-of-fame`.
- [ ] Nickname vacío o > 20 chars → validación impide submit.
- [ ] Cleanup: desmontar el componente detiene el loop y elimina `window.PONG`.
- [ ] `npm run build` limpio. Rutas existentes sin regresiones.

---

## Decisions

- **Sí: Implementación desde cero.** No existe referencia `started-games/pong`. Los assets son triviales (rectángulos y círculo), lo que hace viable una implementación completa sin fuente externa.

- **Sí: Single-player vs IA.** La plataforma necesita un score numérico individual rankeable. El modo 2 jugadores local no produce un ganador único por sesión sin identificación de jugadores.

- **Sí: Score = puntos del jugador (0–7).** Es el único valor individual, comparable entre sesiones y apto para leaderboard. La IA nunca "puntúa" en el leaderboard.

- **Sí: `av:score` se dispara solo cuando el jugador anota.** El score de la IA no es relevante para el leaderboard; emitirlo confundiría al HUD React.

- **Sí: `av:gameOver` con `score: playerScore`.** Consistente con todos los otros juegos — siempre el score del jugador. Tanto victoria (7–x) como derrota (x–7) terminan la partida.

- **Sí: WINNING_SCORE = 7.** Referencia histórica del Pong coin-op original. Partidas cortas (~2 min) mantienen el juego ágil y el leaderboard competitivo.

- **Sí: Control dual ratón + teclado.** El ratón ofrece la experiencia más auténtica al Pong de salón recreativo; el teclado es accesible sin ratón. No hay conflicto: el frame siempre resuelve con el último dispositivo usado.

- **Sí: IA con velocidad constante `AI_SPEED = 4`.** Suficiente para ser desafiante pero derrotable. La velocidad dinámica por dificultad se especifica en el spec 02.

- **No: `av:lives`.** PONG no tiene vidas — perder un punto no consume una vida; es parte del marcador. Añadirlo sería semánticamente incorrecto.

- **No: `av:level`.** El core no tiene niveles. La progresión de dificultad (velocidad de pelota y IA que aumentan con el marcador) se especifica en el spec 02.

- **No: HUD doble (canvas interno + React externo) para el marcador.** El marcador se dibuja directamente en el canvas (estilo arcade auténtico). El HUD React refleja solo el score del jugador para el leaderboard; no duplica el marcador completo en la UI.

- **No: Overlay canvas de game over.** Consistente con Tetris, Arkanoid y Snake. El modal React es el punto único de control post-partida.

- **No: Controles táctiles / mobile.** Fuera de alcance en todos los juegos de la plataforma.

- **No: Supabase Auth / RLS.** Fuera de alcance global de la plataforma actualmente.

- **No: Realtime en leaderboard.** Fuera de alcance global de la plataforma actualmente.

- **Sí: 0 vidas — mecánica sin sistema de vidas.** `onLivesChange` nunca se invoca. El juego termina por marcador, no por agotamiento de vidas.
