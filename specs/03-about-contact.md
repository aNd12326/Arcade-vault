# SPEC 03 — About Page + Envío de Correo

> **Status:** Implemented · **Depende de:** 02-home-landing · **Fecha:** 2026-06-06
> **Objetivo:** Implementar la página `/about` con sección "Acerca de" y formulario de contacto
> que envía correos reales vía Resend a `andersonventosilla0@gmail.com`.

---

## Scope

**In:**

- `app/about/page.tsx` — NUEVO. Página `/about` con sección hero "Acerca de" +
  divider animado + sección "Contacto" con form. `'use client'` por estado del form
  e IntersectionObserver. Fiel al template `references/templates/home-about/about.jsx`.
- `app/about/page.tsx` — Componentes internos: `HighlightIcon` (HEART/BROWSER/PLANT),
  highlight-row, divider pixel, terminal-success state.
- `app/api/contact/route.ts` — NUEVO. Route handler POST. Recibe `{ name, email, msg }`,
  llama Resend SDK, envía a `andersonventosilla0@gmail.com`. Devuelve 200/500 JSON.
- `app/globals.css` — Agregar al final el bloque CSS de About del template:
  `.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`,
  `.highlight`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`,
  `.contact-grid`, `.contact-intro`, `.contact-title`, `.contact-sub`, `.contact-tips`,
  `.contact-form`, `.terminal-success`, `.term-bar`, `.term-body`, `.btn.press`,
  `@keyframes shake`, `@keyframes pxblink`.
- `.env.local` — NUEVO. Variable `RESEND_API_KEY=` (valor vacío; usuario la completa).
- `app/_components/Nav.tsx` — Agregar link `ABOUT → /about` después de `GAMES`.
- `package.json` — Agregar dependencia `resend`.

**Out of scope:**

- Autenticación del formulario (rate limiting, CAPTCHA).
- Email de confirmación al remitente.
- Persistencia de mensajes en BD.
- Tests automatizados.
- Cambios en otras rutas.

---

## Data model

No se introducen tipos de BD ni esquemas de persistencia. Un único tipo inline:

```ts
// app/api/contact/route.ts
interface ContactPayload {
  name: string
  email: string
  msg: string
}
```

Estados del form en `app/about/page.tsx`:
- `form: { name, email, msg }` — string vacío inicial
- `status: 'idle' | 'sending' | 'sent' | 'error'` — controla UI (idle→form, sending→botón
  deshabilitado, sent→terminal-success, error→mensaje inline)
- `shake: boolean` — animación shake en validación client-side

Variables de entorno:
- `RESEND_API_KEY` — string, solo server-side (Route Handler). No exponer al cliente.

---

## Implementation plan

1. **Instalar Resend** — `npm install resend`. Verificar: aparece en `package.json`.

2. **Variable de entorno** — Crear `.env.local` con `RESEND_API_KEY=`. Verificar:
   archivo existe, no commiteado (`.gitignore` ya incluye `.env*.local`).

3. **CSS About** — Agregar al final de `app/globals.css` el bloque de estilos About
   del template (`references/templates/home-about/styles.css` líneas 1071–1146):
   `.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`,
   `.highlight`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`,
   `.contact-grid`, `.contact-intro`, `.contact-title`, `.contact-sub`, `.contact-tips`,
   `.contact-form`, `.terminal-success`, `.term-bar`, `.term-body`, `.btn.press`,
   `@keyframes shake`, `@keyframes pxblink`. Verificar: `npm run dev` sin errores CSS.

4. **Route handler** — Crear `app/api/contact/route.ts`. POST recibe `{ name, email, msg }`,
   valida que los tres campos estén presentes (400 si falta alguno), llama `resend.emails.send`
   con `from: 'onboarding@resend.dev'`, `to: 'andersonventosilla0@gmail.com'`, subject y
   body HTML con los datos. Devuelve `{ ok: true }` 200 o `{ ok: false }` 500.
   Verificar: `curl -X POST /api/contact` con payload válido → 200.

5. **Página About** — Crear `app/about/page.tsx` (`'use client'`). Traducir template
   `about.jsx` a TSX: sección hero con kicker + título + misión + highlight-row
   (3 cards con `HighlightIcon`), divider animado, sección contacto con grid
   intro+form. Form llama `fetch('/api/contact')` en submit; estado `sending` bloquea
   botón; `sent` → terminal-success con nombre; `error` → mensaje inline rojo bajo botón.
   IntersectionObserver en `useEffect` sobre `.reveal`. Verificar: página carga en `/about`,
   todas las secciones visibles, animaciones `.reveal` funcionan.

6. **Nav** — Agregar link `ABOUT → /about` en `app/_components/Nav.tsx` después de `GAMES`.
   Verificar: link aparece en desktop y menú hamburguesa; activo en `/about`.

---

## Acceptance criteria

- [ ] `npm run dev` arranca sin errores de compilación ni consola.
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `.env.local` existe con `RESEND_API_KEY=` (valor vacío).
- [ ] `resend` aparece en `package.json` dependencies.
- [ ] `/about` carga y muestra sección hero con kicker "▸ ACERCA DE", título y texto misión.
- [ ] Highlight-row muestra 3 cards (HEART/BROWSER/PLANT) con íconos SVG pixel.
- [ ] Divider animado visible entre sección hero y sección contacto.
- [ ] Sección contacto muestra grid: intro izquierda + form derecha.
- [ ] Tips "RESPUESTA EN 24-48H / SUGERENCIAS BIENVENIDAS / SIN SPAM, JAMÁS" visibles.
- [ ] Form valida campos vacíos: shake animation, no envía.
- [ ] Botón "ENVIAR MENSAJE" muestra estado deshabilitado/loading durante envío.
- [ ] Submit exitoso → muestra terminal-success con nombre del usuario en mayúsculas.
- [ ] "ENVIAR OTRO MENSAJE" resetea form y vuelve a estado idle.
- [ ] Submit con Resend fallido → mensaje de error inline bajo el botón.
- [ ] POST `/api/contact` con payload válido devuelve 200 `{ ok: true }`.
- [ ] POST `/api/contact` sin campos devuelve 400.
- [ ] `RESEND_API_KEY` no expuesta al cliente (no en bundle JS).
- [ ] Nav muestra `INICIO · GAMES · ABOUT · SALÓN` en ese orden.
- [ ] Link ABOUT activo en `/about` en desktop y hamburguesa.
- [ ] Elementos `.reveal` animan fade+slide al entrar en viewport.

---

## Decisions

- **Sí:** `from: 'onboarding@resend.dev'` mientras no haya dominio propio. Resend sandbox
  solo entrega a emails verificados en la cuenta; suficiente para desarrollo.
- **Sí:** Route Handler (`app/api/contact/route.ts`) en lugar de Server Action. Más
  explícito, testeable con curl, y evita exponer lógica Resend en el bundle cliente.
- **Sí:** `status: 'idle' | 'sending' | 'sent' | 'error'` como máquina de estados simple.
  Cubre todos los estados del form sin librería externa.
- **Sí:** Error inline bajo el botón (no toast, no modal). Consistente con UX del form
  ya definida en el template.
- **Sí:** Componentes internos (`HighlightIcon`) en `app/about/page.tsx`, no exportados.
  Específicos de esta página.
- **No:** Rate limiting / CAPTCHA en este spec. Complejidad fuera de scope — se puede
  agregar en spec separado cuando haya dominio propio en producción.
- **No:** Email de confirmación al remitente. No pedido, agrega complejidad Resend.

---

## Risks

- **Resend sandbox:** `onboarding@resend.dev` solo entrega a emails verificados en la
  cuenta Resend. Si `andersonventosilla0@gmail.com` no está verificado allí, los emails
  no llegarán. Solución: verificar el email en el dashboard de Resend antes de probar.
- **`.env.local` vacío:** Con `RESEND_API_KEY=` vacío el envío fallará con 401. Expected —
  el usuario debe colocar la key real antes de probar el envío.
