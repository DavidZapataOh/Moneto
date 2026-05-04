# External setup — pre-CI/CD checklist

> Lista de tareas que el founder debe completar **fuera del repo** para que
> el pipeline (Sprint 0.03) funcione end-to-end. Filesystem ya está listo
> (workflows, EAS config, wrangler.toml); falta credentials + recursos.

---

## 1. GitHub repo settings

### Branch protection (Settings → Branches → Add rule)

Pattern: `main`

- ✅ Require a pull request before merging
- ✅ Require approvals: **1**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners
- ✅ Require status checks to pass before merging:
  - `Lint · Typecheck · Test · Build` (job `validate` en `ci.yml`)
  - `Security audit` (job `security-scan` en `ci.yml`)
  - `Conventional Commits` (job `commitlint` en `ci.yml`)
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ❌ Require signed commits — agregar en Sprint 8 (requiere setup de GPG en cada dev machine)
- ❌ Allow force pushes — never
- ❌ Allow deletions — never

### Environments (Settings → Environments)

Crear 2 environments:

- **`staging`** — sin protection rules. Auto-deploy desde main.
- **`production`** — con protection rules:
  - Required reviewers: founder
  - Wait timer: 0 (manual approval suficiente)
  - Deployment branches: `main` only

### Repo secrets (Settings → Secrets and variables → Actions)

Agregar a nivel **repository**:

| Secret                  | Origen                                                                      | Usado en                                             |
| ----------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| `EXPO_TOKEN`            | https://expo.dev → Account settings → Access tokens                         | `ci.yml` (preview), `main-deploy.yml`, `release.yml` |
| `CLOUDFLARE_API_TOKEN`  | CF dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template | `main-deploy.yml`, `release.yml`                     |
| `CLOUDFLARE_ACCOUNT_ID` | CF dashboard → Workers & Pages → sidebar copy "Account ID"                  | `main-deploy.yml`, `release.yml`                     |
| `VERCEL_TOKEN`          | https://vercel.com/account/tokens                                           | `main-deploy.yml`, `release.yml`                     |
| `VERCEL_ORG_ID`         | `vercel link` en `apps/web/`, copiar de `.vercel/project.json`              | `main-deploy.yml`, `release.yml`                     |
| `VERCEL_PROJECT_ID_WEB` | mismo `.vercel/project.json`                                                | `main-deploy.yml`, `release.yml`                     |

---

## 2. Cloudflare Workers

### Account + zones

1. Crear/usar account de Cloudflare con `moneto.xyz` zone (DNS administrado por CF).
2. Crear API token con scopes: `Workers Scripts:Edit`, `Account:Read`, `Zone:Read`, `Zone Settings:Edit`. Guardar como GH secret `CLOUDFLARE_API_TOKEN`.

### DNS

Una vez `moneto.xyz` está en CF, descomentar las líneas `routes = [...]` en `apps/api/wrangler.toml` para cada env. Wrangler se encarga de propagar el route durante deploy.

### Recursos (KV / D1)

Por ahora `wrangler.toml` los tiene **comentados** porque no tenemos ids reales. Cuando los necesitemos:

```bash
# Crear KV namespace para rate limits
pnpm --filter @moneto/api exec wrangler kv:namespace create RATE_LIMITS --env staging
# → copiar el `id` del output a wrangler.toml [[env.staging.kv_namespaces]]
```

---

## 3. Expo / EAS

1. Crear org `moneto` en https://expo.dev.
2. `cd apps/mobile && pnpm exec eas init --id moneto/moneto` (linkea el `extra.eas.projectId`).
3. Generar token: Account settings → Access tokens → "EAS CI". Guardar como GH secret `EXPO_TOKEN`.
4. (Sprint 8) Configurar credentials en EAS:
   - iOS: `pnpm exec eas credentials --platform ios` → genera distribution cert + provisioning profile.
   - Android: keystore creado por EAS al primer build.

### App Store Connect / Play Console (Sprint 8)

- Reemplazar `"ascAppId": "TBD"` y `"appleTeamId": "TBD"` en `apps/mobile/eas.json` con valores reales.
- Crear `apps/mobile/google-service-account.json` (NO commitear — `.gitignore` ya lo cubre).

---

## 4. Vercel (web app)

1. `cd apps/web && pnpm exec vercel link` — crea `.vercel/project.json` con `orgId` + `projectId`. **NO commitear**.
2. Copiar esos ids a GH secrets (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`).
3. Configurar dominios:
   - `staging.moneto.xyz` → preview env
   - `moneto.xyz` → production env

---

## 5. Smoke test del pipeline

Una vez todo lo anterior está hecho:

```bash
# Crear branch + PR de prueba
git checkout -b test/ci-smoke
echo "smoke" >> /tmp/ignore.txt
git add /tmp/ignore.txt 2>/dev/null || true
git commit --allow-empty -m "chore(ci): smoke test workflows"
git push -u origin test/ci-smoke
gh pr create --title "chore(ci): smoke test" --body "Verifying CI pipeline"
```

Verificar en el PR:

- `validate` corre y termina en <5min.
- `security-scan` corre.
- `commitlint` valida el mensaje.
- Sin label `preview-build` el job de EAS NO arranca.

---

## 6. Updates a este runbook

Este doc es el "single source of truth" para setup operativo. Actualizar cada
vez que se agregue una integración externa (Sentry DSN, Axiom, Privy keys,
Helius, Chainalysis, etc.). El founder debe poder hacer onboarding de un
nuevo entorno (e.g., "preview de PRs" o "staging-2") siguiendo este doc sin
tener que leer los workflows.
