-- Migration 0001 — profiles
--
-- Tabla de identidad. Mapping mínimo del Privy DID + KYC tier + handle.
-- DELIBERADAMENTE NO incluye:
--   • wallet_address / pubkey  → eso vive en Privy, no se duplica acá
--   • balance / financial data → eso vive on-chain, Supabase no toca
--   • tx history               → eso vive on-chain, Supabase no toca
--
-- La compartmentalization es la thesis del producto. Romper este invariant
-- es un escalation P0 (ver `docs/security/threat-model.md`).

create table public.profiles (
  id uuid primary key,                     -- = privy DID (sub claim del JWT)
  handle text unique not null,
  name text,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  phone_ciphertext bytea,                  -- cifrado via Vault (migration 0005)
  avatar_url text,
  kyc_level int default 0 check (kyc_level >= 0 and kyc_level <= 3),
  kyc_status text default 'none' check (kyc_status in ('none', 'pending', 'approved', 'rejected')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_profiles_handle on public.profiles (handle);
create index idx_profiles_country on public.profiles (country_code);

-- RLS — default deny.
alter table public.profiles enable row level security;

-- Users solo pueden leer/escribir su propio profile (via Privy JWT sub claim).
create policy "own_profile_select" on public.profiles
  for select using (auth.uid() = id);

create policy "own_profile_insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "own_profile_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-update updated_at on UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

comment on table public.profiles is
  'Identity layer. NEVER include wallet_address (Privy holds that mapping). NEVER include financial data.';
comment on column public.profiles.id is
  'Privy DID (= JWT sub claim). NOT a UUID we generate; received from Privy.';
comment on column public.profiles.phone_ciphertext is
  'Phone encrypted at-rest via supabase_vault (see encrypt_phone() in migration 0005).';
