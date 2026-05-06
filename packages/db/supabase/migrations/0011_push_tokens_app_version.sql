-- Migration 0011 — push_tokens.app_version (Sprint 4.04)
--
-- Tracking del app version del cliente que registró el token. Sirve para:
--
-- 1. Roll out de push features per min app version (e.g., un nuevo
--    channel introducido en 1.4.0 — solo enviar a tokens con
--    app_version >= 1.4.0).
-- 2. Métrica de install base updated vs stale.
-- 3. Forensics cuando un user reporta "no me llegan notifs" — ver si
--    su token es de una versión con bug conocido.

alter table public.push_tokens
  add column if not exists app_version text;

-- Index opcional — útil cuando empezamos a filtrar por versión en queries
-- de send (futuro). Sin index las pocas filas filtradas hoy son O(N) safe.
create index if not exists push_tokens_app_version_idx
  on public.push_tokens (app_version)
  where invalidated_at is null;

comment on column public.push_tokens.app_version is
  'Semver del cliente al momento del register (ej. 1.4.0). Null = legacy register.';
