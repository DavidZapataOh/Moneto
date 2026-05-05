-- Migration 0008 — extend user_preferences with asset routing config (Sprint 3.07)
--
-- Tres campos nuevos:
--
-- 1. `asset_priority_order text[]`  — orden en que el payment router
--    consume los assets del user al pagar / convertir / retirar.
--    Default sensible: stables USD primero (preserva crypto que aprecia),
--    locales después (zero-conversion para QR locales), volátiles último
--    (evita vender salvo que sea necesario).
--
-- 2. `hidden_assets text[]`         — assets que el user oculta de la UI.
--    NO afecta on-chain — los funds siguen ahí, solo no se renderean en
--    Asset Strip / lista de holdings. El payment router NO los consume
--    automáticamente (los considera como "no preferidos") salvo que sean
--    el único saldo disponible.
--
-- 3. `default_send_asset text`      — pre-selección del Send screen.
--    Default `usd` por seguridad (most stable for daily spending).
--
-- ADR del plan: el array de priorities ES la fuente de orden. `default_send_asset`
-- es separado porque el "asset por defecto" es UX (qué muestro primero
-- en Send) vs priorities (qué consumo cuando hay que routear).
--
-- Validación:
-- - Trigger `enforce_asset_prefs_invariants` corre en INSERT/UPDATE para
--   asegurar que `default_send_asset` no esté en `hidden_assets` y que
--   `asset_priority_order` no quede vacío.
-- - Asset IDs válidos NO se enforce a nivel DB (el registry vive en TS),
--   pero el backend zod-valida cada payload contra `AssetIdSchema`.

alter table public.user_preferences
  add column if not exists asset_priority_order text[]
    default array['usd', 'eur', 'cop', 'mxn', 'brl', 'ars', 'sol', 'btc', 'eth']::text[]
    not null;

alter table public.user_preferences
  add column if not exists hidden_assets text[]
    default array[]::text[]
    not null;

alter table public.user_preferences
  add column if not exists default_send_asset text
    default 'usd'
    not null;

-- ── Invariants enforced via trigger ──────────────────────────────────────
-- Razón: chequeos cross-column (default no en hidden + order no vacío)
-- no se pueden expresar con CHECK constraints sobre arrays sin recurrir
-- a funciones inmutables, lo cual complica las migraciones futuras.

create or replace function public.enforce_asset_prefs_invariants()
returns trigger
language plpgsql
as $$
begin
  -- Order no vacío.
  if array_length(new.asset_priority_order, 1) is null
     or array_length(new.asset_priority_order, 1) = 0
  then
    raise exception 'asset_priority_order must be non-empty'
      using errcode = '23514'; -- check_violation
  end if;

  -- Default no oculto.
  if new.default_send_asset = any(new.hidden_assets) then
    raise exception 'default_send_asset cannot be in hidden_assets'
      using errcode = '23514';
  end if;

  -- Default presente en order (o se autocompleta al frente).
  if not (new.default_send_asset = any(new.asset_priority_order)) then
    new.asset_priority_order := array_prepend(new.default_send_asset, new.asset_priority_order);
  end if;

  return new;
end;
$$;

drop trigger if exists prefs_enforce_asset_invariants on public.user_preferences;

create trigger prefs_enforce_asset_invariants
  before insert or update of asset_priority_order, hidden_assets, default_send_asset
  on public.user_preferences
  for each row execute function public.enforce_asset_prefs_invariants();

comment on column public.user_preferences.asset_priority_order is
  'Ordered list of AssetId — payment router consumes saldo en este orden. Default: stables USD → locales → volátiles.';
comment on column public.user_preferences.hidden_assets is
  'AssetIds que el user oculta de la UI. Los funds permanecen on-chain.';
comment on column public.user_preferences.default_send_asset is
  'AssetId pre-seleccionado en el Send screen. No puede coincidir con hidden_assets.';
