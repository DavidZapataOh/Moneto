-- Migration 0010 — payroll infra (Sprint 4.01)
--
-- Tres tablas para el flow "payroll link":
--
-- 1. `processed_signatures` — idempotency del Helius webhook. Si la
--    misma `(signature, mint)` llega dos veces, el handler skip-ea
--    procesamiento downstream (push notif, balance refresh).
--
-- 2. `push_tokens` — Expo push tokens registrados por device. Soporta
--    múltiples tokens por user (mobile + tablet en algún momento).
--
-- 3. `incoming_transfers` — audit log mínimo de transferencias entrantes.
--    Sin PII: solo signature, mint, timestamp, user_id. Amounts NUNCA
--    se persisten (van a Sentry/Axiom como bucketed metric).

-- ── wallet_index ──────────────────────────────────────────────────────────
-- Inverse lookup wallet_address → user_id. Necesario para que el webhook
-- de Helius (que recibe pubkey del recipient) pueda routear al usuario
-- correcto sin enumerar TODOS los users de Privy (N+1 disaster).
--
-- **Compartmentalization trade-off**: el invariant "wallet pubkey nunca
-- en Supabase" se relaja acá deliberadamente. Justificación:
--
-- 1. Una pubkey Solana es información pública on-chain (cualquiera puede
--    leer balances + tx history conociendo la pubkey).
-- 2. Esta tabla es **service-role only** — no policies de SELECT para
--    auth users, así que un atacker que compromete una sesión Privy NO
--    puede enumerar wallet→user mappings de otros users.
-- 3. La alternativa (resolver via Privy admin per evento) cuesta 1 API
--    call por transferencia entrante — irrealizable a escala.
--
-- El binding se popula on-demand cuando el mobile llama
-- `POST /api/me/push-tokens` (primer authenticated session).
create table public.wallet_index (
  wallet_address text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  -- Cuándo se hizo el bind. Útil para forensics en caso de wallet reuse.
  bound_at timestamptz default now() not null
);

create index wallet_index_user_idx on public.wallet_index (user_id);

alter table public.wallet_index enable row level security;
-- Sin policies — solo service role. Los auth users no necesitan leer
-- esta tabla directo (la pubkey de su propio wallet la conocen via Privy).

-- ── processed_signatures ──────────────────────────────────────────────────
create table public.processed_signatures (
  signature text not null,
  -- `mint` discriminates txs que tocan multiple SPL transfers — un signature
  -- puede haber movido USDC + PYUSD si el sender hizo multi-transfer.
  mint text not null,
  user_id text references public.profiles(id) on delete cascade,
  processed_at timestamptz default now() not null,
  primary key (signature, mint)
);

create index processed_signatures_user_idx
  on public.processed_signatures (user_id, processed_at desc);

-- Service-role writes; users read via API endpoint, no direct table read.
alter table public.processed_signatures enable row level security;

-- Sin policies de SELECT/INSERT — el service role bypasa RLS desde el
-- worker (`createSupabaseAdminClient`). Auth users no leen esta tabla
-- directo.

-- ── push_tokens ───────────────────────────────────────────────────────────
create table public.push_tokens (
  token text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  -- Bookkeeping: tracking del último envío exitoso ayuda a podar tokens
  -- inactivos (Expo retorna `DeviceNotRegistered` después de uninstall).
  last_used_at timestamptz default now() not null,
  invalidated_at timestamptz, -- not null cuando Expo nos dice "kill this token"
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index push_tokens_user_idx on public.push_tokens (user_id) where invalidated_at is null;

alter table public.push_tokens enable row level security;

create policy "own_push_tokens_select" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "own_push_tokens_insert" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy "own_push_tokens_update" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_push_tokens_delete" on public.push_tokens
  for delete using (auth.uid() = user_id);

create trigger push_tokens_touch_updated_at
  before update on public.push_tokens
  for each row execute function public.touch_updated_at();

-- ── incoming_transfers ────────────────────────────────────────────────────
-- Audit log para que el user pueda ver historia + soporte tenga un trail
-- mínimo. Cero amounts/balances en plain text.
create table public.incoming_transfers (
  signature text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  -- `mint` para que UI pueda mapear a AssetId via registry.
  mint text not null,
  -- `from_address` opaco — útil para "lista negra" si bridge contract
  -- comprometido. NO es PII según GDPR (pubkey ≠ identidad).
  from_address text,
  -- Detección de origen: payroll link vs random transfer. Sprint 5+
  -- distingue para UX ("Tu salario llegó" vs "Recibiste USDC").
  source_type text not null default 'unknown'
    check (source_type in ('payroll_link', 'p2p', 'cashout_back', 'unknown')),
  block_time timestamptz not null,
  created_at timestamptz default now() not null
);

create index incoming_transfers_user_idx
  on public.incoming_transfers (user_id, block_time desc);

alter table public.incoming_transfers enable row level security;

create policy "own_incoming_select" on public.incoming_transfers
  for select using (auth.uid() = user_id);

-- Inserts solo desde service role (worker via webhook). No policy de
-- INSERT para auth users.

comment on table public.processed_signatures is
  'Idempotency lock para Helius webhook. (signature, mint) único.';
comment on table public.push_tokens is
  'Expo push tokens per device. invalidated_at != null = token muerto.';
comment on table public.incoming_transfers is
  'Audit log de transferencias entrantes. Cero amounts en plain text.';
