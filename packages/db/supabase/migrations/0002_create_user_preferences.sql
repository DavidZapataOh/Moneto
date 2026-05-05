-- Migration 0002 — user_preferences
--
-- Settings UI/locale persistidos para que cross-device el user vea su
-- preferencia (e.g., theme dark) sin re-configurar.
--
-- 1:1 con profiles. ON DELETE CASCADE — al borrar profile, prefs se van.

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text default 'system' check (theme in ('system', 'light', 'dark')),
  language text default 'es' check (language in ('es', 'en', 'pt')),
  notifications_push boolean default true,
  notifications_email boolean default false,
  balance_hidden boolean default false,
  default_asset text default 'USD',
  updated_at timestamptz default now() not null
);

alter table public.user_preferences enable row level security;

create policy "own_prefs_select" on public.user_preferences
  for select using (auth.uid() = user_id);

create policy "own_prefs_insert" on public.user_preferences
  for insert with check (auth.uid() = user_id);

create policy "own_prefs_update" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger prefs_touch_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();

comment on table public.user_preferences is
  'UI / locale preferences. Cross-device sync. No PII beyond user_id reference.';
