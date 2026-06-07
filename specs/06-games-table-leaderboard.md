# SPEC 06 — Games Table + Leaderboard

> **Status:** Implementado · **Depende de:** 04-supabase-integration, 05-asteroids-canvas · **Fecha:** 2026-06-06
> **Objetivo:** Migrar el catálogo de juegos a Supabase y añadir un sistema de
> leaderboard por juego con submit anónimo desde el modal de game over.

---

## Scope

**In:**

- Supabase migration — Crear tablas `games` y `scores`. Seed: 1 fila (`asteroids`).
- `app/_lib/data.ts` — ELIMINAR. Reemplazado por fetches a Supabase.
- `app/_lib/supabase/queries.ts` — NUEVO. Funciones server-side: `getGames()`,
  `getGame(id)`, `getTopScores(gameId, limit)`, `insertScore(gameId, nickname, score)`.
- `app/games/page.tsx` — Actualizar: usa `getGames()` en lugar de `GAMES` de `data.ts`.
- `app/games/[id]/page.tsx` — Actualizar: usa `getGame(id)` + `getTopScores(id, 5)`;
  muestra strip de top 5 en la página de detalle.
- `app/hall-of-fame/page.tsx` — Actualizar: reemplaza mock con datos reales;
  muestra top 10 por juego.
- `app/games/[id]/play/GamePlayerClient.tsx` — Actualizar: modal game over añade
  input de nickname + botón "Publicar score" que llama `insertScore`.

**Out of scope:**

- Autenticación — scores son anónimos; no hay usuario asociado.
- Columnas `best` y `plays` en `games` — calculadas en spec futuro desde `scores`.
- Panel admin para gestionar juegos — altas/bajas via Supabase dashboard.
- Row Level Security (RLS) — se añade en spec de auth.
- Paginación del leaderboard más allá de top 10.
- Soporte para juegos distintos de `asteroids` en el submit de score.
- Tests automatizados.

---

## Data model

### Tabla `games`

| Columna      | Tipo        | Notas                       |
| ------------ | ----------- | --------------------------- |
| `id`         | text        | PK (ej: `"asteroids"`)      |
| `title`      | text        | Nombre display              |
| `short`      | text        | Descripción corta (card)    |
| `long`       | text        | Descripción larga (detalle) |
| `cat`        | text        | Categoría (ej: `"SHOOTER"`) |
| `cover`      | text        | CSS class de cover          |
| `color`      | text        | Color accent (ej: `"cyan"`) |
| `created_at` | timestamptz | Default `now()`             |

### Tabla `scores`

| Columna      | Tipo        | Notas                           |
| ------------ | ----------- | ------------------------------- |
| `id`         | uuid        | PK, default `gen_random_uuid()` |
| `game_id`    | text        | FK → `games.id`                 |
| `nickname`   | text        | Máx 20 chars                    |
| `score`      | integer     | Puntuación final                |
| `created_at` | timestamptz | Default `now()`                 |

### Seed SQL

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'asteroids',
  'ASTEROIDS',
  'Destruye asteroides y sobrevive el mayor tiempo posible.',
  'Nave espacial en un campo toroidal de asteroides. Los grandes se parten en medianos, los medianos en pequeños. 3 vidas, power-ups y estrella fugaz. ¿Cuánto aguantas?',
  'SHOOTER',
  'cover-rocas',
  'cyan'
);
```

### Tipos TypeScript (generados con `npx supabase gen types`)

```ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  created_at: string;
};
export type Score = {
  id: string;
  game_id: string;
  nickname: string;
  score: number;
  created_at: string;
};
```

---

## Implementation plan

1. **Crear migración Supabase** — Via dashboard o MCP: crear tablas `games` y `scores`
   con el schema definido. Ejecutar seed SQL para `asteroids`.
   Verificar: ambas tablas visibles en Supabase dashboard con la fila seed.

2. **Generar tipos TypeScript** — `npx supabase gen types typescript --linked > app/_lib/supabase/types.ts`.
   Verificar: `Game` y `Score` exportados sin errores de compilación.

3. **Crear `app/_lib/supabase/queries.ts`** — Cuatro funciones server-side:

   ```ts
   export async function getGames(): Promise<Game[]>;
   export async function getGame(id: string): Promise<Game | null>;
   export async function getTopScores(
     gameId: string,
     limit: number
   ): Promise<Score[]>;
   export async function insertScore(
     gameId: string,
     nickname: string,
     score: number
   ): Promise<void>;
   ```

   `insertScore` va en Route Handler (no Server Action) porque se llama desde Client Component.
   Verificar: `npx tsc --noEmit` sin errores.

4. **Crear `app/api/scores/route.ts`** — POST handler que recibe `{ gameId, nickname, score }`,
   valida (nickname ≤ 20 chars, score ≥ 0), llama `insertScore`.
   Verificar: `curl -X POST` con body válido devuelve 200.

5. **Eliminar `app/_lib/data.ts`** — Borrar archivo.
   Verificar: `npx tsc --noEmit` lista todos los imports rotos → fix en pasos siguientes.

6. **Actualizar `app/games/page.tsx`** — Reemplazar import de `data.ts` con `getGames()`.
   Verificar: `/games` muestra card de Asteroids desde Supabase.

7. **Actualizar `app/games/[id]/page.tsx`** — Usar `getGame(id)` + `getTopScores(id, 5)`.
   Añadir strip visual de top 5 scores debajo de la info del juego.
   Verificar: `/games/asteroids` muestra top 5 (vacío si no hay scores aún).

8. **Actualizar `app/hall-of-fame/page.tsx`** — Reemplazar mock con `getTopScores` por juego,
   top 10. Mostrar tabla: rank, nickname, score, fecha.
   Verificar: `/hall-of-fame` muestra tabla real (vacía si no hay scores).

9. **Actualizar `GamePlayerClient.tsx`** — En modal game over: añadir `<input>` nickname
   (máx 20 chars) + botón "Publicar score" que hace POST a `/api/scores`.
   Estado: `idle | submitting | submitted | error`. Botón deshabilitado durante `submitting`.
   Verificar: jugar Asteroids hasta game over → ingresar nickname → score aparece en
   `/hall-of-fame`.

10. **`npm run build`** — Build limpio sin errores. Todas las rutas existentes funcionales.

---

## Acceptance criteria

- [x] Tablas `games` y `scores` existen en Supabase con el schema definido.
- [x] Fila `asteroids` presente en `games`.
- [x] `app/_lib/data.ts` eliminado; `npx tsc --noEmit` sin errores.
- [x] `/games` muestra card de Asteroids con datos desde Supabase.
- [x] `/games/asteroids` muestra info del juego desde Supabase + strip top 5 scores.
- [x] `/hall-of-fame` muestra tabla real top 10 por juego (vacía si no hay scores).
- [x] Modal game over de Asteroids tiene input nickname + botón "Publicar score".
- [x] Score publicado aparece en `/hall-of-fame` y en strip de `/games/asteroids`.
- [x] Nickname vacío o > 20 chars → validación impide submit.
- [x] Score < 0 → API rechaza con 400.
- [x] `npm run build` limpio. Rutas `/games`, `/games/[id]`, `/games/[id]/play`,
      `/hall-of-fame` funcionales sin regresiones.

---

## Decisions

- **Sí:** Un spec para games table + leaderboard. Ambas features comparten migración
  y son interdependientes (scores referencia games.id).

- **Sí:** Eliminar `data.ts` completamente. Sin convivencia — datos en un solo lugar.

- **Sí:** Columnas `best` y `plays` excluidas de `games`. Se calcularán desde `scores`
  en spec futuro; hardcodearlas ahora crearía inconsistencia.

- **Sí:** Scores anónimos con nickname libre. Auth no existe aún; no bloquear feature
  por eso.

- **Sí:** Route Handler (`/api/scores`) para `insertScore`. `GamePlayerClient` es Client
  Component — no puede llamar Server Actions directamente sin wrapper.

- **Sí:** Top 5 en `/games/[id]`, top 10 en `/hall-of-fame`. Diferente contexto:
  detalle del juego muestra preview; hall-of-fame es el ranking completo.

- **Sí:** Gestión de juegos via Supabase dashboard únicamente. Sin panel admin —
  agrega complejidad innecesaria cuando hay pocos juegos.

- **No:** RLS en este spec. Se añade cuando exista auth (spec futuro).

- **No:** Paginación del leaderboard. Top 10 suficiente por ahora.

- **No:** `level` en tabla `scores`. `score` es suficiente para el leaderboard actual.

---

## Risks

- **Spam de scores:** Sin RLS ni auth, cualquiera puede insertar scores vía API.
  Mitigación parcial: validación server-side (nickname ≤ 20 chars, score ≥ 0).
  Solución definitiva: RLS en spec de auth.

- **Consumers ocultos de `data.ts`:** Al eliminar el archivo pueden aparecer imports
  rotos en rutas no identificadas aún. Mitigación: `npx tsc --noEmit` después del
  paso 5 lista todos los breaks antes de continuar.
