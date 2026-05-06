-- Migration 0012 — cashouts (Sprint 4.06 stub, Sprint 6 wirea Bold)
--
-- Audit + state machine para retiros USD → moneda local (Bold Colombia,
-- Mercado Pago AR, etc.). Sprint 4.06 inserta filas con `status: 'queued'`
-- y nunca las transitiona — el stub responde "queued" y la UI muestra
-- success. Sprint 6 wirea webhook Bold que transiciona a
-- `processing → completed` o `failed`.
--
-- **Privacy**: SIN PII en plain text. Bank info simple label
-- ("Bancolombia •••• 0284") — Sprint 6 cuando linkeamos cuentas reales,
-- el accountId es un opaque identifier en el provider (Bold), nunca
-- guardamos full IBAN/CBU/CLABE.
--
-- **Amounts**: numeric(20,6) para USD precision. Local amounts pueden
-- tener distinta scale (COP no decimales, BRL 2 decimales) — usamos
-- numeric(20,6) uniforme para evitar conversion errors.

create type public.cashout_status as enum (
  'queued',       -- recibido por backend, esperando provider call
  'processing',   -- provider acepto + en pipeline (Bold ACH, etc.)
  'completed',    -- fondos en la cuenta del user
  'failed',       -- provider rechazó o expiró (refund disparado)
  'cancelled'     -- user canceló pre-execution
);

create table public.cashouts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  -- USD-equivalent del send (siempre USD denominado para reporting global).
  amount_usd numeric(20, 6) not null check (amount_usd > 0),
  -- Fee absoluto USD que cobramos (Sprint 6 split entre Moneto + provider).
  fee_usd numeric(20, 6) not null default 0 check (fee_usd >= 0),
  -- Tasa de conversión USD → local (e.g., 4125 para COP). Sprint 4.06
  -- usa Pyth FX rate frozen al confirm; Sprint 6 lock-in del provider.
  exchange_rate numeric(20, 6) not null check (exchange_rate > 0),
  local_currency text not null check (local_currency in ('COP', 'MXN', 'BRL', 'ARS', 'EUR', 'USD')),
  amount_local numeric(20, 6) not null check (amount_local > 0),
  -- Label del destination account ("Bancolombia •••• 0284"). Sprint 4.06
  -- es mock hardcoded. Sprint 6 viene del bank_accounts table linkeada.
  destination_label text not null,
  -- Sprint 6 — opaque ID del bank_accounts table. Nullable acá.
  destination_account_id text,
  status public.cashout_status not null default 'queued',
  estimated_completion_at timestamptz,
  -- Sprint 6 — provider receipt ID para troubleshooting.
  provider_reference text,
  failure_reason text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  completed_at timestamptz
);

create index cashouts_user_idx on public.cashouts (user_id, created_at desc);
create index cashouts_status_idx on public.cashouts (status) where status in ('queued', 'processing');

alter table public.cashouts enable row level security;

create policy "own_cashouts_select" on public.cashouts
  for select using (auth.uid() = user_id);

-- Inserts/updates: solo service role (worker). Sin policy de INSERT/UPDATE
-- para auth users — el user nunca toca la tabla directo.

create trigger cashouts_touch_updated_at
  before update on public.cashouts
  for each row execute function public.touch_updated_at();

comment on table public.cashouts is
  'Retiros USD → moneda local. Sprint 4.06 stub, Sprint 6 wirea Bold.';
comment on column public.cashouts.amount_usd is
  'USD-equivalent del retiro. Siempre USD-denominado para reporting global.';
comment on column public.cashouts.exchange_rate is
  'Tasa USD → local frozen al confirm. Sprint 6 lock-in del provider.';
