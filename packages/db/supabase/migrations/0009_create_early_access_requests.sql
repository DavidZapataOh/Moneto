-- Migration 0009 — early_access_requests (Sprint 3.08)
--
-- Track de "user solicitó acceso early a feature X" — primer caso de uso
-- son los bridges cross-chain (BTC vía Zeus, ETH vía Wormhole) que aún
-- no están live. El user toca "Solicitar acceso early" en el asset detail
-- y guardamos la intención para marketing follow-up.
--
-- Forma deliberadamente simple: una row por (user_id, feature). Idempotent:
-- repetir el call no duplica, solo bumpa `last_requested_at`.
--
-- `feature` es un slug texto (ej. `bridge:btc`, `bridge:eth`) en lugar de
-- enum estricto — futuras solicitudes (e.g., `card:premium`, `kyc:level3`)
-- se agregan sin migration. Validación del slug vive en el backend (zod).

create table public.early_access_requests (
  user_id text not null references public.profiles(id) on delete cascade,
  feature text not null,
  -- Slug context opcional — para `bridge:btc` guardamos provider planeado
  -- (`zeus`) en metadata para que el dashboard de marketing pueda agrupar.
  metadata jsonb default '{}'::jsonb not null,
  first_requested_at timestamptz default now() not null,
  last_requested_at timestamptz default now() not null,
  primary key (user_id, feature)
);

create index early_access_feature_idx on public.early_access_requests (feature);

alter table public.early_access_requests enable row level security;

create policy "own_requests_select" on public.early_access_requests
  for select using (auth.uid() = user_id);

create policy "own_requests_insert" on public.early_access_requests
  for insert with check (auth.uid() = user_id);

create policy "own_requests_update" on public.early_access_requests
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Touch `last_requested_at` en cada UPDATE — sirve para count de re-engagement.
create or replace function public.touch_early_access_last_requested()
returns trigger
language plpgsql
as $$
begin
  new.last_requested_at = now();
  return new;
end;
$$;

drop trigger if exists early_access_touch_last_requested on public.early_access_requests;

create trigger early_access_touch_last_requested
  before update on public.early_access_requests
  for each row execute function public.touch_early_access_last_requested();

comment on table public.early_access_requests is
  'User-initiated waitlist for not-yet-live features (bridges, etc.). Marketing follow-up.';
comment on column public.early_access_requests.feature is
  'Slug del feature solicitado. Convención: namespace:variant (ej. bridge:btc).';
