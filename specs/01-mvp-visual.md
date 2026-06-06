# SPEC 01 — MVP Visual Arcade Vault

> **Status:** Implementado · **Depende de:** ninguno · **Fecha:** 2026-06-06
> **Objetivo:** Implementar todas las pantallas visuales de Arcade Vault en Next.js 16 App Router, sin lógica de juego real, con navegación entre rutas, estado de usuario en localStorage y animaciones del template originales.

---

## Scope

**In:**

- `app/page.tsx` — Biblioteca: hero, búsqueda por nombre, filtro por categoría, grid de GameCards con efecto tilt.
- `app/games/[id]/page.tsx` — Detalle: portada CSS, tags, stats strip, leaderboard lateral con scores semilla.
- `app/games/[id]/play/page.tsx` — Reproductor: HUD (score/vidas/nivel), CRT con arena animada, ticker de puntuación, modal Game Over con guardado de nombre.
- `app/auth/page.tsx` — Auth: tabs Login/Registro, campos, botón invitado, botones sociales (sin backend).
- `app/hall-of-fame/page.tsx` — Salón de la Fama: pódium top-3, tabla completa, pestañas por juego, fila destacada si hay usuario.
- `app/_components/Nav.tsx` — Navbar sticky con logo, links activos, contador de créditos, menú hamburguesa móvil.
- `app/_lib/data.ts` — Datos mock: GAMES (8 juegos), CATS, seededScores.
- `app/_lib/user-context.tsx` — UserContext con login/signOut/saveScore, persistencia en localStorage.
- `app/globals.css` — Estilos ya presentes; ajuste menor: reemplazar `#root` por `.av-root`.
- `app/layout.tsx` — Layout raíz: capas `.av-bg` / `.av-noise`, Nav, footer, wrapper `.av-root`.

**Out of scope (para futuros specs):**

- Lógica real de cualquier juego.
- Backend, base de datos o autenticación real.
- Sistema de créditos funcional.
- Scores reales guardados por juego por usuario.
- Rutas de error (`not-found.tsx`, `error.tsx`) con diseño Arcade.
- Tests automatizados.
- PWA / modo offline.

---

## Data model

```ts
// app/_lib/data.ts

type Game = {
  id: string;        // slug único, ej. "bloque-buster"
  title: string;     // nombre en mayúsculas
  short: string;     // descripción corta para GameCard
  long: string;      // descripción larga para Detalle
  cat: string;       // "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover: string;     // clase CSS, ej. "cover-bricks"
  color: string;     // "cyan" | "magenta" | "yellow" | "green"
  best: number;      // mejor puntuación global (mock)
  plays: string;     // partidas jugadas (mock), ej. "12.4K"
};

type ScoreRow = {
  rank: number;
  name: string;   // de la lista PLAYERS
  score: number;
  date: string;   // "DD/MM/2026"
};

// seededScores(seed, count) → ScoreRow[]
// Algoritmo determinista: misma seed = mismos resultados siempre.
```

```ts
// app/_lib/user-context.tsx

type User = { name: string } | null;

// localStorage keys:
//   "av_user"   → JSON User | null
//   "av_scores" → JSON Array<{ game: string; score: number; name: string; at: number }>
```

Esta feature no introduce nuevas rutas de API ni esquemas de DB.

---

## Implementation plan

1. **Datos y tipos** — Crear `app/_lib/data.ts` con `GAMES`, `CATS`, `PLAYERS`, `seededScores`. Sin dependencias externas. Verificar: importar en consola TS sin errores (`npx tsc --noEmit`).

2. **UserContext** — Crear `app/_lib/user-context.tsx` (`'use client'`) con `UserProvider`, `useUser`, persistencia en `localStorage`. Verificar: sin errores de tipo.

3. **CSS raíz** — En `app/globals.css` reemplazar selector `#root` por `.av-root` (2 ocurrencias). Verificar: sin cambios visuales en el resto.

4. **Layout raíz** — Actualizar `app/layout.tsx`: añadir `<div className="av-bg"/>`, `<div className="av-noise"/>`, `<UserProvider>`, `<div className="av-root">`, `Nav`, footer. Verificar: `npm run dev` carga sin errores.

5. **Nav** — Crear `app/_components/Nav.tsx` (`'use client'`) con `Link` de Next.js, `usePathname` para estado activo, menú hamburguesa móvil, botón signOut si hay usuario. Verificar: links navegan correctamente entre rutas.

6. **Biblioteca (home)** — Reemplazar `app/page.tsx` (`'use client'`) con hero, búsqueda, chips de categoría, grid con `GameCard` (efecto tilt via `useRef`). Verificar: filtros funcionan, click en tarjeta navega a `/games/[id]`.

7. **Detalle** — Crear `app/games/[id]/page.tsx` (Server Component, `await params`) que pasa `game` y `scores` a `app/games/[id]/GameDetailClient.tsx` (`'use client'`). Verificar: URL `/games/caida` muestra datos correctos, botón "JUGAR AHORA" navega a `/games/caida/play`.

8. **Reproductor** — Crear `app/games/[id]/play/page.tsx` (Server Component) + `app/games/[id]/play/GamePlayerClient.tsx` (`'use client'`) con ticker `setInterval`, pausa, modal Game Over, guardado de nombre via `saveScore`. Verificar: score sube, pausa detiene ticker, modal aparece al pulsar FIN.

9. **Auth** — Crear `app/auth/page.tsx` (`'use client'`) con tabs Login/Registro, campo email condicional, submit llama `login()` y redirige a `/`. Verificar: nombre queda en Nav tras login, "JUGAR COMO INVITADO" también redirige.

10. **Salón de la Fama** — Crear `app/hall-of-fame/page.tsx` (`'use client'`) con pódium top-3, tabla animada, pestañas por juego, fila amarilla si hay usuario. Verificar: cambiar pestaña actualiza pódium y tabla, fila del usuario aparece solo si está logueado.

---

## Acceptance criteria

- [ ] `npm run dev` arranca sin errores de compilación ni de consola.
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `/` muestra el hero, grid de 8 juegos y los filtros por categoría.
- [ ] Buscar "CAÍDA" en el input filtra la grid a un solo resultado.
- [ ] Click en una GameCard navega a `/games/[id]`.
- [ ] `/games/bloque-buster` muestra la portada CSS correcta, stats strip y leaderboard de 10 filas.
- [ ] Botón "JUGAR AHORA" en Detalle navega a `/games/bloque-buster/play`.
- [ ] En `/games/[id]/play` el score sube automáticamente cada ~220 ms.
- [ ] Botón "PAUSA" detiene el ticker; "REANUDAR" lo reactiva.
- [ ] Botón "FIN" muestra el modal Game Over con la puntuación final.
- [ ] En el modal se puede editar el nombre y pulsar "GUARDAR PUNTUACIÓN"; aparece el toast `▸ PUNTUACIÓN GUARDADA_`.
- [ ] `/auth` muestra el formulario; al hacer submit navega a `/` y el nombre aparece en el Nav.
- [ ] "JUGAR COMO INVITADO" en `/auth` redirige a `/` sin nombre en el Nav.
- [ ] Recargar la página mantiene la sesión del usuario (localStorage).
- [ ] `/hall-of-fame` muestra pódium top-3 y tabla de 12 filas para el primer juego.
- [ ] Cambiar de pestaña en Salón de la Fama actualiza pódium y tabla.
- [ ] Si hay usuario logueado, la fila amarilla con su nombre aparece al final de la tabla.
- [ ] El Nav marca el link activo correcto en cada ruta.
- [ ] El menú hamburguesa abre y cierra en viewport < 840 px.
- [ ] URL inexistente (`/games/xyz`) devuelve 404 de Next.js (sin diseño custom).

---

## Decisions

- **Sí:** Rutas de archivo Next.js (`/games/[id]`, etc.) en lugar de hash routing del HTML original. El App Router es idiomático, facilita SEO y futuros cambios.
- **Sí:** Server Components como wrapper en rutas dinámicas (`await params`) + Client Component hijo para interactividad. Patrón correcto en Next.js 16.
- **Sí:** `app/_components/` para componentes compartidos. Carpeta privada (no enrutable), co-localizada con App Router.
- **Sí:** `UserContext` + `localStorage` para persistencia de sesión. Suficiente para MVP sin backend.
- **Sí:** Ticker de puntuación (`setInterval`) en Reproductor incluido tal cual. Es parte de la experiencia visual del template.
- **No:** Autenticación real (OAuth, JWT, etc.). Fuera de scope de este MVP.
- **No:** `app/not-found.tsx` con diseño Arcade. Queda el 404 default de Next.js; otro spec si se necesita.
- **No:** `components/` en raíz del proyecto. Menos idiomático con App Router.

---

## What is **not** in this spec

- Lógica real de cualquier juego.
- Backend, autenticación real o base de datos.
- Diseño de página 404 con tema Arcade.
- Tests automatizados.
- PWA o modo offline.

Cada uno de esos, si llega, va en su propio spec.
