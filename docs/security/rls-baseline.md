# Supabase RLS baseline

> Templates SQL para **default deny + explicit allow** policies en cada
> tabla creada. Aplicar ANTES de exponer la tabla al cliente. Sprint 1
> creará `packages/db` con migraciones reales — este doc es la fuente de
> verdad de los patrones.

---

## Principio rector

**Toda tabla con datos del user activa RLS desde su creación.** El
service-role key del server bypass-ea RLS (por design); el anon key del
mobile/web está bound por las policies. Si una tabla nunca tendrá data
queryable desde mobile, igual activá RLS y dejá CERO policies (deny all).

```sql
alter table <table> enable row level security;
-- Sin policies = nadie puede leer/escribir vía anon key. Solo service-role.
```

---

## Pattern 1 — User owns sus rows (most common)

```sql
-- Tabla típica: profiles, user_preferences, viewing_keys, recovery_config.
alter table profiles enable row level security;

create policy "own_select" on profiles
  for select using (auth.uid() = id);

create policy "own_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "own_insert" on profiles
  for insert with check (auth.uid() = id);

-- DELETE rara vez se permite directo desde mobile — preferir soft-delete
-- (`deleted_at` column) y dejar el hard delete al server con service-role.
```

**Test (post-deploy)**:

```bash
# User A intenta leer profile de User B → debe fallar.
curl -H "Authorization: Bearer <USER_A_JWT>" \
  "$SUPABASE_URL/rest/v1/profiles?id=eq.<USER_B_ID>"
# Expected: [] (vacío, no error — RLS filtra silenciosamente)

# User A leyendo su propio profile → debe retornar el row.
curl -H "Authorization: Bearer <USER_A_JWT>" \
  "$SUPABASE_URL/rest/v1/profiles?id=eq.<USER_A_ID>"
# Expected: [{...}]
```

---

## Pattern 2 — Read-only public catalog (currencies, asset metadata)

```sql
-- Tabla con data pública (asset registry, country codes, etc.).
alter table assets enable row level security;

create policy "public_read" on assets
  for select using (true);

-- No insert/update/delete via anon key — server escribe con service-role.
```

---

## Pattern 3 — Append-only audit log

```sql
-- Audit logs: el user puede ver SU propia actividad, no la de otros.
-- Inserts solo del server (service-role).
alter table audit_log enable row level security;

create policy "own_audit_read" on audit_log
  for select using (auth.uid() = user_id);

-- Sin insert/update/delete policies → solo service-role escribe.
```

---

## Pattern 4 — Shared resource (recovery guardians)

```sql
-- recovery_guardians: user A invita a B como guardian → B ve "soy guardian de A".
-- Doble lectura: el dueño de la cuenta + cada guardian.
alter table recovery_guardians enable row level security;

create policy "own_or_guardian_read" on recovery_guardians
  for select using (
    auth.uid() = account_id      -- el dueño
    or auth.uid() = guardian_id  -- el guardian
  );

create policy "owner_manage" on recovery_guardians
  for insert with check (auth.uid() = account_id);

create policy "owner_remove" on recovery_guardians
  for delete using (auth.uid() = account_id);

-- Update no se permite — re-invitar = delete + insert, audit trail más limpio.
```

---

## Pattern 5 — Service-role-only tables (no anon access)

```sql
-- Tablas que NUNCA se queryan desde cliente: sanctions hits, KYC artifacts,
-- compliance logs, internal counters.
alter table compliance_events enable row level security;
-- Sin policies → bloqueado para anon. Server con service-role bypasses.
```

---

## Tablas planeadas (Sprint 1) y patterns esperados

| Tabla                | Pattern         | Notas                                            |
| -------------------- | --------------- | ------------------------------------------------ |
| `profiles`           | 1 (own)         | Privy DID, country, kyc_level, NO wallet_address |
| `user_preferences`   | 1 (own)         | theme, locale, biometric_enabled                 |
| `viewing_keys`       | 1 (own)         | Encrypted at rest; never queried by addr         |
| `recovery_guardians` | 4 (shared)      | Invitation + acceptance flow                     |
| `recovery_attempts`  | 1 (own)         | 48h timelock state                               |
| `audit_log`          | 3 (append-only) | All sensitive actions                            |
| `kyc_submissions`    | 5 (server-only) | Persona payloads, retention 7 años               |
| `compliance_events`  | 5 (server-only) | Sanctions hits, SAR triggers                     |
| `assets`             | 2 (public read) | Currency catalog                                 |
| `feature_flags`      | 2 (public read) | PostHog mirror para offline mode                 |

---

## Migration testing checklist (pre-deploy)

Antes de aplicar una migration a staging/prod:

- [ ] La migration tiene `up` y `down` reversibles.
- [ ] `enable row level security` está en el `up` para cada tabla nueva.
- [ ] Cada tabla tiene policies o está intencionalmente service-role-only (commented).
- [ ] Test local con 2 users distintos: User A no puede ver/modificar data de User B.
- [ ] Test de service-role bypass: el server (con service-role key) puede leer/escribir todo.
- [ ] Si la migration toca data sensible (KYC, balances mirror), code review doble (CODEOWNERS lo enforce).

---

## Common mistakes (lessons learned proactivos)

### ❌ Olvidar `with check` en policies de update/insert

```sql
-- MAL — permite cambiar `id` (escalar a otro user).
create policy "own_update" on profiles
  for update using (auth.uid() = id);

-- BIEN — `with check` valida que el row resultante también es propio.
create policy "own_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
```

### ❌ Anon key con permisos de service-role

```ts
// MAL — el anon key NUNCA debería bypassar RLS.
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// BIEN — anon key + Bearer del user.
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${userJwt}` } },
});
```

### ❌ Service-role key en mobile

NUNCA. Si lo necesitás, refactorizar a un endpoint de tu API que valide
permisos server-side y haga la llamada con service-role. Mobile solo habla
con tu API + Supabase con anon + JWT.

### ❌ RLS habilitado pero sin policies en una tabla queryable

Si `enable rls` pero no hay policies, la tabla queda **silenciosamente
unreadable** desde anon. El user ve lista vacía sin error. Dificulta debug.
Verificar siempre con un curl post-deploy.

---

## Operational queries (para debugging)

```sql
-- Listar tablas con RLS habilitado vs deshabilitado.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public';

-- Listar todas las policies por tabla.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Test policy con un user específico (Supabase SQL editor).
set local role authenticated;
set local request.jwt.claims = '{"sub": "<USER_ID>"}';
select * from profiles where id = '<OTHER_USER_ID>';
-- Expected: 0 rows
reset role;
```

---

## Quality gates (sprint 1 cuando creemos `packages/db`)

- [ ] Cada tabla en una migration tiene `enable row level security` o comment `-- service-role-only`.
- [ ] CI corre un test que verifica RLS está habilitado en TODAS las tablas no-public.
- [ ] Pre-deploy a staging: smoke test cross-user (User A ↛ B's data).
- [ ] Pre-deploy a prod: founder approval requerido (CODEOWNERS).
- [ ] Documentar cualquier tabla service-role-only en comment + en este doc.
