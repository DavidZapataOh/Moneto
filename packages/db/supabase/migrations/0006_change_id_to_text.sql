-- Migration 0006 — change profiles.id from uuid to text
--
-- Razón: Privy DIDs son strings con formato `did:privy:abc123...`, NO UUIDs.
-- Cuando el token-exchange edge fn (auth-exchange) mint un Supabase JWT con
-- `sub = privy_did`, `auth.uid()` retornaría error parsing si el column es
-- `uuid`. Cambiar a `text` permite usar el DID como PK directo.
--
-- Las RLS policies se actualizan para usar `(auth.jwt() ->> 'sub') = id`
-- en lugar de `auth.uid() = id` — más portable cross JWT-issuer y no
-- requiere que el sub sea UUID.
--
-- Migration safe: profiles está vacío (pre-launch), no hay backfill.

-- ── Drop dependent FKs primero ────────────────────────────────────────────
alter table public.user_preferences drop constraint user_preferences_user_id_fkey;
alter table public.guardian_notifications drop constraint guardian_notifications_recipient_user_id_fkey;
alter table public.viewing_keys drop constraint viewing_keys_user_id_fkey;

-- ── Drop existing RLS policies que referencian id ─────────────────────────
drop policy "own_profile_select" on public.profiles;
drop policy "own_profile_insert" on public.profiles;
drop policy "own_profile_update" on public.profiles;

drop policy "own_prefs_select" on public.user_preferences;
drop policy "own_prefs_insert" on public.user_preferences;
drop policy "own_prefs_update" on public.user_preferences;

drop policy "recipient_can_select" on public.guardian_notifications;
drop policy "recipient_can_update" on public.guardian_notifications;

drop policy "own_keys_select" on public.viewing_keys;
drop policy "own_keys_insert" on public.viewing_keys;
drop policy "own_keys_update" on public.viewing_keys;

-- ── Alterar tipos de columnas ─────────────────────────────────────────────
alter table public.profiles alter column id type text using id::text;
alter table public.user_preferences alter column user_id type text using user_id::text;
alter table public.guardian_notifications alter column recipient_user_id type text using recipient_user_id::text;
alter table public.viewing_keys alter column user_id type text using user_id::text;

-- ── Re-crear FKs con nuevo tipo ───────────────────────────────────────────
alter table public.user_preferences
  add constraint user_preferences_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.guardian_notifications
  add constraint guardian_notifications_recipient_user_id_fkey
  foreign key (recipient_user_id) references public.profiles(id) on delete cascade;

alter table public.viewing_keys
  add constraint viewing_keys_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ── Re-crear RLS policies usando auth.jwt() ->> 'sub' ─────────────────────
-- Pattern más portable que `auth.uid()` — no asume que sub es UUID.

create policy "own_profile_select" on public.profiles
  for select using ((auth.jwt() ->> 'sub') = id);

create policy "own_profile_insert" on public.profiles
  for insert with check ((auth.jwt() ->> 'sub') = id);

create policy "own_profile_update" on public.profiles
  for update using ((auth.jwt() ->> 'sub') = id) with check ((auth.jwt() ->> 'sub') = id);

create policy "own_prefs_select" on public.user_preferences
  for select using ((auth.jwt() ->> 'sub') = user_id);

create policy "own_prefs_insert" on public.user_preferences
  for insert with check ((auth.jwt() ->> 'sub') = user_id);

create policy "own_prefs_update" on public.user_preferences
  for update using ((auth.jwt() ->> 'sub') = user_id) with check ((auth.jwt() ->> 'sub') = user_id);

create policy "recipient_can_select" on public.guardian_notifications
  for select using ((auth.jwt() ->> 'sub') = recipient_user_id);

create policy "recipient_can_update" on public.guardian_notifications
  for update using ((auth.jwt() ->> 'sub') = recipient_user_id)
  with check ((auth.jwt() ->> 'sub') = recipient_user_id);

create policy "own_keys_select" on public.viewing_keys
  for select using ((auth.jwt() ->> 'sub') = user_id);

create policy "own_keys_insert" on public.viewing_keys
  for insert with check ((auth.jwt() ->> 'sub') = user_id);

create policy "own_keys_update" on public.viewing_keys
  for update using ((auth.jwt() ->> 'sub') = user_id) with check ((auth.jwt() ->> 'sub') = user_id);

-- ── Comments actualizados ─────────────────────────────────────────────────
comment on column public.profiles.id is
  'Privy DID (= JWT sub claim, formato `did:privy:xxx`). Type text — NOT uuid.';
