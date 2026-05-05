-- Migration 0004 — viewing_keys
--
-- Permission metadata para los viewing keys que el user comparte con
-- terceros (contador, Bold para off-ramp, etc).
--
-- IMPORTANT: el LABEL del viewing key (e.g., "Mi contador", "Bold rail")
-- está cifrado client-side con una key derivada del wallet del user.
-- Supabase ve solo el ciphertext — no sabe a quién/qué se le compartió
-- el viewing key.
--
-- El viewing key MATERIAL nunca toca Supabase — vive solo en el SecureStore
-- del device del user + en el destinatario al que se compartió.

create table public.viewing_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  label_ciphertext bytea not null,         -- cifrado client-side
  scope text not null check (scope in ('txs_view', 'balance_view', 'full_read')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now() not null
);

create index idx_viewing_keys_user on public.viewing_keys (user_id);
-- Partial index — solo activas (no revocadas).
create index idx_viewing_keys_active on public.viewing_keys (user_id) where revoked_at is null;

alter table public.viewing_keys enable row level security;

create policy "own_keys_select" on public.viewing_keys
  for select using (auth.uid() = user_id);

create policy "own_keys_insert" on public.viewing_keys
  for insert with check (auth.uid() = user_id);

create policy "own_keys_update" on public.viewing_keys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE no se permite — usar revoked_at para preservar audit trail.

comment on table public.viewing_keys is
  'Permission metadata only. Labels encrypted client-side with wallet-derived key. Supabase sees only ciphertext.';
comment on column public.viewing_keys.label_ciphertext is
  'AES-GCM encrypted on the device. Key derivation: HKDF(wallet_signing_key, "moneto.viewing_key.label.v1").';
