# SPEC 09 — Snake (canvas + leaderboard)

> **Status:** Approved · **Depende de:** 05-asteroids-canvas, 06-games-table-leaderboard · **Fecha:** 2026-06-06
> **Objetivo:** Integrar Snake como juego canvas en Arcade Vault con leaderboard anónimo, usando los sprite assets de frutas incluidos en el repositorio.

---

## Scope

**In:**

- `references/source-assets/snake-assets/fruits.png` + `sprites.js` → copiar a `public/games/snake/assets/`
- `public/games/snake/assets/sprites.js` — ajustar rutas de `sources.fruits` de `'snake-assets/fruits.png'` → `'/games/snake/assets/fruits.png'`
- `public/games/snake/game.js` — NUEVO desde cero. Loop canvas, lógica de serpiente, colisiones, frutas con sprites. Emite CustomEvents `av:score`, `av:level`, `av:gameOver`; expone `window.SNAKE.pause/resume/restart`.
- `app/_games/snake/SnakeCanvas.tsx` — NUEVO. Canvas component con `forwardRef`, Script loaders (primero `sprites.js`, luego `game.js`) y listeners de CustomEvents.
- `app/_lib/game-engines.ts` — Añadir entrada `snake: lazy(() => import(...))`.
- Supabase tabla `games` — INSERT fila con metadata de Snake.

**Out of scope (para specs futuros):**

- Modificar `GamePlayerClient.tsx` — ya es genérico y funciona.
- Modificar `app/api/scores/route.ts` — ya es genérico.
- Modificar `app/_lib/supabase/queries.ts` — ya es genérico.
- RLS en Supabase — se añade en spec de auth.
- Controles táctiles / soporte móvil.
- Tests automatizados.
- Panel admin para gestionar juegos.
- `av:lives` — Snake no tiene sistema de vidas; un choque termina la partida directamente.
- Modos de juego alternativos (paredes que teletransportan, obstáculos, multijugador).

---

## Data model

### Fila en tabla `games` (Supabase)

| Campo   | Valor                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`    | `snake`                                                                                                                                                                                                |
| `title` | `SNAKE`                                                                                                                                                                                                |
| `short` | `Guía la serpiente y come frutas sin chocar con las paredes ni contigo mismo.`                                                                                                                         |
| `long`  | `Clásico arcade de precisión y reflejos. Cada fruta que comes alarga la serpiente y sube el puntaje. El juego termina al chocar con los bordes o con tu propio cuerpo. ¿Qué tan larga puedes hacerla?` |
| `cat`   | `ARCADE`                                                                                                                                                                                               |
| `cover` | `cover-snake`                                                                                                                                                                                          |
| `color` | `green`                                                                                                                                                                                                |

### CustomEvents emitidos por `game.js`

| Evento        | `detail`            | Cuándo                                         |
| ------------- | ------------------- | ---------------------------------------------- |
| `av:score`    | `{ score: number }` | Cada vez que la serpiente come una fruta       |
| `av:level`    | `{ level: number }` | Cada vez que sube la velocidad (cada 5 frutas) |
| `av:gameOver` | `{ score: number }` | Al chocar con pared o con el propio cuerpo     |

> `av:lives` no aplica — Snake no tiene sistema de vidas.

### window API expuesta por `game.js`

```js
window.SNAKE = { pause(), resume(), restart() }
```

- `pause()` → `cancelAnimationFrame(rafId)` + flag `paused = true`
- `resume()` → `paused = false; lastTime = performance.now(); rafId = requestAnimationFrame(loop)`
- `restart()` → reinicia estado completo + `rafId = requestAnimationFrame(loop)`

### Estado interno de `game.js`

```js
const CELL = 40; // px por celda
const COLS = 20; // 800 / 40
const ROWS = 20; // 800 / 40

let snake = [{ x, y }]; // array de segmentos, head = snake[0]
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 }; // buffer para evitar reversión inmediata
let fruit = { x, y, sprite }; // celda + nombre del sprite activo
let score = 0;
let level = 1; // sube cada 5 frutas; reduce intervalo del loop
let paused = false;
let gameOver = false;
let rafId;
let lastTime = 0;
let interval = 150; // ms entre pasos; disminuye con cada nivel
```

> Controles: **W A S D**. Colisión con borde del tablero → game over (sin wrap).

---

## Implementation plan

0. **Copiar y ajustar assets** — Copiar `references/source-assets/snake-assets/fruits.png` y
   `sprites.js` → `public/games/snake/assets/`. En `sprites.js`, cambiar:

   ```js
   sources: {
     fruits: "snake-assets/fruits.png";
   }
   // →
   sources: {
     fruits: "/games/snake/assets/fruits.png";
   }
   ```

   Verificar: `http://localhost:3000/games/snake/assets/fruits.png` devuelve la imagen.

1. **Crear `public/games/snake/game.js`** desde cero. Estructura completa:

   a. **Canvas e imagen** — Obtener `getElementById('av-canvas')`, cargar
   `window.SPRITE_ATLAS.sources.fruits` en un `Image` antes de arrancar el loop.

   b. **Estado inicial** — Constantes `CELL=40`, `COLS=20`, `ROWS=20`. Variables de estado
   listadas en el data model. Función `resetState()` que inicializa serpiente centrada
   (3 segmentos), dirección `{x:1,y:0}`, fruta aleatoria, `score=0`, `level=1`,
   `interval=150`, `gameOver=false`, `paused=false`.

   c. **Input** — `keydown` listener que mapea W/A/S/D a `nextDir`, bloqueando reversión
   directa (no permitir `{x:-1}` si `dir.x===1`, etc.). Solo acepta la primera tecla por
   frame — la segunda se ignora hasta el siguiente step.

   d. **Loop** — `requestAnimationFrame` con delta-time. Avanza el snake solo cuando
   `elapsed >= interval`. Por cada paso: aplica `nextDir → dir`, calcula nueva cabeza,
   detecta colisión con pared (`x<0||x>=COLS||y<0||y>=ROWS`) o con cuerpo propio →
   llama `triggerGameOver()`. Si hay colisión con fruta → llama `eatFruit()`. Si no →
   elimina último segmento (movimiento normal).

   e. **`eatFruit()`** — Incrementa `score += 10`, dispara `av:score`. Si `score % 50 === 0`
   (cada 5 frutas × 10pts): incrementa `level`, reduce `interval = Math.max(60, interval - 15)`,
   dispara `av:level`. Genera nueva fruta en celda libre: construir lista de celdas libres
   (todas las celdas menos las ocupadas por la serpiente), elegir una aleatoriamente.
   Elige sprite aleatorio de `window.SPRITE_ATLAS.fruits`.

   f. **`triggerGameOver()`** — `gameOver = true`, `cancelAnimationFrame(rafId)`,
   dispara `av:gameOver { score }`.

   g. **`draw()`** — Fondo oscuro, grid sutil, segmentos de serpiente (rectángulos
   redondeados `#4ade80`), cabeza con acento más claro, fruta con `ctx.drawImage` desde
   el sprite atlas. Sin overlay de game over — el modal React lo gestiona.

   h. **`window.SNAKE`** — Al final del archivo, tras arrancar el loop:

   ```js
   window.SNAKE = {
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

   Verificar: abrir con un `index.html` local — serpiente se mueve, come frutas, muere
   al chocar con pared o con sí misma, score sube correctamente.

2. **Crear `app/_games/snake/SnakeCanvas.tsx`** — Seguir patrón exacto de `AsteroidsCanvas.tsx`.
   Diferencias:
   - `window.SNAKE` en lugar de `window.ASTEROIDS`.
   - Sin listener `av:lives`.
   - Carga dos scripts en orden: `sprites.js` vía `script.onload` inyecta `game.js`
     (mismo patrón que `ArkanoidCanvas.tsx` con `spritesheet.js`).
   - Canvas: `<canvas id="av-canvas" width={800} height={800} style={{ display:'block', width:'100%', aspectRatio:'800/800' }} />`

   Verificar: `npx tsc --noEmit` sin errores.

3. **Registrar en `app/_lib/game-engines.ts`** — Añadir entrada:
   `snake: lazy(() => import('../_games/snake/SnakeCanvas'))`.
   Verificar: `npx tsc --noEmit` sin errores.

4. **INSERT en Supabase** — Ejecutar SQL:

   ```sql
   INSERT INTO games (id, title, short, long, cat, cover, color)
   VALUES (
     'snake',
     'SNAKE',
     'Guía la serpiente y come frutas sin chocar con las paredes ni contigo mismo.',
     'Clásico arcade de precisión y reflejos. Cada fruta que comes alarga la serpiente y sube el puntaje. El juego termina al chocar con los bordes o con tu propio cuerpo. ¿Qué tan larga puedes hacerla?',
     'ARCADE',
     'cover-snake',
     'green'
   );
   ```

   Verificar: fila visible en Supabase dashboard.

5. **`npm run build`** — Build limpio sin errores. Verificar que rutas existentes
   (`/games`, `/games/asteroids/play`, `/games/tetris/play`, `/games/arkanoid/play`,
   `/hall-of-fame`) no presentan regresiones.

---

## Acceptance criteria

- [ ] Fila `snake` presente en tabla `games` de Supabase.
- [ ] `/games` muestra card de SNAKE con datos desde Supabase.
- [ ] `/games/snake` muestra info del juego + strip top-5 scores (vacío si no hay scores).
- [ ] `/games/snake/play` carga sin errores de SSR ni TypeScript.
- [ ] Canvas 800×800 renderiza el juego y es jugable con WASD.
- [ ] Serpiente arranca centrada con 3 segmentos moviéndose hacia la derecha.
- [ ] Comer una fruta alarga la serpiente, suma 10 pts y muestra sprite del atlas.
- [ ] HUD React refleja en tiempo real score y nivel del canvas.
- [ ] Cada 5 frutas el nivel sube y la serpiente se mueve más rápido.
- [ ] Chocar con pared o con el propio cuerpo → game over.
- [ ] Al hacer game over, aparece modal React con la puntuación final (sin overlay canvas).
- [ ] Botón "PAUSA" congela el game loop; "REANUDAR" lo reanuda.
- [ ] Input nickname + botón "Publicar score" funciona; score aparece en `/hall-of-fame`.
- [ ] Nickname vacío o > 20 chars → validación impide submit.
- [ ] `npm run build` limpio. Rutas existentes sin regresiones.

---

## Decisions

- **Sí:** Implementación desde cero. Los assets de `snake-assets/` proveen solo sprites de
  frutas — no hay `game.js` de referencia. Construir el juego completo es la única opción.

- **Sí:** `av:score` y `av:level` aplican. `av:lives` omitido — Snake no tiene vidas;
  un solo choque termina la partida.

- **Sí:** `av:gameOver` se dispara solo en colisión (pared o cuerpo propio). No hay
  condición de victoria — la partida es infinita hasta el error.

- **Sí:** Canvas `800×800` con `CELL=40`, grid `20×20`. Proporciona celdas visualmente
  cómodas para el sprite de fruta (40×40px renderizado) y coherencia con el canvas
  cuadrado del juego original de Google Snake.

- **Sí:** Controles WASD únicamente. Confirmado por el usuario; flechas no se añaden
  para no duplicar handlers sin pedido explícito.

- **Sí:** Paredes matan al snake (sin wrap). Comportamiento clásico confirmado por el usuario.

- **Sí:** Velocidad inicial `150ms/step`, reduce `15ms` por nivel, mínimo `60ms`.
  Progresión suave que no vuelve el juego injugable en niveles altos.

- **Sí:** Nivel sube cada 5 frutas (cada 50 pts). Umbral simple, verificable, consistente
  con el evento `av:level`.

- **Sí:** Cargar `sprites.js` antes de `game.js` vía `script.onload`. `window.SPRITE_ATLAS`
  debe existir cuando `game.js` ejecuta — mismo patrón probado en Arkanoid.

- **Sí:** Ajustar ruta en `sprites.js` de relativa a absoluta (`/games/snake/assets/fruits.png`).
  La ruta original apunta a `snake-assets/` que no existe bajo `/public`.

- **No:** Overlay de game over en canvas. El modal React es el punto único de control
  post-partida — consistente con Tetris y Arkanoid.

- **Sí:** Buffer `nextDir` para evitar reversión inmediata. Invariante de Snake — sin él
  el jugador puede morir presionando dos teclas opuestas en el mismo frame.

---

## Risks

| Riesgo                                                                                                                                 | Mitigación                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.SPRITE_ATLAS` persiste si el usuario navega entre juegos. Puede colisionar si otro juego define el mismo global.               | Nombre suficientemente específico — bajo riesgo real. Cleanup de `SnakeCanvas.tsx` elimina `window.SNAKE` al desmontar; `SPRITE_ATLAS` es read-only. |
| Fruta generada en celda ocupada por la serpiente.                                                                                      | Generar lista de celdas libres y elegir aleatoriamente — O(n) pero correcto.                                                                         |
| `sprites.js` carga imagen desde ruta absoluta. Si el servidor no sirve `/games/snake/assets/fruits.png`, los sprites no se renderizan. | El paso 0 del plan verifica accesibilidad de la URL antes de continuar.                                                                              |
| Canvas fijo `800×800` puede quedar pequeño en pantallas <900px.                                                                        | CSS `aspectRatio: '800/800'` + `width: 100%` — fuera de scope; suficiente para desktop.                                                              |
| Dos teclas WASD en el mismo frame pueden invertir dirección (W luego S antes del siguiente step).                                      | Buffer `nextDir` solo acepta la primera tecla por frame — la segunda se ignora hasta el siguiente step.                                              |

---

## What is **not** in this spec

- `av:lives` — Snake no tiene vidas.
- Controles táctiles / soporte móvil.
- Modos alternativos (wrap de paredes, obstáculos, multijugador).
- RLS en Supabase.
- Panel admin para gestionar juegos.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
