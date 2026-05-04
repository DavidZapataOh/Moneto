# Observability conventions

> Reglas hard de qué loggear, qué nunca loggear, y cómo. Aplicables a
> mobile, api, web y todos los workers/jobs que agreguemos. Toda PR que
> toque código de logging/tracking debe verificar contra este doc.

---

## Stack actual (Sprint 0.05)

| Tool             | Wired?               | Para qué                                                       |
| ---------------- | -------------------- | -------------------------------------------------------------- |
| **Sentry**       | ✅ — mobile + api    | Error tracking + performance traces                            |
| **Axiom**        | ✅ — api logger sink | Structured logs, queryable, retention configurable             |
| **PostHog**      | ✅ — mobile init     | Product analytics + session replay (prod only) + feature flags |
| **Better Stack** | ⏳ Sprint 8          | Public uptime status                                           |

Cada SDK no-opea cuando su token público no está set — los devs nuevos no
tienen que configurar todo el stack en día 1.

---

## Regla #0 — privacy-first

Moneto es un **neobanco privado**. Loggear el balance de un user, su monto
de transacción o su counterparty contradice toda la tesis del producto. La
regla por defecto es **scrub everything, allowlist explícita**.

El scrubber de `@moneto/observability/scrub` reemplaza automáticamente
keys sensibles con placeholders (`[amount]`, `[address]`, `[secret]`,
`[pii]`) antes de mandar a Sentry/Axiom/PostHog. Pero la primera línea
de defensa es **no escribirlos en primer lugar**.

---

## ✅ Loggeable

| Field                                                           | Por qué OK                                     |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `userId` (Privy DID)                                            | Pseudónimo — no contiene PII directa           |
| `kyc_level` (0-3)                                               | Categorical, bucket analítico                  |
| `country` (ISO 2-letter)                                        | Bucket analítico, no identificable solo        |
| `app_version`, `build`, `runtime_version`                       | Release tracking                               |
| `screen`, `route`, `tab`                                        | Navigation analytics                           |
| `tx_type` (`p2p_in`, `cashout`, `swap`, etc.)                   | Categorical                                    |
| `error_code`, `error_name` (si no incluye PII)                  | Debugging                                      |
| `duration_ms`, `count`, `index`, `attempts`                     | Métricas operacionales                         |
| `feature_flag`, `variant`                                       | A/B testing                                    |
| `currency` (`USD`, `COP`, `MXN`)                                | Categorical                                    |
| `amount_bucket` (`<10`, `10-50`, `50-200`, `200-1000`, `>1000`) | Cardinality controlada vía `bucketAmountUsd()` |

---

## ❌ NUNCA loggear

| Field                                                      | Por qué                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `amount`, `balance`, `delta`, `value`, `usd`, `cop`, `mxn` | Financial PII — el thesis de Moneto es que esto **nunca** sale del device |
| `wallet_address`, `pubkey`, `address`                      | On-chain identity — correlacionable con la cadena pública                 |
| `private_key`, `seed_phrase`, `mnemonic`, `viewing_key`    | Compromiso total de fondos                                                |
| `tx_signature`, `tx_hash`, `signature`                     | Permite lookup en explorer + de-anonymization                             |
| `email`, `phone`, `name`, `handle`                         | PII directa, GDPR/LATAM regs                                              |
| `selfie_url`, `kyc_doc`, `cedula`, `rut`, `ssn`, `tax_id`  | KYC artifacts — solo viven en Persona/Supabase encrypted                  |
| `counterparty`, `recipient`, `to`, `from` (humanos)        | Social graph leak                                                         |
| `token`, `jwt`, `bearer`, `authorization`, `session`       | Account takeover risk                                                     |
| `password`, `pin`, `otp`, `passphrase`                     | Same                                                                      |
| `api_key`, `secret`                                        | Credential leak                                                           |

Si **necesitás** una de estas para debug, hacelo en logs LOCAL del device
(`console.warn` durante development), nunca al sink remoto.

---

## Buckets para campos sensibles

Cuando el feature legitimately necesita una distribución de amounts (e.g.
"qué % de cashouts son sub-100 USD?"), usar `bucketAmountUsd()`:

```ts
import { bucketAmountUsd, capture, Events } from "@moneto/observability";

capture(posthog, Events.send_completed, {
  type: "cashout",
  currency: "USD",
  fee_pct: 0.0075,
  amount_bucket: bucketAmountUsd(amountUsd), // → "50-200"
});
```

Buckets disponibles: `micro (<10)`, `small (10-50)`, `medium (50-200)`, `large (200-1000)`, `xlarge (>1000)`.

Para casos custom (KYC duration en minutos, retention cohort, etc.),
seguir el mismo patrón: round/round-down al bucket más cercano antes de
tracking.

---

## Logger usage (`@moneto/utils`)

```ts
import { createLogger } from "@moneto/utils";

const log = createLogger("auth"); // scope = feature/module name

log.debug("flow start"); // dev only
log.info("user signed in", { userId, method: "passkey", duration_ms: 450 });
log.warn("rate limit approaching", { route: "/auth/login", remaining: 3 });
log.error("login failed", { reason: "wrong_password" }); // NO password in data
```

**Reglas**:

- **Scope** = feature/module name. Mantener consistente para query.
- **Level**: `debug` (dev only) > `info` (events normales) > `warn` (degradación) > `error` (acción requerida).
- **Data** es opcional Record<string, unknown>. Pasa por el scrubber
  automáticamente si el sink es Axiom/Sentry. Pero **don't rely on it** —
  las reglas duras de arriba siguen aplicando.
- **Cero `console.log`** — ESLint lo bloquea. `console.warn|error|info`
  permitidos para casos puntuales (logger los usa internamente).

---

## Sentry conventions

- **Tags por tx type**: `Sentry.setTag("tx_type", "p2p_in")` antes de operación crítica.
- **Tags por screen**: usar Sentry navigation integration de Expo Router (auto-set en navigations).
- **User context**: `Sentry.setUser({ id: privyDid })` — solo el DID, sin email/handle/wallet.
- **Breadcrumbs**: auto desde navigation, network, console — todos pasan por scrubber.
- **`captureException`**: incluir tags + extra context **previamente scrubbed**.
- **No screenshots**: `attachScreenshot: false` — capturas pueden incluir montos.
- **No view hierarchy**: `attachViewHierarchy: false`.

```ts
import * as Sentry from "@sentry/react-native";

try {
  await sendTransaction(payload);
} catch (err) {
  Sentry.captureException(err, {
    tags: { tx_type: "p2p", screen: "send" },
    extra: {
      // OK — no leakea values:
      currency: payload.currency,
      amount_bucket: bucketAmountUsd(payload.amountUsd),
      // PROHIBIDO:
      // amount: payload.amountUsd,
      // recipient: payload.recipient,
    },
  });
  throw err;
}
```

---

## PostHog conventions

### Identificación

```ts
identifyUser({
  privyDid: user.id,
  country: profile.country, // bucket
  kycLevel: profile.kycLevel, // bucket
  appVersion: Constants.expoConfig.version,
});
```

NO pasar email, handle, balance, address. PostHog session replay tiene
auto-mask para `<TextInput>` por default — verificar que cualquier `<View>`
mostrando montos tenga `data-ph-no-capture` o equivalente RN.

### Eventos

Usar siempre el helper typed `capture()`:

```ts
import { capture, Events, getPostHog } from "@/lib/observability";

const ph = getPostHog();
if (ph) {
  capture(ph, Events.send_completed, {
    type: "p2p",
    currency: "USD",
    fee_pct: 0.0075,
    amount_bucket: bucketAmountUsd(amount),
  });
}
```

El enum `Events` es la **única fuente de verdad** para event names —
agregar nuevos en `packages/observability/src/events.ts` con el shape de
props que recibe (interface `EventProps`).

### Naming convention

- `<noun>_<verb>` snake_case (`send_initiated`, `auth_succeeded`).
- Tense pasado para acciones completadas, presente para starts, `_viewed` para impresiones.
- Mantener stable — renames rompen funnels históricos.

### Feature flags

Usar PostHog feature flags para rollout progresivo + kill-switch:

```ts
const enabled = ph?.isFeatureEnabled("cashout_bold_v2", {
  defaultValue: false,
});
if (enabled) {
  // new flow
} else {
  // safe path
}
```

Track flag evaluation con `Events.feature_flag_evaluated` para auditar
qué % de users vieron qué variant.

---

## Axiom conventions

### Datasets

- **`moneto-api`** — backend logs (Workers).
- **`moneto-mobile`** — solo errors/warnings importantes (no flood de info).
- **`moneto-jobs`** — cron / queue workers (post-MVP).
- **`moneto-compliance`** — audit trail KYC/sanctions (acceso restringido).

### Retention

| Env        | Retention                                    |
| ---------- | -------------------------------------------- |
| dev        | 7 días                                       |
| staging    | 30 días                                      |
| production | 7 años (mínimo regulatorio LATAM para banca) |

Configurable en Axiom dashboard — no en código.

### Queries pre-armadas (guardar en Axiom dashboards)

1. **API error rate (1h)** — `level == "error" \| summarize count() by route`
2. **Slow requests** — `duration_ms > 1000 \| sort by duration_ms desc \| take 50`
3. **Auth failures** — `route == "/auth" and status >= 400 \| summarize count() by reason`
4. **Cashout queue depth** — `event == "cashout_queued" \| count`
5. **KYC funnel** — `event in ("kyc_started", "kyc_submitted", "kyc_approved", "kyc_rejected") \| summarize count() by event`

---

## Funnels críticos a monitorear (PostHog)

Goal: cada funnel >70% conversion en happy path.

1. **Signup conversion** — `welcome_viewed` → `intro_completed` → `auth_succeeded` → `onboarding_completed` → `balance_viewed`
2. **First send** — `balance_viewed` → `send_initiated` → `send_completed`
3. **Cashout** — `balance_viewed` → `send_initiated` (type=cashout) → `send_completed`
4. **KYC upgrade** — `kyc_started` → `kyc_submitted` → `kyc_completed`
5. **Recovery** — `recovery_initiated` → `recovery_completed`

---

## Alerts (configurar en provider UIs)

| Alert               | Condition              | Channel            | Severity |
| ------------------- | ---------------------- | ------------------ | -------- |
| API 5xx spike       | >5 errors/min for 3min | PagerDuty + Slack  | **P1**   |
| Mobile crash spike  | >10 crashes/hour       | Slack              | P2       |
| Privy auth failures | >20% rate for 5min     | PagerDuty          | **P1**   |
| Cashout queue depth | >50 pending for 10min  | Slack + email      | P2       |
| Sanctions hit       | >0 (any)               | Slack + compliance | **P1**   |
| KYC failure rate    | >40% for 1h            | Slack + email      | P3       |
| Solana RPC errors   | >10 errors/min         | Slack              | P2       |
| Worker p99 latency  | >2s for 5min           | Slack              | P2       |

Configurar:

- Sentry: Project Settings → Alerts → New Issue Alert.
- Axiom: Monitors → New Monitor (KQL query + threshold).
- PostHog: Activity → Alerts.

Sprint 0.06 (security baseline) agrega rate-limit alerts. Sprint 8 agrega
Better Stack uptime alerts.

---

## Dashboards (Sprint 8)

Crear y compartir con todo el equipo:

- **Engineering** (Sentry + Axiom): API error rate, p95 latency, mobile crash-free rate, deploy frequency, build success %.
- **Product** (PostHog): DAU/WAU/MAU, D1/D7/D30 retention, funnel conversion, feature adoption.
- **Compliance** (Axiom + custom): KYC submissions, approval rate, SAR triggers, sanctions hits.

---

## Source maps (Sprint 8)

- **iOS / Android**: `@sentry/react-native` upload automático en EAS Build hook (post-build). Requiere `SENTRY_AUTH_TOKEN` en EAS env.
- **Cloudflare Workers**: `wrangler deploy --upload-source-maps` + post-deploy hook que sube a Sentry. Requiere `SENTRY_AUTH_TOKEN` en GH Actions secrets.

Sin source maps, los stack traces en producción son ofuscados — debugging casi imposible. Critical para post-launch.

---

## Cuando algo se rompe — playbook

1. **Sentry primero** — ¿hay un error nuevo? ¿qué % de users afectados?
2. **Axiom logs** — buscar el `userId` (DID) en logs alrededor del timestamp.
3. **PostHog session replay** (solo prod) — ver qué hizo el user antes del error.
4. **Slack #moneto-incidents** — postear summary + Sentry link, abrir incident channel si P1.
5. **Post-mortem** en `docs/incidents/YYYY-MM-DD-<slug>.md`.

---

## Auditoría — cómo verificamos que cumplimos estas reglas

- **CI**: ESLint bloquea `console.log`. CodeQL (Sprint 0.06) flagea uso directo de `Sentry.captureException` con `extra: { amount: ... }`.
- **Pre-merge**: code review checklist en PR template (`docs/runbooks/external-setup.md` lo lista).
- **Sampling de logs**: monthly, founder hace query Axiom sample de 100 events random y verifica cero PII raw escapó.
- **Incident-driven**: si encontramos un leak post-hoc, agregamos la key al scrubber + test de regresión.
