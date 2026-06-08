# SPEC 14 — Seguridad / Hardening

> **Status:** Approved · **Depende de:** SPEC 04 (Supabase), SPEC 12 (Auth registro/login), SPEC 03 (About/Contact) · **Fecha:** 2026-06-08
> **Objetivo:** Endurecer la seguridad de Arcade Vault aplicando hardening de la función `rls_auto_enable`, headers HTTP, política de contraseñas (regex en cliente + config Supabase), rate-limit de signup por IP y saneado del endpoint de contacto.

---

## Contexto

El checklist de `references/security/security-checklist.md` más una auditoría en vivo (MCP Supabase `list_tables` + `get_advisors`, `next.config.ts`, `app/api/scores/route.ts`, `app/api/contact/route.ts`, `app/auth/page.tsx`) dejó esta foto:

| Ítem del checklist             | Estado real                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| RLS en `games`/`scores`        | **Ya habilitado** (también en `profiles`); hay policies (sin advisor `rls_no_policy`) → sin acción |
| Headers de seguridad (Next)    | **Faltan** — `next.config.ts` no define ninguno                                                    |
| Min password length 8          | Ajuste de Supabase Auth (dashboard)                                                                |
| Leaked password protection     | **Desactivado** (advisor `auth_leaked_password_protection`)                                        |
| Max signup rate / IP           | No implementado                                                                                    |
| Advisor `rls_auto_enable()` ×2 | Función `SECURITY DEFINER` ejecutable por `anon` + `authenticated`                                 |

Hallazgos extra (no estaban en el checklist, incluidos por decisión del usuario):

- `app/api/contact/route.ts` interpola `name`/`email`/`msg` crudos dentro del HTML del correo → inyección HTML; además no valida formato de email.
- Petición del usuario: validación de contraseña por **expresión regular** en el formulario de **registro** (minúscula + mayúscula + dígito + símbolo + mínimo 8) con mensaje de error inline que **bloquea el envío** antes de llamar a Supabase.

---

## Scope

**In:**

- `supabase` — Migración que ejecuta `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;` (cierra los 2 advisor warns; conserva la función).
- `next.config.ts` — `headers()` async con `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` para todas las rutas.
- `app/_lib/password.ts` (nuevo) — `isStrongPassword(pw)` + constante `PASSWORD_HINT`.
- `app/auth/page.tsx` — Validar `isStrongPassword(pass)` en la rama de registro antes de `signUp`; mostrar hint bajo el campo de contraseña en la pestaña de registro. Login no valida regex.
- `app/api/contact/route.ts` — `escapeHtml()` sobre `name`/`email`/`msg` + validación de email; 400 si el email es inválido.
- `proxy.ts` (nuevo, raíz) — Rate-limit de signup por IP (Next 16 reemplazo de middleware).
- **Manual (documentado, no código):** Supabase Auth → min password length = 8 y activar Leaked Password Protection.

**Fuera de alcance (para futuros specs):**

- Rotación/gestión de secretos (`RESEND_API_KEY`, claves Supabase).
- CAPTCHA y 2FA.
- Reescritura de RLS policies (ya correctas).
- Auditoría de los providers OAuth (Google/GitHub).
- Content-Security-Policy completa (solo los 3 headers del checklist).
- Store externo (Redis/etc.) para el rate-limiter — ver Riesgos.

---

## Data model

Sin tablas ni columnas nuevas.

El rate-limiter de `proxy.ts` mantiene estado **en memoria del proceso**, efímero por instancia:

```ts
// proxy.ts — estructura en memoria (no persistida)
const hits = new Map<string, { count: number; resetAt: number }>();
// key = IP del cliente; ventana deslizante simple por timestamp
```

Convenciones:

- IP tomada de `x-forwarded-for` (primer valor) con fallback a `x-real-ip`.
- Ventana y límite como constantes en el archivo (ej. 5 signups / 10 min).

---

## Implementation plan

1. **Migración DB** (`mcp__supabase__apply_migration`, nombre `revoke_rls_auto_enable_execute`):
   `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;`
   Test: `get_advisors(security)` ya no lista los 2 warns de `rls_auto_enable`.
2. **Headers** en `next.config.ts`: añadir `headers()` async devolviendo, para `source: '/(.*)'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. (Compatible Turbopack; sin `webpack`.)
   Test: `curl -I localhost:3000` muestra los 3 headers.
3. **Util de contraseña**: crear `app/_lib/password.ts` con regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$`, `isStrongPassword(pw)` y `PASSWORD_HINT` (mensaje en español: requisitos).
4. **UI auth** (`app/auth/page.tsx`): en `submit`, rama `tab === "up"`, validar `isStrongPassword(pass)` antes del chequeo de nickname/`signUp`; si falla, `setError(PASSWORD_HINT)` y `return`. Añadir hint visible bajo el campo de contraseña solo en pestaña de registro. Login (`tab === "in"`) **no** valida regex.
   Test: registro con `abc` → error inline, sin request a Supabase.
5. **Contact hardening** (`app/api/contact/route.ts`): helper `escapeHtml()` aplicado a `name`/`email`/`msg` antes de interpolar; validar `email` con regex; devolver 400 si es inválido.
   Test: payload con `<script>` en `name` llega escapado; email sin `@` → 400.
6. **Rate-limit signup** (`proxy.ts` raíz): leer `node_modules/next/dist/docs/01-app/api-reference/file-conventions/proxy.md` antes de escribir. Limitador por IP aplicado a la ruta de signup; al exceder, responder 429.
   Test: N+1 intentos desde misma IP en la ventana → 429.
7. **Supabase Auth dashboard (manual):**
   - Authentication → Policies/Settings → Minimum password length = `8`.
   - Authentication → Password security → Enable Leaked Password Protection (HaveIBeenPwned).
     Test: `get_advisors(security)` ya no lista `auth_leaked_password_protection`.

---

## Acceptance criteria

- [ ] `get_advisors(security)` no devuelve ninguno de los 3 warns actuales (`anon`/`authenticated` `rls_auto_enable`, `auth_leaked_password_protection`).
- [ ] La respuesta HTTP de cualquier ruta incluye `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- [ ] Registro con contraseña sin mayúscula, sin minúscula, sin dígito, sin símbolo o con <8 caracteres → bloqueado en cliente con mensaje, sin llamada a Supabase.
- [ ] El login de una cuenta existente no se ve afectado por el regex de contraseña.
- [ ] `api/contact` con `<script>` en cualquier campo → escapado en el correo; email con formato inválido → 400.
- [ ] N+1 signups desde la misma IP dentro de la ventana → rechazado (429) por `proxy.ts`.
- [ ] Min password length = 8 y Leaked Password Protection activos en Supabase.
- [ ] `npx tsc --noEmit` y `eslint` pasan sin errores.

---

## Decisions

- **Sí:** REVOKE EXECUTE sobre `rls_auto_enable` en vez de DROP. Conserva el helper por si se reutiliza; cierra el advisor igual.
- **No:** tocar RLS de las tablas. Ya está habilitado y con policies.
- **Sí:** rate-limit en `proxy.ts` propio. Más control que los límites built-in de Supabase Auth.
- **Sí:** regex de contraseña solo en registro. Aplicarlo en login rompería cuentas creadas antes de la política.
- **Sí:** config de Auth (min-pass, leaked-password) como pasos manuales de dashboard. El MCP de Supabase no escribe config de Auth.
- **Sí:** escapar HTML en `api/contact` aunque no estaba en el checklist. Es una inyección real de bajo costo de arreglar.
- **No:** CSP completa. Solo los 3 headers del checklist; CSP va en otro spec si llega.

---

## Risks

| Riesgo                                                          | Mitigación                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rate-limiter en memoria no es multi-instancia (serverless/edge) | Documentado. Sirve como primera barrera; un store externo (Redis) queda fuera de alcance. |
| `X-Frame-Options: DENY` rompe embeds en iframe                  | Hoy no hay embeds. Si se necesitan, cambiar a `SAMEORIGIN` en otro spec.                  |
| Cuentas previas con contraseñas débiles                         | El regex es solo de registro; las existentes siguen funcionando hasta un eventual reset.  |

---

## Qué **no** está en este spec

- Rotación de secretos y gestión de claves.
- CAPTCHA y 2FA.
- Content-Security-Policy completa.
- Store externo para el rate-limiter.
- Reescritura de RLS policies.

Cada uno, si llega, va en su propio spec.
