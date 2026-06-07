# SPEC 07 — Tetris (canvas + leaderboard)

> **Status:** Implementado · **Depende de:** 05-asteroids-canvas, 06-games-table-leaderboard · **Fecha:** 2026-06-06
> **Objetivo:** Integrar Tetris como juego canvas en Arcade Vault con leaderboard anónimo.

---

## Scope

**In:**

- `references/started-games/03-tetris/game.js` → adaptar y copiar a `public/games/tetris/game.js`
- `public/games/tetris/game.js` — adaptar: emitir CustomEvents `av:score`, `av:level`,
  `av:gameOver`; exponer `window.TETRIS.pause/resume/restart`; eliminar refs al overlay DOM
  (`#overlay`, `#overlay-title`, `#overlay-score`, `#restart-btn`); mantener `#next-canvas`
  para preview de pieza siguiente.
- `app/_games/tetris/TetrisCanvas.tsx` — NUEVO. Canvas component con forwardRef, Script loader
  y listeners de CustomEvents. Renderiza `<canvas id="board">` y `<canvas id="next-canvas">`.
- `app/_lib/game-engines.ts` — Añadir entrada `tetris: lazy(() => import(...))`.
- Supabase tabla `games` — INSERT fila con metadata de Tetris.

**Out of scope (para specs futuros):**

- Modificar `GamePlayerClient.tsx` — ya es genérico y funciona.
- Modificar `app/api/scores/route.ts` — ya es genérico.
- Modificar `app/_lib/supabase/queries.ts` — ya es genérico.
- RLS en Supabase — se añade en spec de auth.
- Controles táctiles / soporte móvil.
- Tests automatizados.
- Panel admin para gestionar el juego.
- HUD React con preview de pieza siguiente (el `next-canvas` lo gestiona el propio game.js).

---

## Data model

### Fila en tabla `games` (Supabase)

| Campo   | Valor                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`    | `tetris`                                                                                                                                                                             |
| `title` | `TETRIS`                                                                                                                                                                             |
| `short` | `Apila piezas y completa líneas antes de que el tablero se llene.`                                                                                                                   |
| `long`  | `Clásico puzzle de piezas que caen. Rota y posiciona tetrominós para completar líneas horizontales. El nivel sube cada 10 líneas y las piezas caen más rápido. ¿Hasta dónde llegas?` |
| `cat`   | `PUZZLE`                                                                                                                                                                             |
| `cover` | `cover-tetris`                                                                                                                                                                       |
| `color` | `cyan`                                                                                                                                                                               |

### CustomEvents emitidos por `game.js`

| Evento        | `detail`            | Cuándo                                 |
| ------------- | ------------------- | -------------------------------------- |
| `av:score`    | `{ score: number }` | Cada vez que cambia el score           |
| `av:level`    | `{ level: number }` | Cada vez que sube el nivel             |
| `av:gameOver` | `{ score: number }` | Al terminar la partida (tablero lleno) |

> `av:lives` no aplica — Tetris no tiene sistema de vidas.

### window API expuesta por `game.js`

```js
window.TETRIS = { pause(), resume(), restart() }
```

- `pause()` → `cancelAnimationFrame(animId)` + flip `paused = true`
- `resume()` → reinicia `lastTime`, llama `loop()`
- `restart()` → llama `init()`

### `app/_lib/game-engines.ts` (actualizado)

```ts
export const GAME_ENGINES: Partial<
  Record<string, LazyExoticComponent<GameCanvasComponent>>
> = {
  asteroids: lazy(() => import("../_games/asteroids/AsteroidsCanvas")),
  tetris: lazy(() => import("../_games/tetris/TetrisCanvas")),
};
```

---

## Implementation plan

1. **Adaptar `game.js`** — Copiar `references/started-games/03-tetris/game.js` →
   `public/games/tetris/game.js`. Aplicar cuatro cambios:

   a. **Emitir CustomEvents** en los puntos donde el juego actualiza score/level:
   - En `clearLines()` tras actualizar `score`: `window.dispatchEvent(new CustomEvent('av:score', { detail: { score } }))`
   - En `clearLines()` tras actualizar `level`: `window.dispatchEvent(new CustomEvent('av:level', { detail: { level } }))`
   - En `hardDrop()` tras actualizar `score`: `window.dispatchEvent(new CustomEvent('av:score', { detail: { score } }))`
   - En `softDrop()` tras actualizar `score`: `window.dispatchEvent(new CustomEvent('av:score', { detail: { score } }))`

   b. **Emitir `av:gameOver`** en `endGame()` antes de detener el loop:
   `window.dispatchEvent(new CustomEvent('av:gameOver', { detail: { score } }))`

   c. **Eliminar overlay DOM** — Quitar refs a `overlay`, `overlayTitle`, `overlayScore`,
   `restartBtn` y todas sus manipulaciones en `endGame()` y `togglePause()`.
   Mantener intacta la lógica de `paused` en `togglePause()`.

   d. **Exponer `window.TETRIS`** al final del archivo:

   ```js
   window.TETRIS = {
     pause() {
       if (!gameOver && !paused) {
         paused = true;
         cancelAnimationFrame(animId);
       }
     },
     resume() {
       if (!gameOver && paused) {
         paused = false;
         lastTime = performance.now();
         loop(lastTime);
       }
     },
     restart() {
       init();
     },
   };
   ```

   Verificar: abrir con `index.html` local — juego funciona, piezas caen, líneas se limpian.

2. **Crear `app/_games/tetris/TetrisCanvas.tsx`** — Seguir patrón exacto de
   `AsteroidsCanvas.tsx`: `forwardRef`, `useImperativeHandle` hacia `window.TETRIS`,
   `useEffect` con listeners para `av:score`, `av:level`, `av:gameOver`, cleanup que
   elimina listeners y llama `window.TETRIS?.pause()`. Diferencias respecto a Asteroids:
   - Sin `onLives` prop ni listener `av:lives`.
   - Renderiza dos canvas: `<canvas id="board" width={300} height={600} />` y
     `<canvas id="next-canvas" width={120} height={120} />`.
   - `window.TETRIS` en lugar de `window.ASTEROIDS`.

   Verificar: `npx tsc --noEmit` sin errores.

3. **Registrar en `app/_lib/game-engines.ts`** — Añadir entrada:
   `tetris: lazy(() => import("../_games/tetris/TetrisCanvas"))`.
   Verificar: `npx tsc --noEmit` sin errores.

4. **INSERT en Supabase** — Ejecutar SQL:

   ```sql
   INSERT INTO games (id, title, short, long, cat, cover, color)
   VALUES (
     'tetris',
     'TETRIS',
     'Apila piezas y completa líneas antes de que el tablero se llene.',
     'Clásico puzzle de piezas que caen. Rota y posiciona tetrominós para completar líneas horizontales. El nivel sube cada 10 líneas y las piezas caen más rápido. ¿Hasta dónde llegas?',
     'PUZZLE',
     'cover-tetris',
     'cyan'
   );
   ```

   Verificar: fila visible en Supabase dashboard.

5. **`npm run build`** — Build limpio sin errores. Verificar que rutas existentes
   (`/games`, `/games/asteroids/play`, `/hall-of-fame`) no presentan regresiones.

---

## Acceptance criteria

- [ ] Fila `tetris` presente en tabla `games` de Supabase.
- [ ] `/games` muestra card de TETRIS con datos desde Supabase.
- [ ] `/games/tetris` muestra info del juego + strip top-5 scores (vacío si no hay scores).
- [ ] `/games/tetris/play` carga sin errores de SSR ni TypeScript.
- [ ] Canvas renderiza el tablero y es jugable con teclado (flechas, espacio, X).
- [ ] Preview de pieza siguiente visible en `next-canvas`.
- [ ] HUD React refleja en tiempo real score y nivel del canvas.
- [ ] Botón "PAUSA" congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al terminar la partida (tablero lleno), aparece modal React con puntuación final.
- [ ] Overlay DOM interno (`#overlay`) eliminado — no aparece en pantalla al hacer game over.
- [ ] Input nickname + botón "Publicar score" funciona; score aparece en `/hall-of-fame`.
- [ ] Nickname vacío o > 20 chars → validación impide submit.
- [ ] `npm run build` limpio. Rutas existentes sin regresiones.

---

## Decisions

- **Sí:** Fuente `references/started-games/03-tetris/game.js`. Implementación completa
  y funcional — menos trabajo que desde cero.

- **Sí:** `av:score` y `av:level` — aplican. `av:lives` omitido porque Tetris no tiene
  sistema de vidas; el juego termina cuando el tablero se llena.

- **Sí:** `pause()` implementado con `cancelAnimationFrame(animId)` + flag `paused`.
  El game loop original ya respeta `paused` en `togglePause()`; se reutiliza esa lógica.
  `resume()` reinicia `lastTime` antes de llamar `loop()` para evitar delta-time gigante
  tras una pausa larga.

- **Sí:** Mantener `<canvas id="next-canvas">` en `TetrisCanvas.tsx`. El game.js lo
  gestiona directamente; no requiere lógica adicional en React.

- **Sí:** Eliminar overlay DOM (`#overlay`, `#overlay-title`, `#overlay-score`,
  `#restart-btn`) del adapted game.js. El modal React reemplaza esa responsabilidad.

- **Sí:** `cover-tetris` como clase CSS nueva. Pendiente de diseño; no bloquea
  integración funcional.

- **No:** `av:lives` en el spec. Tetris no tiene vidas — añadirlo sería ficticio.

- **No:** HUD React con preview de pieza siguiente. El `next-canvas` ya cumple esa
  función visualmente; duplicarlo en React añade complejidad sin beneficio.

---

## Risks

| Riesgo                                                                                                                                                                                      | Mitigación                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `window.TETRIS` coexiste con `window.ASTEROIDS` en memoria si el usuario navega entre juegos sin recargar. Cleanup del `useEffect` llama `pause()` al desmontar — no hay colisión de loops. | Cleanup en `TetrisCanvas.tsx` garantiza que el loop se detiene al desmontar.                                |
| Canvas fijo `300×600` puede quedar pequeño en pantallas <400px.                                                                                                                             | CSS `aspect-ratio: 300/600` + `width: 100%` — fuera de scope; mitigación cosmética suficiente para desktop. |
| `#board` y `#next-canvas` son IDs globales. Si dos instancias de `TetrisCanvas` montaran simultáneamente, colisionarían.                                                                    | `GamePlayerClient` renderiza una sola instancia; no hay riesgo en el flujo actual.                          |

---

## What is **not** in this spec

- Controles táctiles / soporte móvil.
- HUD React con preview de pieza siguiente.
- RLS en Supabase.
- Panel admin para gestionar juegos.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
