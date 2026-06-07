# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What is Arcade Vault

Retro arcade platform: a library of canvas games, each with an anonymous global leaderboard backed by Supabase. Games run as plain `<canvas>` + vanilla JS engines loaded into React client components. Currently shipped: **Asteroids**, **Tetris**, **Arkanoid**, **Snake** — may be more; see `references/implemented-games.md` for the full up-to-date list (ID, título, categoría, color, descripción).

## Commands

```bash
npm run dev      # start dev server (Turbopack, port 3000)
npm run build    # production build (Turbopack)
npm run start    # serve production build
eslint           # lint (NOT `next lint` — replaced in v16)
npx tsc --noEmit # type-check
npx next typegen # generate PageProps/LayoutProps/RouteContext helpers
```

## Skills

- **`/frontend-design`** — siempre úsalo para diseñar la interfaz de usuario.
- **`/add-game`** — genera un spec (`specs/NN-<slug>-game.md`) para añadir un nuevo juego canvas. Acepta una carpeta de `references/started-games/` (ej: `03-tetris`) o una descripción libre. Solo produce el spec; no escribe código. Implementar después con `/spec-impl NN-<slug>-game`.
- **`/spec`, `/spec-impl`** — flujo spec-driven maestro (en `.agents/skills/`). Todo juego/feature pasa por un spec en `specs/` antes de implementarse.

## Stack

- **Next.js 16.2.7** — App Router only; Pages Router unused
- **React 19.2.4** — Server Components by default
- **Tailwind CSS v4** — via `@tailwindcss/postcss` (not the v3 plugin)
- **TypeScript** — strict mode; path alias `@/*` → project root

## Next.js 16 Breaking Changes

**Read `node_modules/next/dist/docs/` before writing any Next.js code.** Key breaks from prior versions:

### Async Request APIs (fully removed sync access)

`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are all **Promises** — must be awaited:

```tsx
// page.tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
}
// Use `npx next typegen` to get typed PageProps<'/path/[slug]'> helpers
```

### Lint

`next lint` is gone. Run `eslint` directly (config in `eslint.config.mjs`).

### Middleware → Proxy

`middleware.ts` is deprecated. Use `proxy.ts` instead. See `node_modules/next/dist/docs/01-app/api-reference/file-conventions/proxy.md`.

### Turbopack default

`next dev` and `next build` both use Turbopack. Custom `webpack` config in `next.config.ts` will break builds. Migrate to Turbopack options or pass `--webpack` flag.

### Instant navigation

To guarantee instant client-side navigation, export `unstable_instant` from routes **and** place `<Suspense>` boundaries correctly. See `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`.

## App Router Conventions

- `app/layout.tsx` — root layout (wraps all routes)
- `app/page.tsx` — renders at `/`
- `app/loading.tsx` — Suspense skeleton for a segment
- `app/error.tsx` — error boundary (must be `'use client'`)
- `app/route.ts` — API endpoint
- `(group)/` folders — organize routes without affecting URL
- `_folder/` — private, non-routable files (components, utils)

Server Components are default. Add `'use client'` only when needing state, event handlers, lifecycle effects, or browser APIs.

## Project Structure

```
app/
  page.tsx                      # home / landing
  about/page.tsx                # about + contact
  auth/page.tsx                 # auth
  games/page.tsx                # library (cards from Supabase `games`)
  games/[id]/page.tsx           # game detail + top-5 scores strip
  games/[id]/play/page.tsx      # play page (canvas + HUD + leaderboard modal)
  hall-of-fame/page.tsx         # global leaderboards
  api/scores/route.ts           # POST score (validates nickname 1–20, score ≥ 0 int)
  api/contact/route.ts          # contact form
  _components/Nav.tsx
  _lib/
    game-engines.ts             # registry: id → lazy() canvas component
    user-context.tsx
    supabase/{client,server,queries,types}.ts
  _games/<id>/<PascalId>Canvas.tsx   # React wrapper per game
public/games/<id>/game.js       # vanilla JS engine + assets/
specs/NN-<slug>.md              # spec-driven docs, one per feature/game
references/started-games/       # source engines fed to /add-game (02-asteroids, 03-tetris, 04-arkanoid)
```

## Game Integration Pattern

Each game = a vanilla `public/games/<id>/game.js` engine + a thin React client wrapper `app/_games/<id>/<PascalId>Canvas.tsx`. Wiring is generic: `GamePlayerClient`, `api/scores`, and `supabase/queries` never change per-game.

**Contract between engine and React** (see `AsteroidsCanvas.tsx` as the canonical example):

- Engine renders into `<canvas id="av-canvas" width=800 height=600>`.
- Engine emits CustomEvents on `window`: `av:score` `{score}`, `av:lives` `{lives}`, `av:level` `{level}`, `av:gameOver` `{score}`. Omit lives/level events for games without them.
- Engine exposes `window.<ID_UPPER> = { pause(), resume(), restart() }`.
- Engine must NOT draw its own "GAME OVER" overlay — the React modal handles it.
- Wrapper uses `forwardRef` + `useImperativeHandle` → `window.<ID_UPPER>`, registers the four `av:*` listeners, injects the `<script>`, and cleans up (remove listeners, pause, delete global, remove script) on unmount.

**To register a game:** add `<id>: lazy(() => import("../_games/<id>/<PascalId>Canvas"))` to `GAME_ENGINES` in `app/_lib/game-engines.ts`, and INSERT a row into the Supabase `games` table.

Don't add games by hand — run `/add-game` to produce the spec first, then `/spec-impl`.

## Supabase

- Clients: `_lib/supabase/server.ts` (RSC/route handlers) and `client.ts` (browser). All reads go through `_lib/supabase/queries.ts`.
- Tables: `games` (`id, title, short, long, cat, cover, color, created_at`) and `scores` (`id, game_id, nickname, score, created_at`). Types in `_lib/supabase/types.ts`.
- `cat` ∈ `ARCADE | PUZZLE | SHOOTER | VERSUS`; `color` accent ∈ `cyan | magenta | yellow | green`.
- MCP `supabase` server is enabled — use it for schema inspection and migrations (`list_tables` first, `get_advisors`/`get_logs` for debugging).
