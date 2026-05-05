# Supabase setup runbook

> Paso a paso para inicializar los 3 proyectos de Supabase
> (`moneto-dev`, `moneto-staging`, `moneto-prod`), aplicar migrations,
> deploy edge functions, y configurar el bridge de Custom JWT con Privy.
>
> **Prerrequisito**: ya creaste las cuentas Supabase + Privy según
> `docs/runbooks/external-setup.md`.

---

## Step 1 — Instalar Supabase CLI

```bash
brew install supabase/tap/supabase
supabase --version  # >= 1.180
```

(Linux: descargar binary desde https://github.com/supabase/cli/releases.)

---

## Step 2 — Login + linkear el proyecto dev

```bash
supabase login
# Te abre browser para auth.

cd packages/db
supabase link --project-ref <DEV_PROJECT_REF>
# El project ref aparece en el dashboard URL: https://supabase.com/dashboard/project/<REF>
```

Esto crea `supabase/.temp/` (gitignored) con el state del link.

---

## Step 3 — Aplicar las 5 migrations

```bash
pnpm --filter @moneto/db db:push
# Equivalente a: supabase db push
# Aplica en orden: 0001 → 0002 → 0003 → 0004 → 0005.
```

Verificar:

```bash
supabase db remote ls
# Deberías ver las 5 migrations marked como applied.
```

Smoke verification de RLS (en Supabase SQL editor):

```sql
-- Listar tablas con RLS habilitado.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
-- Esperado: profiles, user_preferences, guardian_notifications, viewing_keys
-- todos con rowsecurity = true.

-- Listar policies por tabla.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
-- Esperado: 3 policies por table (select/insert/update) excepto
-- guardian_notifications que solo tiene 2 (select/update — insert via
-- service_role).

-- Verificar que profiles NO tiene wallet_address.
\d public.profiles
-- Esperado: NO debe aparecer wallet_address en la lista de columns.
```

Si algo falla en el verify, **NO seguir** — el invariant de
compartmentalization es P0. Investigar antes de continuar.

---

## Step 4 — Deploy del edge function `sync-profile`

```bash
# Set los secrets del fn — accesibles vía Deno.env.get().
supabase secrets set PRIVY_APP_ID=<your-privy-app-id>
# Los SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ya están auto-disponibles.

# Deploy.
pnpm --filter @moneto/db fn:deploy sync-profile
# Equivalente a: supabase functions deploy sync-profile
```

Verificar deployment:

```bash
supabase functions list
# Esperado: sync-profile listed con last deploy timestamp reciente.
```

Smoke test (con un Privy JWT de prueba):

```bash
TOKEN="<privy-access-token-from-mobile-debug>"
curl -X POST https://<DEV_REF>.supabase.co/functions/v1/sync-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "smoketest",
    "country_code": "CO",
    "name": "Smoke Test"
  }'
# Esperado: {"ok": true, "user_id": "did:privy:..."}
```

---

## Step 5 — Configurar Custom JWT (Privy → Supabase)

Esto es lo que permite que mobile pegue Privy JWTs como Bearer y Supabase los acepte como auth válido (auth.uid() = sub claim del JWT).

### Privy dashboard

1. **App settings → Configuration**: copiar el JWKS URL
   `https://auth.privy.io/api/v1/apps/<PRIVY_APP_ID>/jwks.json`.

### Supabase dashboard

1. Project → **Authentication → Sign In / Providers** → desactivar todo
   (Email, Google, Apple, etc.). Privy es el único IdP.
2. Project → **Settings → API → JWT Settings**:
   - **JWT signing keys**: agregar "Third-party JWT" o equivalente (UI varía
     por versión Supabase).
   - **JWKS URL**: pegar el de Privy.
   - **Issuer**: `privy.io`.
   - **Audience**: `<PRIVY_APP_ID>`.
   - **Subject claim**: `sub`.

3. Save.

Smoke test (mismo curl que step 4 pero contra una tabla con RLS):

```bash
curl "https://<DEV_REF>.supabase.co/rest/v1/profiles?select=id" \
  -H "Authorization: Bearer $PRIVY_TOKEN" \
  -H "apikey: $ANON_KEY"
# Esperado: array con UN profile (el del user del JWT). Si retorna [],
# revisar que el JWT sub claim coincida con el id del profile creado.
```

---

## Step 6 — Repetir 2-5 para staging y production

```bash
# Staging
supabase link --project-ref <STAGING_REF>
pnpm --filter @moneto/db db:push
supabase secrets set PRIVY_APP_ID=<staging-privy-app-id>
pnpm --filter @moneto/db fn:deploy sync-profile

# Production
supabase link --project-ref <PROD_REF>
pnpm --filter @moneto/db db:push
supabase secrets set PRIVY_APP_ID=<prod-privy-app-id>
pnpm --filter @moneto/db fn:deploy sync-profile
```

**Producción**: configurar también:

- **PITR (Point-in-time Recovery)**: paid tier feature. Habilitar en
  Project Settings → Database → Backups.
- **Daily backups**: viene incluido en Pro plan.
- **Read replicas**: Sprint 8+ si hay tráfico justifica.
- **Vault key rotation**: ver `docs/runbooks/secret-rotation.md` —
  `phone_encryption_v1` rotar cada 90 días.

---

## Step 7 — Pegar las URLs/keys en los .env del mobile

Los valores que necesita el mobile (`apps/mobile/.env.local`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<DEV_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (desde Project Settings → API → anon key)
```

⚠️ **Nunca** pegar el `service_role_key` en mobile. Solo el anon key.
El service-role solo vive en edge fns + Wrangler secrets para el API
backend.

---

## Step 8 — Smoke test full flow (mobile + Supabase)

1. Build dev client mobile: `eas build --profile development --platform ios`.
2. Install en device, abrir app.
3. Auth flow: Sign in with Apple/Google.
4. Después del callback Privy success → debería triggerear
   `syncProfileToSupabase`.
5. Verificar en Supabase dashboard → Table Editor → `profiles`: tu row
   apareció con tu Privy DID, handle derivado del email, `kyc_level=0`.
6. Verificar `user_preferences`: row con defaults (theme=system, etc.).
7. Logout + re-login → mismo `user_id`, no se duplica el row.

---

## Troubleshooting

| Síntoma                                                       | Probable causa                                             | Fix                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `db:push` falla con "permission denied"                       | No linked al project, o token expirado                     | `supabase login` + `supabase link --project-ref X`                                                                        |
| Edge fn 401 "invalid_token"                                   | Privy app ID no matchea el del token, o JWKS no fetcheable | Verificar `supabase secrets list` muestra `PRIVY_APP_ID` correcto                                                         |
| Edge fn 401 "invalid_subject"                                 | El JWT `sub` no empieza con `did:privy:`                   | Probablemente estás mandando un Supabase-issued JWT en lugar del Privy. Ver mobile `getAccessToken()` retorna Privy token |
| `select * from profiles` devuelve [] desde mobile post-signup | Custom JWT no está configurado o el sub claim no matchea   | Step 5 — verificar JWKS URL + audience                                                                                    |
| `wallet_address column does not exist` en query               | ✅ correcto — confirma compartmentalization                |
| Vault encryption error "key not found"                        | Migration 0005 no se aplicó, o vault extension no enabled  | Re-run `db:push`, verificar `select * from vault.secrets`                                                                 |

---

## Migrations futuras (workflow Sprint 1+)

Cuando agregamos tablas/columnas:

1. Crear nuevo file: `packages/db/supabase/migrations/000N_descripcion.sql`.
2. Local-first dev: `supabase start` + `supabase db reset` para verificar
   las migrations corren clean from scratch.
3. Apply a dev: `pnpm --filter @moneto/db db:push`.
4. Test con curl + RLS test suite.
5. Commit + PR (CODEOWNERS valida si toca `profiles`).
6. Merge → CI deploy a staging vía workflow.
7. Manual approval → CI deploy a prod.

**Reglas hard**:

- Cada migration tiene `up` reversible (DROP TABLE/COLUMN/POLICY como
  comment al final si needed). Down explícito Sprint 8 cuando agregamos
  tooling de rollback automatic.
- Migrations son **additive** cuando sea posible — agregar columna
  nullable + backfill + drop NOT NULL constraint en migration siguiente,
  no breaking changes single-shot.
- Test en staging ANTES de prod siempre.
- Si la migration toca `profiles`, doble review (founder + senior).

---

## Quality gates

- [ ] 5 migrations aplicadas en dev (`supabase db remote ls`).
- [ ] RLS habilitado en las 4 tablas (verify con SQL).
- [ ] `wallet_address` NO existe en `profiles` (verify con `\d`).
- [ ] Edge fn `sync-profile` deployed y curl smoke pasa.
- [ ] Custom JWT bridge configurado en Supabase dashboard.
- [ ] Mobile `.env.local` tiene URL + anon key reales.
- [ ] Smoke test full flow: signup mobile → row aparece en `profiles`.
- [ ] Service-role key NUNCA en mobile bundle (verify con `grep -r service_role apps/mobile`).
- [ ] Repetido para staging.
- [ ] (Sprint 4+) Repetido para production con PITR + backups.
