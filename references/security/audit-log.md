# Audit Log — Arcade Vault Security

Bitácora de auditorías de seguridad. Una entrada por corrida, orden cronológico descendente.

---

## Auditoria 2026-06-08

**Commit:** `ff4aac3`
**Resumen:** 🔴 0 · 🟠 0 · 🟡 1 · 🔵 4

### Críticos

- ninguno

### Altos

- ninguno

### Medios

- [Supabase Auth advisor: auth_leaked_password_protection] Leaked Password Protection (HaveIBeenPwned) sigue desactivado. Activar en Authentication > Password security en el Dashboard de Supabase.

### Info / Checks manuales

- [ ] Authentication > Settings > Minimum password length >= 8 (no verificable vía MCP; confirmar en Dashboard)
- [ ] Authentication > Settings > Leaked Password Protection (HaveIBeenPwned) = ON — advisor activo, pendiente de activación manual
- [ ] Authentication > Settings > Max signup rate por IP configurado en Supabase (rate-limit server-side implementado en proxy.ts, pero el built-in de Supabase Auth no fue verificado)
- [ ] X-DNS-Prefetch-Control header no está en next.config.ts; no es requerido por spec 14 pero sí aparece en el checklist de auditoría; considerar añadirlo en un spec futuro

### Notas sobre hallazgos verificados como correctos

- RLS habilitado en todas las tablas públicas: games, scores, profiles.
- Políticas de games: games_select_public (SELECT, anon+authenticated, USING true). Sin INSERT/UPDATE/DELETE policies. Correcto.
- Políticas de scores: scores_select_public (SELECT, USING true) + scores_insert_anon (INSERT, WITH CHECK (user_id IS NULL OR user_id = auth.uid())). Sin WITH CHECK always-true. Correcto.
- Políticas de profiles: profiles_select_public, profiles_insert_own (WITH CHECK auth.uid() = id), profiles_update_own (USING auth.uid() = id). Correcto.
- rls_auto_enable(): ACL restringida a postgres y service_role solamente; REVOKE aplicado previamente. Los dos advisors anon_security_definer_function_executable y authenticated_security_definer_function_executable ya no aparecen. Resuelto.
- handle_new_user(): función SECURITY DEFINER pero ACL restringida a postgres y service_role; no invocable por anon/authenticated vía REST. Sin hallazgo.
- Headers HTTP en next.config.ts: X-Content-Type-Options, X-Frame-Options, Referrer-Policy presentes. Correcto.
- proxy.ts: existe, matcher cubre todas las rutas dinámicas, rate-limit aplicado a POST /api/signup. Correcto.
- Regex de contraseña: STRONG_PASSWORD_RE en app/\_lib/password.ts, evaluado antes de llamar a /api/signup en app/auth/page.tsx. Correcto.
- .gitignore: .env\* ignorado. Correcto.
- Secretos hardcodeados: ninguno encontrado.
- SUPABASE_SERVICE_ROLE_KEY: no referenciado en ningún archivo de la app.
- scores.user_id: incluido en insertScore (queries.ts:54) como user?.id ?? null. Correcto.
- Dependencias npm: 2 vulnerabilidades moderadas (next, postcss), 0 high, 0 critical.

### Delta vs anterior

- Nuevos: ninguno (primera auditoría)
- Resueltos: N/A (primera auditoría)

---
