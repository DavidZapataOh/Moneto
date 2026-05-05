-- Migration 0003 — guardian_notifications
--
-- Routing layer para notificaciones de social recovery.
--
-- IMPORTANT: este table es SOLO routing. El guardian graph real vive
-- on-chain en un Squads multisig program (Sprint 5). Supabase no sabe
-- "X es guardian de Y" en términos linkable — solo rutea notificaciones
-- usando el squads_multisig_pubkey como pointer opaco.

create table public.guardian_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.profiles(id) on delete cascade not null,
  notification_type text not null check (
    notification_type in (
      'recovery_request',
      'guardian_invite',
      'recovery_approved',
      'recovery_rejected'
    )
  ),
  squads_multisig_pubkey text not null,    -- pointer on-chain, no identity
  status text default 'pending' check (status in ('pending', 'acknowledged', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);

create index idx_guardian_notifs_recipient on public.guardian_notifications (recipient_user_id);
create index idx_guardian_notifs_status on public.guardian_notifications (status, expires_at);

alter table public.guardian_notifications enable row level security;

-- Recipient ve sus propias notificaciones (con auth.uid() del JWT).
create policy "recipient_can_select" on public.guardian_notifications
  for select using (auth.uid() = recipient_user_id);

create policy "recipient_can_update" on public.guardian_notifications
  for update using (auth.uid() = recipient_user_id) with check (auth.uid() = recipient_user_id);

-- INSERT solo via service_role (edge fn al iniciar recovery, Sprint 5).
-- Sin policy de insert para users → bloqueado para anon.

comment on table public.guardian_notifications is
  'Notification routing only. The actual guardian graph lives on-chain in Squads multisig. Supabase does not know who is guardian of whom in linkable terms.';
comment on column public.guardian_notifications.squads_multisig_pubkey is
  'Opaque pointer to the on-chain Squads multisig PDA. Not joinable to wallet identity.';
