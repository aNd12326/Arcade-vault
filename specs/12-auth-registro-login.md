# SPEC 12 — Registro, login y autenticación real

> **Status:** Approved · **Depende de:** SPEC 04 (Integración Supabase), SPEC 06 (games-table-leaderboard) · **Fecha:** 2026-06-08
> **Objetivo:** Reemplazar el `/auth` cosmético por autenticación real con Supabase Auth (email+contraseña, Google y GitHub OAuth), perfil con nickname único, sesión persistida vía `proxy.ts` y recuperación de contraseña, manteniendo el modo invitado.

---

## Scope

**In:**

- `supabase` (migración) — Tabla `profiles` (`id` FK→`auth.users`, `nickname` UNIQUE, `created_at`) + RLS (lectura pública, escritura solo dueño).
- `supabase` (migración) — Trigger `handle_new_user` sobre `auth.users` que inserta fila en `profiles` leyendo `nickname` desde `raw_user_meta_data`.
- `app/auth/page.tsx` — Reescribir: tabs login/registro llaman a Supabase real (`signUp`, `signInWithPassword`), campo email obligatorio en ambos tabs, nickname obligatorio en registro, botones Google/GitHub llaman `signInWithOAuth`, estados de error y "revisa tu correo".
- `app/auth/callback/route.ts` — NUEVO. Route handler que intercambia el `code` de OAuth/confirmación de email por sesión (`exchangeCodeForSession`) y redirige.
- `app/auth/reset/page.tsx` — NUEVO. Formulario "olvidé mi contraseña" (pide email → `resetPasswordForEmail`) y, cuando llega con sesión de recovery, formulario para fijar nueva contraseña (`updateUser`).
- `proxy.ts` — NUEVO (raíz). Refresca cookies de sesión Supabase en cada request (reemplazo de middleware en Next 16).
- `app/_lib/supabase/middleware-session.ts` — NUEVO. Lógica `updateSession(request)` usada por `proxy.ts`.
- `app/_lib/user-context.tsx` — Reescribir: lee sesión real de Supabase (`user.name` = nickname del perfil); modo invitado vía localStorage como fallback; `signOut` llama `supabase.auth.signOut()`.
- `app/_lib/supabase/queries.ts` — Añadir `getProfile(userId)` y chequeo de nickname disponible.
- `app/_lib/supabase/types.ts` — Añadir tipo `Profile`.

**Fuera de alcance (specs futuros):**

- Vincular `scores.user_id` a la cuenta (los scores siguen siendo nickname de texto libre; el nickname se autocompleta desde el perfil sin cambiar el esquema `scores`).
- Rutas protegidas / forzar login para jugar (se mantiene "jugar como invitado").
- Edición de perfil (cambiar nickname, avatar) más allá de su creación en el registro.
- Verificación/rate-limiting anti-spam de registro más allá de la confirmación de email.
- Tests automatizados.
- Configurar los providers OAuth en el dashboard de Supabase (tarea manual, se documenta pero no se "codea").

---

## Data model

### Tabla `profiles` (Supabase)

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (char_length(nickname) between 1 and 20),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- lectura pública (para mostrar nicknames en leaderboard/hall-of-fame)
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- el usuario solo escribe/actualiza su propia fila
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
```

### Trigger de alta

```sql
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, new.raw_user_meta_data ->> 'nickname');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

El nickname viaja en el registro vía `signUp({ email, password, options: { data: { nickname } } })`.

### Tipo TypeScript (`types.ts`)

```ts
export type Profile = {
  id: string;
  nickname: string;
  created_at: string;
};
```

### Contrato `user-context` (sin cambiar la forma que consume `Nav`)

```ts
// user.name = nickname (perfil real) | nombre invitado | null
type User = { name: string; isGuest: boolean } | null;
```

Convenciones:

- `nickname` único, 1–20 chars (alineado con la validación de `scores` en `api/scores`).
- El esquema `scores` NO cambia.
- Trigger `security definer` + `search_path=''` por la guía de seguridad de Supabase.

---

## Implementation plan

1. **Migración `profiles`** — Aplicar tabla + RLS + trigger `handle_new_user` (vía MCP `apply_migration`). Verificar: `list_tables` muestra `profiles`; insertar un usuario de prueba en Auth crea su fila.

2. **Tipos + queries** — Añadir `Profile` a `types.ts`; `getProfile(userId)` y `isNicknameTaken(nickname)` a `queries.ts`. Verificar: `npx tsc --noEmit` limpio.

3. **Helper de sesión + `proxy.ts`** — Crear `app/_lib/supabase/middleware-session.ts` con `updateSession(request)` (refresca cookies) y `proxy.ts` en la raíz que lo invoca con su `matcher`. Verificar: navegar el sitio mantiene la sesión entre recargas (probado al final con un login real).

4. **Reescribir `user-context.tsx`** — Al montar, leer sesión Supabase (`getUser` + `getProfile`) → `user = { name: nickname, isGuest:false }`; si no hay sesión, leer invitado de localStorage; suscribirse a `onAuthStateChange`. `signOut` → `supabase.auth.signOut()` o limpiar invitado. Mantener `login(name)` solo para invitado. Verificar: `Nav` sigue mostrando `user.name` sin cambios.

5. **`/auth/callback` route handler** — `exchangeCodeForSession(code)` y redirigir a `/` (o `next` param). Verificar: visitar la URL con un `code` válido crea sesión.

6. **Reescribir `app/auth/page.tsx` — email+password** — Tab registro: email+nickname+password → chequear nickname libre → `signUp` con `options.data.nickname` y `emailRedirectTo=/auth/callback`; mostrar estado "revisa tu correo". Tab login: `signInWithPassword` → redirigir a `/`. Estados de error inline. Mantener botón "jugar como invitado". Verificar: registro envía email; login real entra al Vault.

7. **Botones OAuth** — Google/GitHub → `signInWithOAuth({ provider, options:{ redirectTo:/auth/callback } })`. Verificar: el botón redirige al consentimiento del provider (asumiendo provider configurado en dashboard).

8. **`/auth/reset` recuperación** — Sin sesión recovery: form pide email → `resetPasswordForEmail(email, { redirectTo:/auth/reset })`. Con sesión recovery (llega desde el email): form nueva contraseña → `updateUser({ password })` → redirigir a `/`. Enlace "¿Olvidaste tu contraseña?" en el tab login. Verificar: el flujo completo cambia la contraseña.

9. **Documentar config manual de OAuth** — Nota en el spec/README: habilitar Google y GitHub en el dashboard de Supabase con la redirect URL `/auth/callback`. Verificar: documentado (no es código).

---

## Acceptance criteria

- [ ] La tabla `profiles` existe con `nickname` UNIQUE y RLS habilitada.
- [ ] Registrar un usuario en Auth crea automáticamente su fila en `profiles` con el nickname enviado.
- [ ] El registro con email/nickname/contraseña muestra el estado "revisa tu correo" y no inicia sesión hasta confirmar.
- [ ] Hacer click en el enlace de confirmación del email crea la sesión y redirige a `/`.
- [ ] Intentar registrarse con un nickname ya tomado muestra error inline y no crea la cuenta.
- [ ] Login con email+contraseña correctos entra al Vault; con credenciales malas muestra error inline.
- [ ] Los botones Google y GitHub redirigen al consentimiento del provider y, al volver por `/auth/callback`, dejan sesión iniciada.
- [ ] "Jugar como invitado" sigue funcionando sin cuenta.
- [ ] Tras login, `Nav` muestra el nickname del perfil y "cerrar sesión" termina la sesión Supabase.
- [ ] La sesión persiste tras recargar la página (cookies refrescadas por `proxy.ts`).
- [ ] "¿Olvidaste tu contraseña?" envía el email de reset; el enlace permite fijar una nueva contraseña y entrar.
- [ ] `npx tsc --noEmit` y `eslint` pasan sin errores.

---

## Decisiones

- **Sí:** Email+contraseña como método núcleo + Google y GitHub OAuth. Cubre el formulario existente y los botones sociales muertos.
- **No:** Magic link (passwordless). La UI actual es de contraseña; añadirlo diverge sin pedido.
- **Sí:** Nickname en tabla `profiles` separada. Consultable y joinable con leaderboards; separa identidad (email) de display name.
- **No:** Nickname en `user_metadata`. No consultable ni joinable con `scores`.
- **Sí:** Perfil creado por **trigger** `handle_new_user`. Funciona aunque la confirmación de email se difiera; evita insert desde cliente con sesión a medias.
- **Sí:** Nickname UNIQUE, 1–20. Evita colisiones en el leaderboard; alinea con la validación de `api/scores`.
- **Sí:** Confirmación de email obligatoria. Default seguro de Supabase; reduce registros basura.
- **Sí:** `proxy.ts` (no `middleware.ts`). Next 16 deprecó middleware; el refresco de sesión SSR lo necesita.
- **Sí:** Mantener "jugar como invitado" + reescribir `user-context` para que `user.name` siga siendo el campo que consume `Nav`. Cero churn en componentes que ya usan el contexto.
- **No:** Vincular `scores.user_id` a la cuenta. Los scores siguen como nickname de texto libre; el nickname se autocompleta del perfil. Migrar el esquema de scores es otro spec.
- **No:** Rutas protegidas / login obligatorio para jugar. Rompería el flujo invitado; va en otro spec si llega.
- **Sí:** Página única `/auth` con tabs + `/auth/callback` + `/auth/reset`. Menos churn que partir en `/login` y `/register`.
- **Sí:** Incluir flujo de recuperación de contraseña. Pedido explícito.
- **No:** Configurar providers OAuth por código. La habilitación en el dashboard de Supabase es manual; solo se documenta.

---

## Riesgos

| Riesgo                                                                                                                          | Mitigación                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Carrera en nickname (TOCTOU): dos registros simultáneos con el mismo nickname pasan el chequeo previo.                          | La constraint `UNIQUE` es la verdad final; el insert del trigger falla y se muestra error. El chequeo `isNicknameTaken` es solo UX, no atómico. |
| `signUp` crea el usuario en `auth.users` pero el trigger falla (p.ej. nickname duplicado) → usuario sin perfil.                 | Trigger lanza excepción y aborta la transacción del alta; el usuario no queda huérfano. Verificar en el paso 1.                                 |
| Variable de entorno mal nombrada: `client.ts` usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` pero spec 04 documentó `..._ANON_KEY`. | Confirmar el nombre real en `.env.local` antes de tocar `proxy.ts`; usar el mismo que ya funciona en `client.ts`/`server.ts`.                   |
| Providers OAuth no configurados en el dashboard → botones fallan en runtime.                                                    | Documentado como prerequisito manual (paso 9). El email+password funciona sin ello.                                                             |
| `proxy.ts` con `matcher` mal puesto refresca en assets estáticos o rompe rutas.                                                 | Usar el `matcher` recomendado en `node_modules/next/dist/docs/.../proxy.md`, excluyendo `_next/static`, `_next/image`, favicon.                 |
| `onAuthStateChange` provoca renders extra en wrappers de juego canvas.                                                          | `user-context` ya aislado; los canvas leen nickname una vez. Alinea con preferencia de minimizar `useState`.                                    |

---

## Lo que **no** está en este spec

- Vincular scores a la cuenta (`scores.user_id`).
- Login obligatorio / rutas protegidas para jugar.
- Edición de perfil (cambiar nickname, avatar).
- Configurar los providers OAuth en el dashboard (manual).
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
