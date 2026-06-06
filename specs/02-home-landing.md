# SPEC 02 — Home Page (Landing)

> **Status:** Approved · **Depende de:** 01-mvp-visual · **Fecha:** 2026-06-06
> **Objetivo:** Implementar la landing page en `/` con hero fullscreen, secciones de features/juegos/stats/actividad/precios y CTA final, moviendo la Biblioteca actual a `/games`, y actualizando el Nav para reflejar la nueva estructura de rutas.

---

## Scope

**In:**

- `app/page.tsx` — Reemplazado con nueva Home: hero fullscreen con siluetas flotantes,
  sección "¿Por qué Arcade Vault?" (4 feature cards), sección "Juegos disponibles ahora"
  (mini-rail 6 juegos), stats strip (12+ juegos / MILES de partidas / GLOBAL ranking),
  sección "Actividad en vivo" (ticker mock + top-5 mock), sección "Precios" (pricing card
  + 3 FAQ), final CTA. Todo `'use client'` por IntersectionObserver y tilt/hover.
- `app/games/page.tsx` — NUEVO archivo: contenido de la Biblioteca actual (`app/page.tsx`)
  movido aquí sin cambios funcionales.
- `app/_components/Nav.tsx` — Actualizar links: añadir `INICIO → /`, renombrar link de
  biblioteca a `GAMES → /games`. Orden: INICIO · GAMES · SALÓN.
- `app/globals.css` — Añadir al final las clases CSS del template home: `.home`,
  `.home-hero`, `.home-silos`, `.home-section`, `.section-head`, `.feature-grid`,
  `.feature-card`, `.mini-rail`, `.mini-card`, `.home-stats`, `.stat-block`, `.home-final`,
  `.reveal`, `@keyframes float`, `@keyframes bounce`.

**Out of scope:**

- Página About/Contacto (`/about`) — spec separado.
- Lógica real de actividad (scores en vivo, WebSockets).
- Cambios en rutas `/games/[id]`, `/games/[id]/play`, `/auth`, `/hall-of-fame`.
- Tests automatizados.

---

## Data model

No se introducen tipos nuevos. La Home consume datos ya existentes:

- `GAMES` de `app/_lib/data.ts` — `slice(0, 6)` para el mini-rail.
- Datos de actividad (ticker + top jugadores) — arrays inline hardcodeados en `app/page.tsx`,
  idénticos al template. Sin persistencia, sin conexión a localStorage.

Esta feature no introduce nuevas rutas de API ni esquemas de DB.

---

## Implementation plan

1. **Mover Biblioteca a `/games`** — Crear `app/games/page.tsx` con el contenido actual
   de `app/page.tsx` sin cambios funcionales. Verificar: `/games` renderiza grid + búsqueda
   + filtros igual que antes.

2. **CSS de Home** — Añadir al final de `app/globals.css` las clases del template home:
   `.home`, `.home-hero`, `.home-silos`, `.home-section`, `.section-head`, `.feature-grid`,
   `.feature-card`, `.mini-rail`, `.mini-card`, `.home-stats`, `.stat-block`, `.home-final`,
   `.reveal`, `@keyframes float`, `@keyframes bounce`. Verificar: sin colisiones con clases
   existentes (`npx tsc --noEmit` y `npm run dev` sin errores).

3. **Componentes internos de Home** — En `app/page.tsx` (`'use client'`): implementar
   `FloatingSilhouettes` (8 SVGs pixel), `MiniCard`, `FeatureIcon` (4 variantes), y el
   hook `useReveal` (IntersectionObserver sobre `.reveal`). Todos como funciones internas
   del archivo, no exportadas.

4. **Home page** — Reemplazar `app/page.tsx` con el componente `HomePage` que renderiza
   las 6 secciones en orden: Hero · Features · Mini-rail · Stats · Actividad · Precios ·
   Final CTA. Navegación vía `useRouter`: "EXPLORAR JUEGOS" → `/games`, "CREAR CUENTA" →
   `/auth`, mini-cards → `/games/[id]`, "VER SALÓN" → `/hall-of-fame`.
   Verificar: todas las secciones renderizan, CTAs navegan correctamente, `.reveal` anima
   al hacer scroll.

5. **Actualizar Nav** — En `app/_components/Nav.tsx` añadir link `INICIO → /` como primer
   elemento, cambiar href de biblioteca a `/games` con label `GAMES`. Verificar: link activo
   correcto en `/`, `/games` y `/hall-of-fame`; menú hamburguesa incluye INICIO.

---

## Acceptance criteria

- [ ] `npm run dev` arranca sin errores de compilación ni de consola.
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `/` muestra el hero fullscreen con título de 3 líneas y siluetas flotantes animadas.
- [ ] Botón "EXPLORAR JUEGOS" en hero navega a `/games`.
- [ ] Botón "CREAR CUENTA" en hero navega a `/auth`.
- [ ] Sección "¿Por qué Arcade Vault?" muestra 4 feature cards con íconos SVG pixel.
- [ ] Sección "Juegos disponibles ahora" muestra mini-rail con los primeros 6 juegos.
- [ ] Click en mini-card navega a `/games/[id]`.
- [ ] Botón "VER TODOS LOS JUEGOS →" navega a `/games`.
- [ ] Sección Stats muestra 3 bloques: "12+", "MILES", "GLOBAL".
- [ ] Sección "Actividad en vivo" muestra ticker con 7 filas mock y top-5 jugadores mock.
- [ ] Botón "VER SALÓN →" navega a `/hall-of-fame`.
- [ ] Sección Precios muestra pricing card con lista de 6 beneficios y 3 FAQ.
- [ ] Botón "EMPEZAR GRATIS →" en Precios navega a `/auth`.
- [ ] Botón "INSERTAR MONEDA →" en Final CTA navega a `/games`.
- [ ] Secciones `.reveal` animan (fade + slide up) al entrar en viewport.
- [ ] `/games` sigue mostrando la Biblioteca (hero + búsqueda + filtros + grid de 8 juegos).
- [ ] Nav muestra `INICIO · GAMES · SALÓN` en ese orden.
- [ ] Link activo en Nav es correcto en `/`, `/games` y `/hall-of-fame`.
- [ ] Menú hamburguesa (< 840 px) incluye link INICIO.

---

## Decisions

- **Sí:** `/` pasa a ser la landing page nueva; Biblioteca se mueve a `/games`. Más
  idiomático — `/games` agrupa toda la experiencia de juegos bajo un mismo segmento de ruta.
- **Sí:** Nav link de biblioteca renombrado a `GAMES` (no `BIBLIOTECA`). Consistente con
  la ruta `/games` y el estilo en inglés del resto de labels del Nav.
- **Sí:** Datos de "Actividad en vivo" hardcodeados inline. Sin backend, sin localStorage —
  estético puro, igual al template original.
- **Sí:** Componentes internos (`FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, `useReveal`)
  definidos dentro de `app/page.tsx`, no exportados. Son específicos de esta página, no
  reutilizados en otro lado.
- **No:** Página About en este spec. Va en spec separado para mantener scope acotado.
- **No:** Actividad en vivo conectada a localStorage. Complejidad innecesaria para un dato
  puramente decorativo.
