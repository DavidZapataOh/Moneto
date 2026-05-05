-- Migration 0005 — Vault encryption setup
--
-- supabase_vault es la extension managed de Supabase para cifrado at-rest.
-- Usado para PII como teléfono — no tiene sentido en plaintext en la DB
-- (puede leakearse en backups, logs, dump SQL, etc).
--
-- Las funciones encrypt_phone / decrypt_phone son SECURITY DEFINER (corren
-- con permisos del owner) pero `revoke execute` las hace inaccesibles
-- desde anon/authenticated — solo service_role (edge fn) las invoca.

create extension if not exists supabase_vault with schema vault;

-- Crear la encryption key. `vault.create_secret(secret_value, name, description)`
-- guarda el secret encriptado con la master key del proyecto.
-- Idempotent — si ya existe, no falla.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'phone_encryption_v1') then
    perform vault.create_secret(
      'moneto-pii-key-rotate-quarterly',
      'phone_encryption_v1',
      'AES key for phone number encryption. Rotate quarterly per docs/runbooks/secret-rotation.md.'
    );
  end if;
end $$;

-- Helper: encrypt a phone number string. Returns bytea ciphertext.
create or replace function public.encrypt_phone(phone_plain text)
returns bytea
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  key_id uuid;
  ciphertext bytea;
begin
  if phone_plain is null then
    return null;
  end if;
  select id into key_id from vault.secrets where name = 'phone_encryption_v1' limit 1;
  if key_id is null then
    raise exception 'Vault key phone_encryption_v1 not found';
  end if;
  select vault.encrypt(phone_plain::bytea, key_id) into ciphertext;
  return ciphertext;
end;
$$;

-- Helper: decrypt a phone number bytea back to plaintext.
create or replace function public.decrypt_phone(phone_ct bytea)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  key_id uuid;
  plaintext bytea;
begin
  if phone_ct is null then
    return null;
  end if;
  select id into key_id from vault.secrets where name = 'phone_encryption_v1' limit 1;
  if key_id is null then
    raise exception 'Vault key phone_encryption_v1 not found';
  end if;
  select vault.decrypt(phone_ct, key_id) into plaintext;
  return convert_from(plaintext, 'utf8');
end;
$$;

-- Bloquear acceso desde anon/authenticated. Solo service_role
-- (edge functions) puede invocar — y solo después de validar JWT.
revoke execute on function public.encrypt_phone(text) from public, anon, authenticated;
revoke execute on function public.decrypt_phone(bytea) from public, anon, authenticated;

comment on function public.encrypt_phone(text) is
  'SECURITY DEFINER. Service-role-only. Encrypts a phone number string with the Vault-managed phone_encryption_v1 key.';
comment on function public.decrypt_phone(bytea) is
  'SECURITY DEFINER. Service-role-only. Decrypts a phone ciphertext back to UTF-8 plaintext.';
