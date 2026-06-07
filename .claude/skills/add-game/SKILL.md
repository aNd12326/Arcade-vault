---
name: add-game
description: Genera un spec para añadir un nuevo juego canvas a Arcade Vault (componente React, play-page, fila en tabla games de Supabase y wiring del modal de leaderboard). Acepta una carpeta de references/started-games/ o una descripción libre del juego. No escribe código; solo produce specs/NN-<slug>-game.md.
argument-hint: "carpeta de referencia (ej: 03-tetris) o descripción del juego"
---

# /add-game — Spec para nuevo juego canvas en Arcade Vault

Esta skill genera un spec completo para integrar un nuevo juego en la plataforma siguiendo el patrón ya establecido en spec-05 (canvas) y spec-06 (leaderboard). **No escribes código aquí.** Tu trabajo es clarificar el juego con el usuario, analizar la referencia si existe, y producir un spec ejecutable en `specs/`.

Responde en el mismo idioma que el usuario usó para invocar la skill.

---

## Fase 1 — Entender la fuente del juego

### 1.1 Fuente

Si `$ARGUMENTS` no está vacío, interpretarlo:

- Si parece una carpeta (ej: `03-tetris`, `04-arkanoid`) → verificar que existe en `references/started-games/`. Si existe, **leer** `references/started-games/{arg}/game.js` completo y el `README.md` si hay uno.
- Si parece una descripción libre (ej: "un juego de serpiente", "snake game") → el juego se implementará desde cero; tomar nota del concepto.

Si `$ARGUMENTS` está vacío → preguntar al usuario:

> ¿El juego viene de `references/started-games/`? Si sí, ¿cuál? (ejecuta `ls references/started-games/` y muestra las opciones). Si no, describe brevemente el juego.

### 1.2 Leer contexto del proyecto

Antes de hacer preguntas, leer en este orden:

1. `.claude/skills/spec/SKILL.md` — leer completo. Esta skill es la referencia maestra del flujo spec-driven. Seguir sus fases, sus reglas de preguntas y su criterio de "cuándo parar de preguntar".
2. `.claude/skills/spec/template.md` — leer completo. Define el formato exacto de cada sección del spec (header, scope, data model, implementation plan, acceptance criteria, decisions, risks). **Todo spec generado por `/add-game` debe respetar este template.**
3. `specs/` — listar todos los specs existentes para determinar el número siguiente (NN).
4. Los dos specs más recientes para recoger convenciones del proyecto (tono, idioma, nivel de detalle).
5. `app/_lib/supabase/types.ts` — para conocer el schema exacto de `Game` y `Score`.
6. `app/_lib/game-engines.ts` — para ver los juegos ya registrados.
7. `app/_games/asteroids/AsteroidsCanvas.tsx` — para entender el patrón Canvas component.

Si el juego viene de references, además leer el `game.js` para identificar:

- Variables de score, vidas y nivel (nombres exactos)
- Dónde ocurre el game over (condición de vidas = 0)
- Si hay overlay "GAME OVER" dibujado en canvas (buscar `ctx.fillText` con "GAME" o "OVER")
- Si hay audio u otros assets adicionales

---

## Fase 2 — Clarificar con preguntas

Preguntar todo esto en **un solo bloque** (no una pregunta por turno):

1. **`id`** — Slug del juego (minúsculas, sin espacios). Sugerir uno basado en el nombre (ej: `tetris`). ¿Confirma?
2. **`title`** — Nombre en display, mayúsculas (ej: `TETRIS`).
3. **`short`** — Descripción corta para la card (≤80 chars).
4. **`long`** — Descripción larga para la página de detalle (2-3 frases).
5. **`cat`** — Categoría. Opciones: `ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`. Recomendar una basada en el tipo de juego.
6. **`cover`** — CSS class del fondo de la card (ej: `cover-tetris`). Indicar que se añadirá al spec como pendiente de diseño si no existe.
7. **`color`** — Color accent. Opciones: `cyan` | `magenta` | `yellow` | `green`. Recomendar uno.
8. **Mecánicas de leaderboard** — ¿El juego tiene vidas? ¿Tiene niveles? ¿O solo score? (determina qué eventos `av:*` aplican).
9. **Assets adicionales** — ¿Hay audio, sprites u otros assets en la referencia? ¿Van a `public/games/{id}/assets/`?

Si el juego viene de references/, puedes pre-llenar varias respuestas basándote en lo que leíste en el `game.js`. Muestra tus sugerencias y pide confirmación.

**Cuándo parar de preguntar:** cuando puedas responder sin asumir nada:

1. ¿Qué archivos se crean o modifican?
2. ¿Cuál es el primer paso ejecutable y cuál es el último?
3. ¿Cómo se verifica que el juego está integrado y funciona?

---

## Fase 3 — Desarrollar el spec sección por sección

Una vez tengas claridad, construir el spec **sección por sección**, mostrando cada una y esperando confirmación antes de pasar a la siguiente.

El formato de cada sección debe respetar el template leído en Fase 1.2 (`.claude/skills/spec/template.md`). Si hay conflicto entre lo que dice este documento y lo que dice el template, **el template manda**.

Orden estricto:

### Sección 1 — Header

```
# SPEC NN — {title} (canvas + leaderboard)

> **Status:** Draft · **Depende de:** 05-asteroids-canvas, 06-games-table-leaderboard · **Fecha:** {fecha}
> **Objetivo:** Integrar {title} como juego canvas en Arcade Vault con leaderboard anónimo.
```

### Sección 2 — Scope

**In:**

- `references/started-games/{ref}/game.js` → adaptar y copiar a `public/games/{id}/game.js` [si aplica]
- `public/games/{id}/game.js` — adaptar: emitir CustomEvents `av:score`, `av:lives`, `av:level`, `av:gameOver`; exponer `window.{ID_UPPER}.pause/resume/restart`; eliminar overlay "GAME OVER" interno [si aplica]
- `app/_games/{id}/{PascalId}Canvas.tsx` — NUEVO. Canvas component con forwardRef, Script loader y listeners de CustomEvents.
- `app/_lib/game-engines.ts` — Registrar `{id}: lazy(() => import(...))`.
- Supabase tabla `games` — INSERT fila con metadata del juego.
- [Assets si aplica] `public/games/{id}/assets/` — copiar audio/sprites de la referencia.

**Out of scope:**

- Modificar `GamePlayerClient.tsx` — ya es genérico y funciona.
- Modificar `app/api/scores/route.ts` — ya es genérico.
- Modificar `app/_lib/supabase/queries.ts` — ya es genérico.
- RLS en Supabase — se añade en spec de auth.
- Controles táctiles / soporte móvil.
- Tests automatizados.
- Panel admin para gestionar el juego.

### Sección 3 — Data model

**Fila en tabla `games` (Supabase):**

| Campo   | Valor     |
| ------- | --------- |
| `id`    | `{id}`    |
| `title` | `{title}` |
| `short` | `{short}` |
| `long`  | `{long}`  |
| `cat`   | `{cat}`   |
| `cover` | `{cover}` |
| `color` | `{color}` |

**CustomEvents emitidos por `game.js`:**

| Evento        | `detail`            | Cuándo                                                            |
| ------------- | ------------------- | ----------------------------------------------------------------- |
| `av:score`    | `{ score: number }` | Cada vez que cambia el score                                      |
| `av:lives`    | `{ lives: number }` | Cada vez que cambia las vidas [omitir si el juego no tiene vidas] |
| `av:level`    | `{ level: number }` | Cada vez que sube el nivel [omitir si el juego no tiene niveles]  |
| `av:gameOver` | `{ score: number }` | Al terminar la partida                                            |

**window API expuesta por `game.js`:**

```js
window.{ID_UPPER} = { pause(), resume(), restart() }
```

[Si el juego viene de references, indicar qué variables/funciones del game.js original se mapean a pause/resume/restart]

### Sección 4 — Implementation plan

Pasos numerados, cada uno dejando el sistema funcional:

1. **Adaptar `game.js`** — [Si viene de references]: leer `references/started-games/{ref}/game.js`, localizar puntos de score/vidas/nivel/gameOver, copiar a `public/games/{id}/game.js`, aplicar tres cambios: (a) CustomEvents, (b) `window.{ID_UPPER}` API, (c) eliminar overlay GAME OVER. [Si es nuevo]: crear `public/games/{id}/game.js` con skeleton mínimo (loop + CustomEvents + window API). Verificar: abrir en `index.html` local, juego funciona.

2. **Crear `app/_games/{id}/{PascalId}Canvas.tsx`** — Seguir el patrón exacto de `AsteroidsCanvas.tsx`: `forwardRef`, `useImperativeHandle` hacia `window.{ID_UPPER}`, `useEffect` con listeners para los 4 eventos `av:*`, cleanup que elimina listeners y llama `window.{ID_UPPER}?.pause()`. Verificar: `npx tsc --noEmit` sin errores.

3. **Registrar en `app/_lib/game-engines.ts`** — Añadir `{id}: lazy(() => import("../_games/{id}/{PascalId}Canvas"))`. Verificar: `npx tsc --noEmit` sin errores.

4. **INSERT en Supabase** — Ejecutar SQL: `INSERT INTO games (id, title, short, long, cat, cover, color) VALUES ('{id}', '{title}', '{short}', '{long}', '{cat}', '{cover}', '{color}');`. Verificar: fila visible en dashboard.

5. **`npm run build`** — Build limpio sin errores. Verificar que rutas existentes no se rompen.

[Si hay assets]: añadir paso 0: copiar `references/started-games/{ref}/assets/` → `public/games/{id}/assets/` y ajustar rutas en game.js.

### Sección 5 — Acceptance criteria

Lista booleana y verificable. Incluir siempre:

- [ ] Fila `{id}` presente en tabla `games` de Supabase.
- [ ] `/games` muestra card de {title} con datos desde Supabase.
- [ ] `/games/{id}` muestra info del juego + strip top-5 scores (vacío si no hay scores).
- [ ] `/games/{id}/play` carga sin errores de SSR ni TypeScript.
- [ ] Canvas renderiza el juego y es jugable con teclado.
- [ ] HUD React refleja en tiempo real score[, vidas, nivel] del canvas.
- [ ] Botón "PAUSA" congela el game loop; "REANUDAR" lo reanuda.
- [ ] Al terminar la partida, aparece el modal React con la puntuación final.
- [ ] [Si aplica]: Overlay "GAME OVER" interno del canvas eliminado.
- [ ] Input nickname + botón "Publicar score" funciona; score aparece en `/hall-of-fame`.
- [ ] Nickname vacío o > 20 chars → validación impide submit.
- [ ] `npm run build` limpio. Rutas existentes sin regresiones.

### Sección 6 — Decisions

Documentar al menos:

- Por qué se eligió este juego de references/ (o por qué desde cero)
- Qué eventos `av:*` aplican y cuáles se omiten (ej: "sin `av:lives` porque el juego no tiene vidas")
- Cómo se implementa `pause`/`resume` en el game.js de origen (flag existente vs. flag nuevo)
- Si hay decisiones de naming, cover, color

### Sección 7 — Risks (solo si aplica)

Riesgos relevantes, por ejemplo:

- Game.js usa globals que colisionan con otros juegos cargados en la misma página
- Audio requiere interacción del usuario antes de reproducir (política del navegador)
- Canvas fijo 800×600 puede quedar pequeño en pantallas <900px (fuera de scope, mitigación: CSS `aspect-ratio`)

---

## Fase 4 — Guardar el spec

1. Contar specs existentes en `specs/` para determinar NN.
2. Sugerir nombre de archivo: `specs/NN-{id}-game.md`. Confirmar con el usuario.
3. Crear el archivo con todas las secciones aprobadas.
4. Marcar estado como `Draft`.
5. Confirmar al usuario:
   - Path del archivo creado.
   - Recordatorio: cambiar a `Approved` una vez releído.
   - Próximo paso: `/spec-impl NN-{id}-game` para implementarlo.
   - **Parar aquí.** No proponer implementar, no escribir código.

---

## Reglas hard

- **Leer `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` siempre**, en cada invocación, antes de redactar cualquier sección. No confiar en memoria.
- **El template manda.** Si el formato de esta skill diverge del template, seguir el template.
- **Nunca escribir código.** Solo el archivo `.md` del spec al final.
- **Nunca proponer implementar el spec después de guardarlo.** El usuario corre `/spec-impl` cuando esté listo.
- **Siempre leer `AsteroidsCanvas.tsx` y `game-engines.ts` en runtime** antes de redactar el spec.
- **Si el juego viene de references/, leer el `game.js` completo** antes de redactar el implementation plan — los nombres de variables exactos importan.
- **Construir sección por sección**, mostrando cada una y esperando confirmación. Nunca generar el spec completo en una sola respuesta.
- **Si el usuario quiere saltarse preguntas**, recordar: "Las preguntas ahora ahorran horas después. ¿Seguro?" Si insiste, registrarlo en Decisions.
