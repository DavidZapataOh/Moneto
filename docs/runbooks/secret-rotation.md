# Secret rotation runbook

> Cómo rotar credentials sin downtime. Aplicar cada **90 días** o ante
> cualquier sospecha de exposure (laptop perdida, dev offboarding,
> incidente público del provider).

---

## Inventario de secrets

| Secret                        | Dónde vive                    | Provider                                    | Quien lo necesita  | Rotación         |
| ----------------------------- | ----------------------------- | ------------------------------------------- | ------------------ | ---------------- |
| `PRIVY_APP_SECRET`            | CF Workers (`apps/api`)       | privy.io dashboard                          | API server-side    | 90d              |
| `SUPABASE_SERVICE_ROLE_KEY`   | CF Workers (`apps/api`)       | supabase.com → Project Settings → API       | API server-side    | 90d              |
| `HELIUS_API_KEY`              | CF Workers (`apps/api`)       | helius.dev                                  | API + indexers     | 90d              |
| `CHAINALYSIS_API_KEY`         | CF Workers (`apps/api`)       | sales contact                               | Compliance bridge  | 180d             |
| `JUPITER_API_KEY`             | CF Workers (`apps/api`)       | jup.ag (si aplica)                          | Swap quotes        | 90d              |
| `BOLD_API_KEY`                | CF Workers (`apps/api`)       | Bold partner portal                         | Colombia rails     | 90d              |
| `RAIN_API_KEY`                | CF Workers (`apps/api`)       | Rain partner portal                         | Card issuance      | 90d              |
| `SENTRY_DSN`                  | CF Workers + EAS env          | sentry.io project settings                  | Crash reporting    | 365d (raramente) |
| `AXIOM_TOKEN`                 | CF Workers                    | axiom.co API tokens                         | Log shipping       | 90d              |
| `EXPO_TOKEN`                  | GH repo secret                | expo.dev → Account settings → Access tokens | CI workflows       | 90d              |
| `CLOUDFLARE_API_TOKEN`        | GH repo secret                | CF dashboard → My Profile → API Tokens      | CI workflows       | 90d              |
| `VERCEL_TOKEN`                | GH repo secret                | vercel.com/account/tokens                   | CI workflows       | 90d              |
| `google-service-account.json` | EAS local file (NOT commited) | GCP IAM → service account                   | EAS Android submit | 365d             |

---

## Procedimiento general (zero-downtime)

Para credenciales que se usan en hot-path (API), rotar siguiendo el patrón
**A/B**:

1. **Generar el nuevo secret** en el provider sin invalidar el anterior.
2. **Push del nuevo secret** a CF Workers (sobreescribe el anterior, pero el
   request en flight no se ve afectado — Workers re-lee el env en el próximo
   isolate cold-start, milisegundos).
3. **Verificar en logs** (Axiom / Sentry) que no hay errores 401/403 desde
   los providers afectados durante 5–10 min.
4. **Invalidar el secret antiguo** en el provider's dashboard.
5. **Documentar la rotación** en el changelog interno (fecha + secret + quien rotó).

---

## Cloudflare Workers (`PRIVY_APP_SECRET` ejemplo)

```bash
# 1. Generar nuevo secret en privy.io dashboard. Copiar al portapapeles.

# 2. Push a staging primero (smoke test):
pnpm --filter @moneto/api exec wrangler secret put PRIVY_APP_SECRET --env staging
# (paste cuando prompt)

# 3. Verificar staging /health + un endpoint que use Privy.
curl -sf https://api-staging.moneto.xyz/health

# 4. Push a producción:
pnpm --filter @moneto/api exec wrangler secret put PRIVY_APP_SECRET --env production

# 5. Tail logs por 10 min:
pnpm --filter @moneto/api exec wrangler tail --env production --format pretty

# 6. Si todo OK, invalidar el secret viejo en privy.io.
```

### Listado / borrado

```bash
# Listar secrets en cada env (no muestra values, solo names):
pnpm --filter @moneto/api exec wrangler secret list --env production

# Borrar un secret obsoleto:
pnpm --filter @moneto/api exec wrangler secret delete <NAME> --env production
```

---

## GitHub repo secrets (`EXPO_TOKEN` ejemplo)

```bash
# 1. Generar nuevo token en expo.dev.

# 2. Update con gh CLI (no expone el valor):
gh secret set EXPO_TOKEN --body "$NEW_TOKEN"

# 3. Trigger un workflow que lo use (e.g., re-run del último PR con label preview-build).

# 4. Si todo OK, revoke el token viejo en expo.dev.
```

---

## Si hay sospecha de exposure (incidente)

**Acción inmediata** (sin esperar el ciclo de 90d):

1. **Rotar el secret afectado AHORA** siguiendo el procedimiento A/B.
2. **Auditar logs** del provider — buscar uso anómalo en las últimas 24h
   (geo, IPs, endpoints inusuales).
3. **Notificar a partners** si su API key fue afectada (Bold, Rain, Helius) —
   suelen tener procedimientos propios.
4. **Post-mortem** en `docs/incidents/YYYY-MM-DD-<slug>.md` con timeline,
   impacto, root cause, mitigation, action items.

---

## Cómo evitar exposure en primer lugar

- ❌ **Never** commitear `.env*` con valores reales. `.env.example` solo con
  placeholders. `.gitignore` ya cubre `*.env`, `*.pem`, `*.key`,
  `google-service-account.json`.
- ❌ **Never** loggear secrets — el logger de `@moneto/utils` debería
  filtrar keys conocidas en sprint 0.05 (TODO).
- ✅ **Always** usar `wrangler secret put` o `gh secret set` — nunca pasar
  values en CLI args (history del shell los registra).
- ✅ **Always** revocar tokens cuando un dev sale del equipo, mismo día.
- ✅ Code review: cualquier diff que toque `wrangler.toml`, workflow YAMLs,
  `.env*`, debe pasar por founder (CODEOWNERS lo enforce).
