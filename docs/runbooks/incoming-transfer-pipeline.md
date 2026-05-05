# Incoming transfer pipeline — runbook

> Cómo Moneto detecta + procesa transferencias entrantes. Sprint 4.01 +
> 4.03. Status mayo 2026: producción-ready core, polling backup
> documentado pero deferred a Sprint 8.

---

## Pipeline overview

```
1. External wallet → SPL transfer to Moneto user pubkey
            │
            ▼
2. Solana validator confirms tx
            │
            ▼
3. Helius webhook fires (typically <2s post-confirm)
            │  POST /webhooks/helius/incoming
            │  Authorization: <HELIUS_WEBHOOK_SECRET>
            ▼
4. apps/api/src/routes/webhooks/helius.ts
   ├── verifyHeaderAuth — constant-time HMAC-style check
   ├── HeliusBatchSchema.parse — zod validate envelope
   ├── For each event/transfer:
   │     ├── filter ACCEPTED_MINTS (sólo mints del registry)
   │     ├── lookup wallet_index (Sprint 4.01) → user_id
   │     ├── anti-dust gate (Sprint 4.03)
   │     ├── per-user rate limit gate (Sprint 4.03, 100/h)
   │     └── processIncomingTransfer:
   │           ├── INSERT processed_signatures (idempotency)
   │           ├── INSERT incoming_transfers (audit, no PII amounts)
   │           └── push.sendToUser (best-effort)
   └── Response 200 + counts
            │
            ▼
5. Mobile receives push — tap deep links to /(tabs)
            │
            ▼
6. Mobile poll de useBalance (30s stale) refresca con nuevo balance
```

---

## Onboarding new users into Helius webhook

**Auto** (Sprint 4.03): cuando el mobile llama `POST /api/me/push-tokens`
en su primer authenticated session, el handler de `me.ts`:

1. Resuelve wallet vía Privy admin.
2. Upserts `wallet_index (wallet_address, user_id)`.
3. Upserts `push_tokens (token, user_id, platform, ...)`.
4. **Fire-and-forget** `addAddressToWebhook(walletAddress, env)` via
   `c.executionCtx.waitUntil()`. La response no espera el round trip
   a Helius.

**Manual fallback**: si el auto-add falla repetidamente (Helius API
down + nuestro user no recibe pushes), ops puede agregar batches via
`apps/api/src/services/helius-config.ts`:

```bash
# Pseudo — no CLI todavía. Sprint 4.10 puede agregar un wrangler dev
# command que lea wallet_index y sync con Helius.
```

---

## Idempotency

**Lock**: `processed_signatures` con PK compuesta `(signature, mint)`.
INSERT con conflict catch (`23505`) → tratamos como duplicate y skip.

**Por qué `(signature, mint)` y no solo `signature`**: una signature
puede mover MÚLTIPLES SPL tokens (un sender hace USDC + PYUSD a un
recipient en una sola tx). Queremos procesar AMBOS — la PK compuesta
permite eso sin duplicar.

**Retry-safety**: Helius reintenta con exponential backoff si recibe
non-2xx. Nuestro handler responde 200 incluso cuando hay errores per
transfer (logueamos + continuamos). Esto evita que una mala fila bloquee
el batch entero.

---

## Anti-dust + rate limit

**Dust** (Sprint 4.03): por categoría del asset:

- `stable_usd`, `stable_eur`, `stable_local`: floor `0.01` (≈ $0.01).
- `volatile`: floor `0.0001` (≈ $0.01-100 según el asset).

Sprint 5+ con price service: convertir todo a USD-equivalent y aplicar
floor único. Por ahora category-based heuristic.

**Rate limit per user** (Sprint 4.03): `processed_signatures.count` en
la última hora. Si > 100 → drop con log warn. Fail-open: si la query
de count falla, NO bloqueamos (mejor un push spam ocasional que perder
un legit).

---

## Cleanup cron (Sprint 4.03)

Cron `0 3 * * *` (3am UTC, ~10pm CO / 12am AR). Triggers:

- `processed_signatures > 90d` → delete.
- `push_tokens` con `invalidated_at > 30d` → delete.
- `incoming_transfers > 365d` → delete (audit retention 1y).

`early_access_requests` NO se borran — dato marketing valioso.

Wrangler config: `wrangler.toml [triggers] crons = ["0 3 * * *"]` en
dev + staging + production envs.

---

## Backup polling — DESIGN (Sprint 8 implementation)

### Por qué necesitamos

- Helius webhook puede tener outage (raro pero real).
- Si el address aún no está en `accountAddresses` cuando llegó la tx
  (race signup → first incoming).
- Sentry alert no llega al user — necesitamos un safety net.

### Estrategia propuesta

```
Cron */5 * * * * →
  1. Para cada wallet en `wallet_index` modificado en últimas 24h:
     a. Query `getSignaturesForAddress(wallet, { limit: 20 })` vía Helius RPC.
     b. Para cada signature, check si está en `processed_signatures`.
     c. Si NO está, fetch el detail (`getTransaction(sig)`) y procesarla
        manualmente vía processIncomingTransfer.
  2. Update `wallet_index.last_polled_at` para skip en próximas runs.
```

### Por qué deferred a Sprint 8

- **Costo**: cada wallet poll = 1 RPC `getSignaturesForAddress` + N
  `getTransaction` per missed sig. Para 10k usuarios = 10k RPC calls
  cada 5min = 2.88M/día. Helius free tier es 100k/día. Necesitamos
  paid tier o smart batching.
- **Smart batching**: agrupar wallets en chunks, query con `getMultipleAccounts`
  para latest tx + diff vs last_polled_signature. Reduces RPC quota
  dramáticamente.
- **State management**: `wallet_index` necesita `last_polled_at` +
  `last_polled_signature` columnas. Migration adicional.
- **Edge function timeout**: Cloudflare Workers cap `scheduled` a 30s.
  Para procesar 10k wallets necesitamos batching + Durable Objects o
  un Inngest queue.

### Alternative ya disponible: pull-on-app-open

El mobile poll de `useBalance` (30s stale + on-foreground refresh) es
nuestro safety net actual. Si el user abre la app, ve el balance
correcto (Helius RPC se consulta directo en `/api/me/balance` con
`getAssetsByOwner`). El push notification es UX nicety, no la fuente
de verdad.

Esto cubre 95% de casos. Sprint 8 implementa polling para el 5%
restante (user nunca abre la app pero recibe transferencias y debería
ver alerta).

---

## Observability

**Logs estructurados** (Axiom):

- `webhooks.helius` — recibimientos webhook + procesamiento per batch.
- `transfer.handler` — idempotency + audit + push dispatch.
- `push` — Expo Push API responses + token invalidation.
- `helius.config` — auto-add de wallets al webhook.
- `jobs.cleanup` — cron daily counts.

**Cero PII**: amounts, balances, from_addresses (full pubkey), nunca
en plain logs. Signatures truncadas a 12 chars para legibility.

**Sentry tags**:

- `webhook_source: helius` — distingue de futuros webhooks (Persona,
  Stripe).
- Tx signature truncada en `extra` para correlation con on-chain
  explorers.

---

## Failure modes + recovery

| Failure                                         | User impact                            | Recovery                                                             |
| ----------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Helius webhook down                             | No push, balance correcto al abrir app | Wait Helius restore. Sprint 8 backup poll catches retroactive.       |
| `wallet_index` lookup miss                      | Push silently dropped                  | User abre app → `useBalance` muestra correcto. Re-bind via re-login. |
| Push API down                                   | No notification                        | Mobile shows balance al refresh manual.                              |
| `processed_signatures` insert fails (transient) | Possible duplicate push                | Idempotency lock relax — duplicate push at worst. Acceptable.        |
| Cron cleanup fails                              | Tablas crecen sin podar                | Manual cleanup via SQL Editor en Supabase.                           |
| Rate limit too aggressive                       | User legit pierde notifs               | Bump `RATE_LIMIT_PER_HOUR` const + redeploy.                         |

---

## Provisioning checklist (production launch)

- [ ] Helius dashboard: crear webhook con URL `https://api.moneto.xyz/webhooks/helius/incoming`.
- [ ] `wrangler secret put HELIUS_WEBHOOK_SECRET --env production`.
- [ ] `wrangler secret put HELIUS_WEBHOOK_ID --env production` (del dashboard).
- [ ] Verificar `HELIUS_API_KEY` ya está set (Sprint 0).
- [ ] Apply migrations 0010 + 0011 en Supabase prod.
- [ ] Deploy worker — cron schedule activado automáticamente.
- [ ] Smoke: `curl POST /webhooks/helius/incoming` con secret válido + payload sample → 200.
- [ ] Smoke: registrar push token desde un Test Flight build → verificar `wallet_index` populado en Supabase.
- [ ] Trigger una real $0.50 USDC transfer al test wallet → notif en <30s.
