-- Migration 0007 — kyc_audit_log
--
-- Audit trail completo de cambios de KYC level/status. Cada inquiry de
-- Persona (approved, declined, needs-review) genera una row.
-- Compliance retention: 7 años (LATAM regulatorio mínimo). El TTL real
-- se enforce vía Supabase Vault retention policies, no acá.
--
-- IMPORTANT — service-role-only:
-- Sin policies RLS para anon/authenticated → users NUNCA ven su propio
-- audit log directamente. Compliance/legal requirement (audit logs son
-- para regulators, no para users).

create table public.kyc_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles(id) on delete cascade not null,
  -- Persona inquiry ID (formato `inq_xxx`).
  inquiry_id text not null,
  -- Persona event ID — UNIQUE para idempotency. Webhook duplicado no
  -- reinserta y no re-aplica el cambio de level.
  persona_event_id text not null unique,
  -- Tipo de event (`inquiry.completed`, `inquiry.failed`, `report.run-completed`, etc).
  event_type text not null,
  -- Snapshot del estado antes del cambio (NULL en el primer event del user).
  prev_level int,
  prev_status text,
  -- Nuevo estado post-event.
  new_level int not null check (new_level >= 0 and new_level <= 3),
  new_status text not null check (new_status in ('none', 'pending', 'approved', 'rejected')),
  -- Raw event para forensics/replay (incluye claims sensibles — solo
  -- service-role accede).
  raw_event jsonb not null,
  created_at timestamptz default now() not null
);

create index idx_kyc_audit_user on public.kyc_audit_log (user_id);
create index idx_kyc_audit_created on public.kyc_audit_log (created_at desc);
create index idx_kyc_audit_event_type on public.kyc_audit_log (event_type);

alter table public.kyc_audit_log enable row level security;

-- DELIBERADAMENTE sin policies → solo service_role accede via edge fn.

comment on table public.kyc_audit_log is
  'Compliance audit trail. Service-role-only access. Retention 7 años regulatorio LATAM.';
comment on column public.kyc_audit_log.persona_event_id is
  'UNIQUE constraint asegura idempotency — webhook duplicado de Persona no reaplica el cambio.';
comment on column public.kyc_audit_log.raw_event is
  'JSON completo del Persona webhook event. Puede contener PII — solo service-role accede.';
