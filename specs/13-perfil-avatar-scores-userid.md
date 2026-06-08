# SPEC 13 — Avatar en navbar + vínculo `scores.user_id`

> **Status:** Implemented · **Depende de:** SPEC 12 (Auth registro/login), SPEC 06 (games-table-leaderboard) · **Fecha:** 2026-06-08
> **Objetivo:** Cerrar dos cabos que SPEC 12 dejó explícitamente fuera de alcance: (1) mostrar la identidad del usuario logueado en el navbar con avatar (foto del provider OAuth o iniciales) junto a un botón "Cerrar sesión" inline, y (2) vincular cada score guardado a la cuenta del autor (`scores.user_id`) sin romper el modo invitado ni el leaderboard anónimo existente.

---

## Contexto

SPEC 12 marcó como **fuera de alcance**: «Vincular `scores.user_id` a la cuenta» y «Edición de perfil (cambiar nickname, avatar)». Este spec implementa la parte de avatar (solo lectura, no edición) y el vínculo de scores. El leaderboard sigue siendo público y los invitados siguen pudiendo postear scores.

---

## Scope

**In:**

- `supabase` (migración `scores_add_user_id`) — Añadir columna `scores.user_id uuid` (nullable) con FK → `auth.users(id) on delete set null`, índice `scores_user_id_idx`, y endurecer la policy de INSERT.
- `app/_lib/supabase/queries.ts` — `insertScore` resuelve la sesión server-side (`auth.getUser()`) y estampa `user_id` (o `null` para invitados).
- `app/_lib/supabase/types.ts` — `Score` gana `user_id: string | null`.
- `app/_lib/user-context.tsx` — Tipo `User` gana `avatar: string | null`; se lee de `user_metadata.avatar_url ?? picture` (OAuth) al resolver la sesión; invitados y login email/password ⇒ `null`.
- `app/_components/Nav.tsx` — Reemplazar el dropdown de cuenta por layout inline: avatar circular + nickname + botón "Cerrar sesión". Helper `initials(name)` para el fallback sin foto.
- `app/globals.css` — Estilos `.acct-id`, `.acct-avatar`, `.acct-id-name`, `.signout-inline`; ocultar `.account-wrap` en mobile (el panel móvil ya tiene cerrar sesión).

**Fuera de alcance:**

- Editar/subir avatar propio (la foto solo viene del provider OAuth; email/password no tiene foto, solo iniciales).
- Backfill del `user_id` de los scores históricos (quedan `NULL`).
- Página "mis scores" / perfil público consumiendo el nuevo `user_id` (lo habilita, no lo construye).
- Aceptar `user_id` desde el body de `api/scores` (se toma de la sesión, nunca del cliente).
- Login obligatorio para postear score (los invitados siguen con `user_id = NULL`).

---

## Data model

### Migración `scores.user_id`

```sql
alter table public.scores
  add column user_id uuid references auth.users(id) on delete set null;

create index scores_user_id_idx on public.scores(user_id);

-- Guests postean con user_id NULL; los logueados solo pueden estampar su
-- propio auth.uid() (no se puede falsificar el id de otra cuenta).
drop policy if exists scores_insert_anon on public.scores;
create policy scores_insert_anon on public.scores
  for insert
  with check (user_id is null or user_id = auth.uid());
```

- **Nullable:** los invitados no tienen sesión ⇒ `user_id = NULL`. El leaderboard sigue abierto.
- **`on delete set null`:** borrar una cuenta no borra sus scores del leaderboard; quedan anónimos.
- **Lectura:** la policy `scores_select_public` (using `true`) no cambia.

### Tipo TypeScript (`types.ts`)

```ts
export type Score = {
  id: string;
  game_id: string;
  nickname: string;
  score: number;
  user_id: string | null;
  created_at: string;
};
```

### Contrato `user-context` (extendido)

```ts
// avatar = foto del provider OAuth, o null (invitado / email-password)
type User = { name: string; isGuest: boolean; avatar: string | null } | null;
```

---

## Implementation plan

1. **Migración** — `apply_migration scores_add_user_id` (columna + FK + índice + policy). Verificar: `list_tables` muestra `scores.user_id`; los 6 scores previos quedan `NULL`.

2. **Insert path** — `insertScore(gameId, nickname, score)` ahora llama `supabase.auth.getUser()` (cliente server, cookie-backed) y hace `insert({ game_id, nickname, score, user_id: user?.id ?? null })`. La firma pública y el body de `api/scores` **no cambian** — el id viene de la cookie de sesión, no del request. Verificar: `npx tsc --noEmit` limpio.

3. **Tipos** — `Score.user_id: string | null` en `types.ts`.

4. **Avatar en contexto** — Al resolver sesión real, leer `user_metadata.avatar_url ?? picture` → `user.avatar`. Login invitado ⇒ `avatar: null`.

5. **Navbar inline** — En `Nav.tsx`, sustituir el dropdown por: `.acct-id` (avatar + nickname) y `.signout-inline`. `initials(name)` toma 2 iniciales (o 2 primeras letras si es una sola palabra). Si hay foto, `<img>` plano (sin `next/image`, evita configurar `remotePatterns`).

6. **CSS** — Avatar 40px circular, fondo que combina con el navbar (`--bg-3`→`--bg-2`) + glow cyan; foto con `object-fit: cover`, iniciales en cyan si no hay foto. Botón cerrar sesión enmarcado en magenta. `.account-wrap` oculto bajo 840px (el panel móvil ya cubre cerrar sesión).

---

## Acceptance criteria

- [x] `scores.user_id` existe, nullable, FK → `auth.users(id) on delete set null`, indexado.
- [x] Un score posteado por un usuario logueado guarda su `auth.uid()` en `user_id`.
- [x] Un score posteado como invitado guarda `user_id = NULL` y sigue apareciendo en el leaderboard.
- [x] El `user_id` se toma de la sesión server-side, no del body de `api/scores` (no se puede falsificar).
- [x] El navbar de un usuario logueado muestra avatar (foto OAuth o iniciales) + nickname + botón "Cerrar sesión" inline.
- [x] Sin foto de provider, el avatar muestra las iniciales del nickname sobre fondo que combina con el navbar.
- [x] En mobile el bloque de cuenta se oculta y cerrar sesión queda en el panel lateral.
- [x] `npx tsc --noEmit` pasa sin errores.

---

## Decisiones

- **Sí:** `user_id` nullable. Mantiene el leaderboard anónimo/invitado de SPEC 06 intacto; solo añade el vínculo cuando hay sesión.
- **Sí:** Estampar `user_id` desde `auth.getUser()` server-side, nunca desde el body. Evita que un cliente reclame scores de otra cuenta. La policy RLS (`user_id = auth.uid()`) es el guard final.
- **No:** Aceptar `user_id` en el payload de `api/scores`. Spoofeable.
- **Sí:** `on delete set null`. Borrar cuenta no borra historia del leaderboard.
- **No:** Backfill de scores históricos. No hay forma fiable de mapear nicknames de texto libre a cuentas; quedan `NULL`.
- **Sí:** Avatar solo-lectura desde `user_metadata` del provider OAuth. Cero almacenamiento/subida; email-password cae a iniciales.
- **Sí:** `<img>` plano en vez de `next/image`. Evita configurar `remotePatterns` para dominios de Google/GitHub por un avatar de 40px.
- **Sí:** Layout inline (avatar + nombre + botón) en vez del dropdown anterior. Pedido explícito del usuario; menos clicks para cerrar sesión.

---

## Riesgos

| Riesgo                                                                       | Mitigación                                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Cliente intenta postear `user_id` ajeno.                                     | El body no transporta `user_id`; se toma de la cookie de sesión. La policy `user_id = auth.uid()` lo bloquea.       |
| URL de avatar del provider rota / 404.                                       | `<img>` con `alt`; si falla, el círculo queda vacío pero no rompe el layout. Las iniciales cubren el caso sin foto. |
| Scores históricos sin `user_id` al construir "mis scores" en un spec futuro. | Documentado: quedan `NULL` (anónimos); un futuro feature debe tolerar `user_id` nulo.                               |
| `auth.getUser()` añade un round-trip por insert de score.                    | Aceptable: el guardado de score no es hot-path; ocurre una vez al terminar una partida.                             |

---

## Lo que **no** está en este spec

- Editar/subir avatar propio.
- Backfill de `user_id` en scores históricos.
- Página de perfil / "mis scores" consumiendo `user_id`.
- Login obligatorio para postear score.

Cada uno, si llega, va en su propio spec.
