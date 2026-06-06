# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Turbopack, port 3000)
npm run build    # production build (Turbopack)
npm run start    # serve production build
eslint           # lint (NOT `next lint` — replaced in v16)
npx tsc --noEmit # type-check
npx next typegen # generate PageProps/LayoutProps/RouteContext helpers
```

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
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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
