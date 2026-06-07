# SPEC 05 — Juego Asteroids (canvas real)

> **Status:** Implementado · **Depende de:** 01-mvp-visual, 04-supabase-integration · **Fecha:** 2026-06-06
> **Objetivo:** Integrar el juego Asteroids (canvas HTML5 vanilla) en la plataforma
> Arcade Vault como ruta `/games/asteroids/play`, con HUD React sincronizado vía
> CustomEvents y control de pausa/game-over desde el contenedor Next.js.

---

## Scope

**In:**

- `app/_lib/data.ts` — Agregar entry `id: "asteroids"` con sus propios datos (title, cover, color, etc.).
- `public/games/asteroids/game.js` — Copia modificada del juego original. Cambios:
  emite `CustomEvent`s (`av:score`, `av:lives`, `av:level`, `av:gameOver`),
  expone `window.ASTEROIDS.pause()` / `window.ASTEROIDS.resume()` / `window.ASTEROIDS.restart()`,
  elimina el overlay interno de "GAME OVER" (lo reemplaza el modal React).
- `app/_games/asteroids/AsteroidsCanvas.tsx` — NUEVO. Client Component que monta el
  `<canvas>`, carga el script via `<Script>` de Next.js, escucha los CustomEvents y
  llama callbacks `onScore`, `onLives`, `onLevel`, `onGameOver` hacia el padre.
- `app/_lib/game-engines.ts` — NUEVO. Mapa `id → lazy component` para que
  `GamePlayerClient` resuelva qué canvas renderizar por ID.
- `app/games/[id]/play/GamePlayerClient.tsx` — Modificar: usar `game-engines.ts` para
  renderizar canvas real cuando existe; mantener arena fake como fallback para otros IDs.

**Out of scope:**

- Autenticación / guardado de scores en Supabase (spec futuro).
- Soporte móvil / controles táctiles.
- Redimensionado responsivo del canvas (canvas fijo 800×600, escalado CSS con `aspect-ratio`).
- Modificar la ruta de detalle `/games/[id]` (leaderboard, stats strip).
- `campo-de-rocas` — queda como juego mock independiente, sin canvas real.
- Tests automatizados.

---

## Data model

### Entry nuevo en `GAMES` (`app/_lib/data.ts`)

```ts
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Destruye asteroides y sobrevive el mayor tiempo posible.",
  long: "Nave espacial en un campo toroidal de asteroides. Los grandes se parten en medianos, los medianos en pequeños. 3 vidas, power-ups y estrella fugaz. ¿Cuánto aguantas?",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "cyan",
  best: 267300,
  plays: "15.6K",
}
```

### CustomEvents emitidos por `game.js` → escuchados por React

| Evento        | `detail`            | Cuándo                        |
| ------------- | ------------------- | ----------------------------- |
| `av:score`    | `{ score: number }` | Cada vez que cambia el score  |
| `av:lives`    | `{ lives: number }` | Cada vez que cambia las vidas |
| `av:level`    | `{ level: number }` | Cada vez que sube el nivel    |
| `av:gameOver` | `{ score: number }` | Al perder la última vida      |

### API expuesta en `window.ASTEROIDS`

| Método      | Efecto                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| `pause()`   | Congela el game loop (flip flag interno `paused` que el loop ya respeta) |
| `resume()`  | Reanuda el game loop                                                     |
| `restart()` | Reinicia estado completo y arranca de cero                               |

### `app/_lib/game-engines.ts`

```ts
import { lazy } from "react";

export const GAME_ENGINES: Record<string, React.LazyExoticComponent<any>> = {
  asteroids: lazy(() => import("../_games/asteroids/AsteroidsCanvas")),
};
```

---

## Implementation plan

1. **Agregar entry `asteroids` en `data.ts`**
   Insertar el objeto Game en `GAMES`. Verificar: card aparece en `/games`.

2. **Copiar y modificar `game.js`**
   Copiar `references/started-games/02-asteroids/game.js` →
   `public/games/asteroids/game.js`. Aplicar tres cambios:

   a. **Emitir CustomEvents** en los puntos donde el juego ya actualiza score/lives/level.
   Usar `window.dispatchEvent(new CustomEvent('av:score', { detail: { score } }))`.

   b. **Exponer API de control** al final del archivo:

   ```js
   window.ASTEROIDS = { pause, resume, restart };
   ```

   donde `pause`/`resume` flip un flag `paused` que el game loop ya respeta,
   y `restart` reinicia todas las variables globales y llama `gameLoop()`.

   c. **Eliminar overlay "GAME OVER"** interno del canvas — el modal React lo reemplaza.
   Cuando vidas llegan a 0: emitir `av:gameOver` y detener el loop; no dibujar texto
   en canvas.

   Verificar: abrir `public/games/asteroids/game.js` en un `index.html` local — juego funciona.

3. **Crear `app/_games/asteroids/AsteroidsCanvas.tsx`**
   Client Component (`"use client"`). Responsabilidades:
   - Renderiza `<canvas id="av-canvas" width={800} height={600} />`.
   - Usa `next/script` con `strategy="afterInteractive"` para cargar
     `/games/asteroids/game.js`.
   - En `useEffect` post-carga: registra listeners para `av:score`, `av:lives`,
     `av:level`, `av:gameOver` en `window`; llama los callbacks del padre.
   - Expone `pause()`, `resume()`, `restart()` vía `useImperativeHandle` + `ref` hacia
     `GamePlayerClient`.
   - En cleanup del `useEffect`: elimina listeners y llama `window.ASTEROIDS?.pause()`.
     Props: `onScore`, `onLives`, `onLevel`, `onGameOver`, `ref`.

4. **Crear `app/_lib/game-engines.ts`**
   Mapa `id → React.lazy(AsteroidsCanvas)`. Exportar `GAME_ENGINES`.

5. **Modificar `GamePlayerClient.tsx`**
   - Importar `GAME_ENGINES`.
   - Si `GAME_ENGINES[game.id]` existe: renderizar el canvas real dentro del `.crt-screen`
     envuelto en `<Suspense>`. Pasar `ref` al canvas y conectar callbacks a estado React
     (`score`, `lives`, `level`).
   - Si no existe: mantener la arena fake CSS (fallback para otros juegos mock).
   - Botón PAUSA: llamar `canvasRef.current?.pause()` / `resume()`.
   - Modal "JUGAR DE NUEVO": llamar `canvasRef.current?.restart()` y resetear estado React.

   Verificar: `npx tsc --noEmit` sin errores.

6. **`npm run build`**
   Confirmar build limpio sin errores. Verificar que rutas existentes (`/games`,
   `/games/campo-de-rocas/play`, `/hall-of-fame`) no se rompen.

---

## Acceptance criteria

- [ ] La card de Asteroids aparece en `/games` con ID `asteroids`.
- [ ] La ruta `/games/asteroids/play` carga sin errores de SSR ni de TypeScript.
- [ ] El canvas renderiza el juego (nave, asteroides, balas, partículas) y es jugable con
      teclado (flechas + espacio).
- [ ] El HUD interno del canvas (score, nivel, vidas) se dibuja correctamente durante la partida.
- [ ] El HUD React de la plataforma refleja en tiempo real los mismos valores de score,
      vidas y nivel que el canvas.
- [ ] El botón "PAUSA" de la plataforma congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al perder todas las vidas, aparece el modal React de game over con la puntuación final.
- [ ] El overlay "GAME OVER" del canvas ya no se dibuja (el modal React lo reemplaza).
- [ ] El botón "JUGAR DE NUEVO" del modal reinicia la partida desde cero.
- [ ] `npm run build` completa sin errores relacionados con los archivos nuevos.
- [ ] La play-page genérica `/games/[id]/play` y el resto de rutas existentes no se rompen.

---

## Decisions

- **Sí:** ID `asteroids` como entry nuevo en `data.ts`. `campo-de-rocas` queda intacto
  como juego mock independiente — sin colisión de IDs ni datos.

- **Sí:** CustomEvents (`av:score`, `av:lives`, `av:level`, `av:gameOver`) como canal
  canvas → React. Mínima invasión a `game.js`; desacoplado del framework.

- **Sí:** `window.ASTEROIDS.pause()` / `resume()` / `restart()` como API de control
  React → canvas. Simple, sin convertir `game.js` a módulo ES.

- **Sí:** `public/games/asteroids/game.js` cargado con `next/script strategy="afterInteractive"`.
  Evita bundling del juego con Next.js; mantiene el juego como asset estático independiente.

- **Sí:** `app/_games/asteroids/AsteroidsCanvas.tsx` en directorio `_games/` separado.
  Escala cuando llegue el 2do juego real — cada juego tiene su propio directorio aislado.

- **Sí:** `GAME_ENGINES` mapa en `_lib/game-engines.ts`. `GamePlayerClient` no importa
  directamente `AsteroidsCanvas` — el mapa desacopla la ruta genérica de cada juego.

- **No:** Redimensionado responsivo del canvas. Canvas fijo 800×600 con CSS
  `aspect-ratio: 800/600` — suficiente para desktop; móvil es scope futuro.

- **No:** Eliminar el HUD interno del canvas (score/vidas dibujados en canvas).
  Queda como está — el HUD React es adicional, no reemplaza el del canvas.

- **No:** Controles táctiles. Solo teclado en este spec.
