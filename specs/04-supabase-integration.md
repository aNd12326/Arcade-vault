# SPEC 04 — Integración Supabase

> **Status:** Aprovado · **Depende de:** 03-about-contact · **Fecha:** 2026-06-06
> **Objetivo:** Instalar y configurar el cliente Supabase (server + browser) como
> infraestructura base para specs futuros de auth, DB, real-time y Edge Functions.

---

## Scope

**In:**

- `package.json` — Agregar dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- `.env.local` — Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (valores reales del proyecto Supabase ya existente).
- `.env.template` — Agregar las mismas claves con valores vacíos como documentación.
- `app/_lib/supabase/server.ts` — NUEVO. Helper `createClient()` para Server Components
  y Route Handlers. Usa `createServerClient` de `@supabase/ssr` con `cookies()` de
  `next/headers` (awaitable — Next.js 16).
- `app/_lib/supabase/client.ts` — NUEVO. Helper `createClient()` para Client Components.
  Usa `createBrowserClient` de `@supabase/ssr`.

**Out of scope:**

- Páginas de auth (`/auth/login`, `/auth/register`).
- Esquemas de BD, tablas, migraciones.
- Real-time subscriptions.
- Edge Functions.
- Middleware / proxy de sesión.
- Tests automatizados.

---

## Data model

No se introducen esquemas de BD ni tipos nuevos.

Variables de entorno añadidas:

| Variable                        | Exposición       | Descripción                     |
| ------------------------------- | ---------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Cliente+Servidor | URL del proyecto Supabase       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente+Servidor | Clave anon pública del proyecto |

---

## Implementation plan

1. **Instalar dependencias** — `npm install @supabase/supabase-js @supabase/ssr`.
   Verificar: ambas aparecen en `package.json`.

2. **Variables de entorno** — Agregar a `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   Agregar a `.env.template` las mismas claves con valor vacío.
   Verificar: `.env.local` no commiteado (`.gitignore` ya incluye `.env*.local`).

3. **Cliente servidor** — Crear `app/_lib/supabase/server.ts`:

   ```ts
   import { createServerClient } from "@supabase/ssr";
   import { cookies } from "next/headers";

   export async function createClient() {
     const cookieStore = await cookies();
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll: () => cookieStore.getAll(),
           setAll: (cookiesToSet) => {
             cookiesToSet.forEach(({ name, value, options }) =>
               cookieStore.set(name, value, options)
             );
           },
         },
       }
     );
   }
   ```

   Verificar: `npx tsc --noEmit` sin errores.

4. **Cliente browser** — Crear `app/_lib/supabase/client.ts`:

   ```ts
   import { createBrowserClient } from "@supabase/ssr";

   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
     );
   }
   ```

   Verificar: `npx tsc --noEmit` sin errores.

5. **Smoke test** — En `app/page.tsx` importar temporalmente el cliente servidor,
   llamar `supabase.from('_test').select()` y loguear el resultado en consola del
   servidor. Verificar: respuesta de Supabase (200 o error de tabla inexistente —
   ambos confirman conexión). Remover el import temporal después.

---

## Acceptance criteria

- [ ] `npm run dev` arranca sin errores de compilación ni consola.
- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen en `package.json`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      con valores reales.
- [ ] `.env.template` contiene las mismas claves con valor vacío.
- [ ] `app/_lib/supabase/server.ts` existe y exporta `createClient` async.
- [ ] `app/_lib/supabase/client.ts` existe y exporta `createClient`.
- [ ] Smoke test: respuesta de Supabase llega al servidor (200 o error de tabla
      inexistente — ambos confirman conexión activa).
- [ ] Import temporal del smoke test removido de `app/page.tsx`.

---

## Decisions

- **Sí:** `@supabase/ssr` en lugar de `@supabase/auth-helpers-nextjs` (deprecado).
  Paquete oficial recomendado para Next.js App Router con Server Components.
- **Sí:** Dos helpers separados (`server.ts` / `client.ts`). Necesario — el cliente
  servidor usa `cookies()` de `next/headers` (solo disponible server-side); el cliente
  browser usa `localStorage` (solo disponible client-side).
- **Sí:** `createClient` como función (no singleton). Cada Server Component o Route
  Handler crea su propia instancia para acceder a las cookies del request actual.
- **Sí:** Variables `NEXT_PUBLIC_*` para URL y anon key. Son públicas por diseño en
  Supabase — la seguridad viene de Row Level Security (RLS), no de ocultar estas claves.
- **No:** `service_role` key en este spec. Solo necesaria para operaciones admin
  server-side — se agrega cuando haya un caso concreto.
- **No:** Proxy de sesión (`proxy.ts`) en este spec. Necesario para refresh automático
  de tokens — se implementa en el spec de auth UI.
- **No:** Tablas, migraciones ni RLS en este spec. Sin schema definido aún.
