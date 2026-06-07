# SPEC 08 — Arkanoid (canvas + leaderboard)

> **Status:** Implemented · **Depende de:** 05-asteroids-canvas, 06-games-table-leaderboard · **Fecha:** 2026-06-06
> **Objetivo:** Integrar Arkanoid como juego canvas en Arcade Vault con leaderboard anónimo.

---

## Scope

**In:**

- `references/started-games/04-arkanoid/game.js` → adaptar y copiar a `public/games/arkanoid/game.js`
- `public/games/arkanoid/game.js` — adaptar: (a) emitir CustomEvents `av:score`, `av:lives`,
  `av:level`, `av:gameOver`; (b) exponer `window.ARKANOID.pause/resume/restart`; (c) eliminar
  overlays canvas `drawOverlay()` y `drawLevelCompleteOverlay()`; (d) cambiar
  `getElementById('game')` → `getElementById('av-canvas')`; (e) remover referencia a
  `#btn-mute`; (f) almacenar `rafId` para permitir `cancelAnimationFrame` en pause.
- `public/games/arkanoid/assets/` — copiar desde `references/started-games/04-arkanoid/assets/`:
  `spritesheet.js`, `spritesheet-breakout.png`, `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`.
- `app/_games/arkanoid/ArkanoidCanvas.tsx` — NUEVO. Canvas component con `forwardRef`, Script
  loaders (primero `spritesheet.js`, luego `game.js`) y listeners de CustomEvents.
- `app/_lib/game-engines.ts` — Añadir entrada `arkanoid: lazy(() => import(...))`.
- Supabase tabla `games` — INSERT fila con metadata de Arkanoid.

**Out of scope (para specs futuros):**

- Modificar `GamePlayerClient.tsx` — ya es genérico y funciona.
- Modificar `app/api/scores/route.ts` — ya es genérico.
- Modificar `app/_lib/supabase/queries.ts` — ya es genérico.
- Botón mute / control de sonido en HUD React.
- RLS en Supabase — se añade en spec de auth.
- Controles táctiles / soporte móvil.
- Tests automatizados.
- Panel admin para gestionar juegos.

---

## Data model

### Fila en tabla `games` (Supabase)

| Campo   | Valor                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`    | `arkanoid`                                                                                                                                                                                             |
| `title` | `ARKANOID`                                                                                                                                                                                             |
| `short` | `Rompe todos los bloques sin dejar caer la bola.`                                                                                                                                                      |
| `long`  | `Clásico de acción donde debes destruir todos los bloques con la bola rebotando en el paddle. 3 niveles con bloques más rápidos y configuraciones distintas. Pierde las 3 vidas y la partida termina.` |
| `cat`   | `ARCADE`                                                                                                                                                                                               |
| `cover` | `cover-arkanoid`                                                                                                                                                                                       |
| `color` | `magenta`                                                                                                                                                                                              |

### CustomEvents emitidos por `game.js`

| Evento        | `detail`            | Cuándo                                               |
| ------------- | ------------------- | ---------------------------------------------------- |
| `av:score`    | `{ score: number }` | Cada vez que un bloque se rompe (`game.score += 10`) |
| `av:lives`    | `{ lives: number }` | Cada vez que se pierde una bola (`game.lives -= 1`)  |
| `av:level`    | `{ level: number }` | Al avanzar de nivel en `advanceLevel()`              |
| `av:gameOver` | `{ score: number }` | Al entrar en estado `lost` o `won`                   |

### window API expuesta por `game.js`

```js
window.ARKANOID = { pause(), resume(), restart() }
```

- `pause()` → `cancelAnimationFrame(rafId)` + flag `gamePaused = true`
- `resume()` → `gamePaused = false; rafId = requestAnimationFrame(loop)`
- `restart()` → `resetGame()` + si estaba pausado, llama `loop(performance.now())` para reiniciar el ciclo

Requiere añadir al game.js: `let rafId; let gamePaused = false;` y modificar el loop:

```js
function loop(now) {
  update(now);
  draw(now);
  rafId = requestAnimationFrame(loop);
}
```

---

## Implementation plan

0. **Copiar assets** — Copiar `references/started-games/04-arkanoid/assets/` →
   `public/games/arkanoid/assets/` (incluye `spritesheet.js`, `spritesheet-breakout.png`,
   `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`).
   Verificar: archivos accesibles en `http://localhost:3000/games/arkanoid/assets/spritesheet.js`.

1. **Adaptar `game.js`** — Copiar `references/started-games/04-arkanoid/game.js` →
   `public/games/arkanoid/game.js`. Aplicar siete cambios:

   a. **Canvas ID** — Línea 1: `getElementById('game')` → `getElementById('av-canvas')`.

   b. **Loop con rafId** — Añadir `let rafId; let gamePaused = false;` tras `let explosions = [];`.
   Modificar el loop:

   ```js
   function loop(now) {
     update(now);
     draw(now);
     rafId = requestAnimationFrame(loop);
   }
   ```

   c. **Emitir `av:score`** — Tras `game.score += 10` (en colisión con bloques):

   ```js
   window.dispatchEvent(
     new CustomEvent("av:score", { detail: { score: game.score } })
   );
   ```

   d. **Emitir `av:lives`** — Tras `game.lives -= 1` (bola perdida):

   ```js
   window.dispatchEvent(
     new CustomEvent("av:lives", { detail: { lives: game.lives } })
   );
   ```

   e. **Emitir `av:level`** — En `advanceLevel()`, tras `game.level++`:

   ```js
   window.dispatchEvent(
     new CustomEvent("av:level", { detail: { level: game.level + 1 } })
   );
   ```

   f. **Emitir `av:gameOver`** — Tras asignar `game.state = 'lost'` y tras asignar
   `game.state = 'won'` (en la comprobación de bloques):

   ```js
   window.dispatchEvent(
     new CustomEvent("av:gameOver", { detail: { score: game.score } })
   );
   ```

   g. **Eliminar overlays canvas** — Remover `drawOverlay()` y `drawLevelCompleteOverlay()`
   y sus llamadas en `draw()`. El modal React reemplaza esa responsabilidad.

   h. **Remover `#btn-mute`** — Eliminar el bloque `document.getElementById('btn-mute').addEventListener(...)`.

   i. **`primaryAction` sin restart** — En `primaryAction()`, eliminar el caso
   `won`/`lost` → `resetGame()`. El modal React llama `window.ARKANOID.restart()`.
   Mantener `level_complete` → `advanceLevel()` y el caso default → `launchBall()`.

   j. **Exponer `window.ARKANOID`** — Al final del archivo, antes de `loadSpritesheet(...)`:

   ```js
   window.ARKANOID = {
     pause() {
       if (!gamePaused) {
         gamePaused = true;
         cancelAnimationFrame(rafId);
       }
     },
     resume() {
       if (gamePaused) {
         gamePaused = false;
         rafId = requestAnimationFrame(loop);
       }
     },
     restart() {
       gamePaused = false;
       resetGame();
       rafId = requestAnimationFrame(loop);
     },
   };
   ```

   Verificar: abrir `references/started-games/04-arkanoid/index.html` con el game.js
   adaptado — juego funciona, bloques se rompen, vidas disminuyen.

2. **Crear `app/_games/arkanoid/ArkanoidCanvas.tsx`** — Seguir patrón exacto de
   `AsteroidsCanvas.tsx`. Diferencias:
   - `window.ARKANOID` en lugar de `window.ASTEROIDS`.
   - Incluye listener `av:lives` (a diferencia de Tetris).
   - Carga dos scripts en orden: primero `spritesheet.js` (que define globals
     `loadSpritesheet`, `drawSprite`, etc.), luego `game.js`. Usar `script.onload`
     del primer script para inyectar el segundo, garantizando ejecución en orden.
   - Canvas renderiza `<canvas id="av-canvas" width={800} height={600} />`.

   Verificar: `npx tsc --noEmit` sin errores.

3. **Registrar en `app/_lib/game-engines.ts`** — Añadir entrada:
   `arkanoid: lazy(() => import('../_games/arkanoid/ArkanoidCanvas'))`.
   Verificar: `npx tsc --noEmit` sin errores.

4. **INSERT en Supabase** — Ejecutar SQL:

   ```sql
   INSERT INTO games (id, title, short, long, cat, cover, color)
   VALUES (
     'arkanoid',
     'ARKANOID',
     'Rompe todos los bloques sin dejar caer la bola.',
     'Clásico de acción donde debes destruir todos los bloques con la bola rebotando en el paddle. 3 niveles con bloques más rápidos y configuraciones distintas. Pierde las 3 vidas y la partida termina.',
     'ARCADE',
     'cover-arkanoid',
     'magenta'
   );
   ```

   Verificar: fila visible en Supabase dashboard.

5. **`npm run build`** — Build limpio sin errores. Verificar que rutas existentes
   (`/games`, `/games/asteroids/play`, `/games/tetris/play`, `/hall-of-fame`) no presentan
   regresiones.

---

## Acceptance criteria

- [ ] Fila `arkanoid` presente en tabla `games` de Supabase.
- [ ] `/games` muestra card de ARKANOID con datos desde Supabase.
- [ ] `/games/arkanoid` muestra info del juego + strip top-5 scores (vacío si no hay scores).
- [ ] `/games/arkanoid/play` carga sin errores de SSR ni TypeScript.
- [ ] Canvas renderiza el juego y es jugable con mouse y teclado (← →, A D, espacio).
- [ ] Sprites de bloques, paddle y bola se renderizan desde `spritesheet-breakout.png`.
- [ ] Animación de explosión al romper bloques visible.
- [ ] HUD React refleja en tiempo real score, vidas y nivel del canvas.
- [ ] Botón "PAUSA" congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al perder las 3 vidas o completar el nivel 3, aparece modal React con puntuación final.
- [ ] Overlays canvas internos (`drawOverlay`, `drawLevelCompleteOverlay`) eliminados — no aparecen en pantalla.
- [ ] Click/espacio durante `won`/`lost` no reinicia el juego — el modal React controla el restart.
- [ ] Input nickname + botón "Publicar score" funciona; score aparece en `/hall-of-fame`.
- [ ] Nickname vacío o > 20 chars → validación impide submit.
- [ ] `npm run build` limpio. Rutas existentes sin regresiones.

---

## Decisions

- **Sí:** Fuente `references/started-games/04-arkanoid/game.js`. Implementación completa y
  funcional — menos trabajo que desde cero, física de paddle y animaciones ya probadas.

- **Sí:** Los 4 eventos `av:*` aplican. Arkanoid tiene score (por bloque), vidas (3),
  niveles (3) y game over. Ninguno se omite.

- **Sí:** `av:gameOver` se dispara tanto en `lost` (vidas = 0) como en `won` (nivel 3
  completado). Ambos terminan la partida; el modal React no distingue entre victoria y derrota.

- **Sí:** `pause()` implementado con `cancelAnimationFrame(rafId)`. El loop original no
  almacenaba el ID — se añade `let rafId` y se modifica el loop para capturarlo.

- **Sí:** `restart()` llama `resetGame()` y reinicia el loop explícitamente. Necesario
  porque tras `cancelAnimationFrame` el ciclo se detiene; `resetGame()` solo reinicia estado,
  no reactiva el loop.

- **Sí:** Cargar `spritesheet.js` antes de `game.js` vía `script.onload`. Los globals
  `loadSpritesheet`, `drawSprite`, `drawFrame`, `EXPLOSION_FRAMES` deben existir cuando
  `game.js` ejecuta. Sin orden garantizado, el juego falla silenciosamente.

- **Sí:** Canvas con `id="av-canvas"`. Consistente con el patrón de Asteroids; evita
  colisión si algún día dos instancias coexisten en memoria.

- **Sí:** Eliminar `#btn-mute` del game.js adaptado. El elemento no existe en el DOM de
  Arcade Vault; dejar la referencia lanza error en consola al montar el componente.

- **Sí:** `primaryAction` sin manejo de `won`/`lost`. El modal React es el punto único de
  control para restart post game-over; dos rutas de restart crearían estado inconsistente.

- **Sí:** `cover-arkanoid` como clase CSS nueva. Pendiente de diseño; no bloquea
  integración funcional.

- **No:** Botón mute en HUD React. El sonido se gestiona internamente en `game.js`;
  exponer control de mute requiere ampliar la `window.ARKANOID` API — va en spec futuro si
  se necesita.

---

## Risks

| Riesgo                                                                                                                                                                    | Mitigación                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spritesheet.js` define globals en `window`. Si Asteroids o Tetris definen globals con el mismo nombre, colisionan.                                                       | Los globals de spritesheet (`drawSprite`, `loadSpritesheet`, etc.) son nombres específicos del juego — bajo riesgo real. Verificar con `grep` antes de implementar.   |
| Audio requiere interacción del usuario antes de reproducir (política del navegador). Si la bola rebota antes del primer click, `play()` puede lanzar error silencioso.    | El juego arranca en estado `ready` — la bola no se lanza hasta click/espacio. Primera interacción ocurre antes del primer sonido. Sin mitigación adicional necesaria. |
| Canvas fijo 800×600 puede quedar pequeño en pantallas < 900px.                                                                                                            | CSS `aspect-ratio: 800/600` + `width: 100%` — ya aplicado en el canvas del componente. Fuera de scope; suficiente para desktop.                                       |
| `window.ARKANOID` persiste en memoria si el usuario navega entre juegos sin recargar. Cleanup del `useEffect` llama `pause()` al desmontar — loop detenido correctamente. | Cleanup en `ArkanoidCanvas.tsx` garantiza que el loop se detiene y `window.ARKANOID` se elimina al desmontar.                                                         |

---

## What is **not** in this spec

- Botón mute / control de sonido en HUD React.
- Controles táctiles / soporte móvil.
- RLS en Supabase.
- Panel admin para gestionar juegos.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
