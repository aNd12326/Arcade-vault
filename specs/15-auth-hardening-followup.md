# SPEC 15 — Auth Hardening (follow-up)

> **Status:** Implemented · **Depende de:** SPEC 12 (Auth registro/login), SPEC 13 (Perfil/avatar), SPEC 14 (Seguridad/Hardening) · **Fecha:** 2026-06-08
> **Objetivo:** Cerrar los hallazgos de la auditoría de autenticación posterior a SPEC 14: aplicar la política de contraseñas también en el flujo de recuperación, eliminar el open-redirect del callback OAuth/email, sanear el error de nickname duplicado en signup, y endurecer/documentar el rate-limit. Activar la protección de contraseñas filtradas (advisor aún abierto).

---

## Contexto

Auditoría en vivo de la capa de auth (lectura de `app/auth/AuthForm.tsx`, `app/auth/page.tsx`, `app/auth/callback/route.ts`, `app/auth/reset/page.tsx`, `app/api/signup/route.ts`, `proxy.ts`, `app/_lib/supabase/{server,client,middleware-session}.ts`, `app/_lib/password.ts` + MCP Supabase `get_advisors`, `pg_policies`, `pg_constraint`).

**Base sólida ya existente (sin acción):** RLS habilitado en `games`/`scores`/`profiles`; policies de `profiles` con write scoped a `auth.uid() = id`; `profiles.nickname` con constraint `UNIQUE`; cookies vía `@supabase/ssr`; sólo la publishable key en cliente (sin service-role); ningún `.env` versionado.

| Hallazgo                                              | Severidad | Estado real                                                                                                       |
| ----------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| Reset password salta la política de fuerza            | Media     | `reset/page.tsx:52` `setNewPassword` llama `updateUser({ password })` sin `isStrongPassword()` ni `minLength`     |
| Open redirect en callback                             | Media     | `callback/route.ts:11,17` redirige a `${origin}${next}` con `next` de query sin validar                           |
| Leaked Password Protection desactivado                | Baja      | Advisor `auth_leaked_password_protection` sigue en WARN (paso manual de SPEC 14 no aplicado)                      |
| Rate-limit en memoria / por-instancia / XFF spoofable | Baja      | `proxy.ts:8,10` — sólo `/api/signup`; sign-in y reset sin barrera de app                                          |
| Signup TOCTOU filtra error de DB crudo                | Baja      | `signup/route.ts:34-57` check-then-signUp; el `UNIQUE` cubre integridad pero `error.message` se filtra al cliente |

---

## Scope

**In:**

- `app/auth/reset/page.tsx` — En `setNewPassword`, validar `isStrongPassword(pass)` antes de `updateUser`; si falla, `setError(PASSWORD_HINT)` y `return`. Añadir hint visible bajo el campo de nueva contraseña.
- `app/auth/callback/route.ts` — Sanear `next`: aceptar sólo rutas relativas same-origin (empieza por `/`, no por `//` ni `/\`); cualquier otra cosa → `/`.
- `app/api/signup/route.ts` — Mapear el fallo de nickname duplicado (violación de `UNIQUE`/error de Supabase) a un 409 con mensaje limpio; no reenviar `error.message` crudo de Postgres al cliente.
- **Manual (documentado, no código):** Supabase Auth → activar Leaked Password Protection (HaveIBeenPwned). Pendiente desde SPEC 14.

**Fuera de alcance (para futuros specs):**

- Store externo (Redis/Upstash) para el rate-limiter — sigue documentado como riesgo desde SPEC 14.
- Rate-limit de `signInWithPassword` y `resetPasswordForEmail` a nivel de app — se delega a los límites built-in de Supabase Auth (ver Decisions).
- CAPTCHA, 2FA, rotación de secretos.
- Reescritura de RLS / OAuth provider audit.

---

## Data model

Sin tablas ni columnas nuevas. Sin migraciones de DB (la constraint `UNIQUE` en `profiles.nickname` ya existe).

---

## Implementation plan

1. **Reset password — política de fuerza** (`app/auth/reset/page.tsx`):
   - Importar `isStrongPassword`, `PASSWORD_HINT` de `app/_lib/password.ts`.
   - En `setNewPassword`, antes de `supabase.auth.updateUser({ password: pass })`:
     ```ts
     if (!isStrongPassword(pass)) {
       setError(PASSWORD_HINT);
       return;
     }
     ```
   - Renderizar `PASSWORD_HINT` (mismo estilo `mono` que en `AuthForm`) bajo el campo "Nueva contraseña".
   - Test: en el form de recovery, contraseña `abc` → error inline, sin llamada a `updateUser`.

2. **Callback — saneo de `next`** (`app/auth/callback/route.ts`):

   ```ts
   const raw = searchParams.get("next") ?? "/";
   const next =
     raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
       ? raw
       : "/";
   ```

   Usar `next` saneado en ambos `NextResponse.redirect`.
   Test: `?next=//evil.com` y `?next=https://evil.com` → redirige a `${origin}/`; `?next=/games` → redirige a `${origin}/games`.

3. **Signup — error de nickname duplicado limpio** (`app/api/signup/route.ts`):
   - El pre-check `taken` cubre el caso común; mantener.
   - Tras `signUp`, si `error` corresponde a violación de unicidad / usuario ya existente, responder un mensaje fijo (ej. "Ese nickname ya está tomado." o "No se pudo crear la cuenta.") en vez de `error.message` crudo. No exponer texto de Postgres.
   - Test: dos signups concurrentes con el mismo nickname → el perdedor recibe 409 con mensaje limpio, sin string de error de DB.

4. **Supabase Auth dashboard (manual):**
   - Authentication → Password security → Enable Leaked Password Protection (HaveIBeenPwned).
   - Test: `get_advisors(security)` ya no lista `auth_leaked_password_protection`.

---

## Acceptance criteria

- [ ] Recovery con contraseña débil (sin mayúscula/minúscula/dígito/símbolo o <8) → bloqueado en cliente con `PASSWORD_HINT`, sin llamada a `updateUser`.
- [ ] El campo de nueva contraseña en `/auth/reset` muestra el hint de requisitos.
- [ ] `/auth/callback?next=//evil.com` (y variantes `https://`, `/\`) redirige a la propia app, nunca a host externo; `next` relativo válido sí se respeta.
- [ ] Signup con nickname ya tomado (incl. carrera) → 409 con mensaje fijo; el cliente nunca recibe texto de error de Postgres.
- [ ] `get_advisors(security)` no devuelve `auth_leaked_password_protection`.
- [ ] `npx tsc --noEmit` y `eslint` pasan sin errores.

---

## Decisions

- **Sí:** aplicar `isStrongPassword` también en recovery. La política de SPEC 14 sólo cubría registro; el flujo de reset era un bypass.
- **Sí:** whitelist de `next` a ruta relativa same-origin en vez de blacklist. Evita open-redirect vía links de confirmación/OAuth manipulados.
- **No:** rate-limit de app sobre sign-in y reset. Supabase Auth ya aplica límites propios a esas rutas (van directo al cliente Supabase, no pasan por `/api/*`); duplicarlo en `proxy.ts` en memoria aporta poco. Se documenta como decisión, no como gap.
- **No:** reemplazar el rate-limiter en memoria por un store externo. Sigue fuera de alcance (heredado de SPEC 14, Risks).
- **Sí:** Leaked Password Protection como paso manual de dashboard. El MCP de Supabase no escribe config de Auth (igual que SPEC 14).

---

## Risks

| Riesgo                                                             | Mitigación                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Rate-limiter en memoria sigue siendo per-instancia / XFF spoofable | Heredado y documentado en SPEC 14. Store externo y validación de IP de confianza, fuera de alcance.      |
| Cuentas previas con contraseñas débiles                            | La política de recovery sólo aplica al fijar una contraseña nueva; las existentes no se fuerzan a rotar. |
| `next` legítimos con `//` (poco probable) quedarían a `/`          | Las rutas internas de la app no usan `//`; el coste de un redirect a home es aceptable.                  |

---

## Qué **no** está en este spec

- Store externo (Redis/Upstash) para el rate-limiter.
- Rate-limit de app sobre sign-in / reset email.
- CAPTCHA, 2FA, rotación de secretos.
- Reescritura de RLS policies / auditoría de providers OAuth.
- Content-Security-Policy completa.

Cada uno, si llega, va en su propio spec.
