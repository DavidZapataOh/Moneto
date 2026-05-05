# KYC flow — Persona integration

> Source of truth para el flujo end-to-end de KYC. Sprint 1.04 implementa
> niveles 0/1/2 con Persona sandbox; nivel 3 (manual review) se activa
> Sprint 6 cuando los rails reales lo necesiten.
>
> Ver también `moneto-compliance-stance.md` §3.1 para el rationale del tier model.

---

## Tier model

| Nivel | Requisitos                                           | Cap mensual operativo USD               | Time to verify |
| ----- | ---------------------------------------------------- | --------------------------------------- | -------------- |
| **0** | Email + phone verified (Privy default post-signup)   | **$200 lifetime**                       | Inmediato      |
| **1** | + documento nacional + selfie (liveness pasivo)      | **$2.000 / mes**                        | 1–5 min auto   |
| **2** | + comprobante domicilio (≤3 meses) + liveness activo | **$10.000 / mes**                       | 5–15 min       |
| **3** | + source of funds + income verification              | **Sin límite** (manual review en >$50K) | 24–72 h manual |

Caps definidos en `packages/config/src/constants.ts > KYC_LIMITS_USD`. Server-side enforcement en `apps/api/src/services/compliance.ts > exceedsCap()`.

---

## State machine

```
   ┌──────┐
   │ none │  (post-signup, sin Persona inquiry todavía)
   └───┬──┘
       │ user verifies email + phone (Privy default)
       ▼
   ┌─────────┐
   │ level 0 │  ($200 lifetime cap)
   └────┬────┘
        │ user starts KYC inquiry → Persona hosted webview
        ▼
   ┌──────────────┐
   │ pending L1+  │  (mobile setea optimistic; webhook flippea final)
   └──────┬───────┘
          │ Persona webhook → kyc-webhook edge fn
          ▼
     ┌────────┐ ┌──────────┐ ┌─────────────┐
     │approved│ │declined │ │needs-review │
     │  → L1+ │ │  → kept │ │ → pending   │
     └────────┘ └──────────┘ └─────────────┘
```

State persistido en:

- `profiles.kyc_level` (`int 0..3`)
- `profiles.kyc_status` (`none | pending | approved | rejected`)
- `kyc_audit_log` (append-only audit trail, retención 7 años)

---

## Architecture flow

```
┌──────────────────────────────────────────────────┐
│              MOBILE — kyc.tsx                     │
│   - intro screen (qué necesitamos)                │
│   - WebView con Persona hosted inquiry            │
│   - capta postMessage events del WebView          │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────┐
        │   Persona Hosted Inquiry    │
        │   - foto documento          │
        │   - selfie liveness         │
        │   - (L2) factura domicilio  │
        └─────────────┬───────────────┘
                      │ user completes
              ┌───────┴─────────┐
              │                 │
              ▼                 ▼
   ┌─────────────────┐  ┌──────────────────┐
   │ Persona webhook │  │ Mobile recibe    │
   │ → edge fn:      │  │ "complete" msg   │
   │   kyc-webhook   │  │ → setea pending  │
   └────────┬────────┘  └──────────────────┘
            │ verify HMAC + idempotent insert
            ▼
   ┌─────────────────────────┐
   │  Supabase:              │
   │  - kyc_audit_log INSERT │
   │  - profiles UPDATE      │
   │    (kyc_level, status)  │
   └────────┬────────────────┘
            │ Sprint 5+: realtime to mobile
            ▼
   ┌─────────────────────────┐
   │  Compliance hooks:      │
   │  - unlockUserOperations │
   │  - alertOfficer (decl.) │
   └─────────────────────────┘
```

---

## Mobile — `kyc.tsx`

### Trigger desde otras screens

`useRequireKYC(minLevel)` hook gating:

```ts
function SendScreen() {
  const kyc = useRequireKYC(1);

  const handleSend = () => {
    if (amountUsd > 200 && !kyc.isAllowed) {
      kyc.requireUpgrade(); // navega a /kyc?target_level=1
      return;
    }
    // proceed con send...
  };
}
```

### WebView vs SDK nativo

**Sprint 1.04 usa WebView** (`react-native-webview`) con la URL hosted de Persona. Razones:

- Cero native modules extras (no requiere EAS rebuild). Funciona en Expo Go.
- Mismo flujo visual que el SDK nativo (Persona renderiza igual en webview).
- WebView captura events vía `window.postMessage` que Persona dispara (`complete`, `cancel`, `error`).

Sprint 8 polish: migrar a `react-native-persona` para mejor UX en captura de cámara (rendering native vs webview). El edge fn webhook no cambia.

### Phases

`Phase = "intro" | "loading" | "in_progress" | "completed" | "cancelled" | "failed"`. UI cambia por phase, copy adaptado por `target_level` (1 vs 2).

### Optimistic state update

Cuando WebView reporta `complete`, mobile setea `profile.kycStatus = "pending"` localmente. El webhook server-side flippea a `approved`/`rejected` y eventualmente:

- Sprint 1.05: mobile re-fetch profile en background (próxima session).
- Sprint 5: Supabase realtime push del cambio inmediato.

Hasta entonces, el user puede ver "verificación enviada" pero el cap no se actualiza hasta el próximo cold start. Acceptable trade-off para MVP.

---

## Edge function — `kyc-webhook`

### Signature verification

Persona firma webhooks con HMAC-SHA256. Header format:

```
Persona-Signature: t=1735689600,v1=abcdef...
```

Verificación:

1. Parse `t=<ts>` + `v1=<sig>` (puede haber múltiples v1 si Persona rotó key).
2. Replay protection: rechaza eventos con `|now - ts| > 300s`.
3. Compute HMAC-SHA256 sobre `<ts>.<body>` con `PERSONA_WEBHOOK_SECRET`.
4. Constant-time compare via `crypto.subtle.verify`.

Cualquier fallo → 401 con `{ reason: "no_signature" | "malformed_signature" | "timestamp_out_of_range" | "signature_mismatch" }`. Persona reintenta con backoff.

### Idempotency

`kyc_audit_log.persona_event_id` tiene `UNIQUE` constraint. Webhook duplicado → INSERT falla con código `23505` → respondemos `200 OK { idempotent: true }` para que Persona no reintente forever. Cero side effects extras.

### Event types procesados

| Persona event          | Acción                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `inquiry.completed`    | Update profile (level + status) + audit log row            |
| `inquiry.failed`       | Audit log + status `rejected`                              |
| `inquiry.expired`      | Audit log + status `rejected` (user no completó en N días) |
| `report.run-completed` | AML / sanctions screening result (Sprint 7 lo usa)         |
| Otros                  | 200 OK + ignored: true                                     |

### Mapping Persona status → Moneto status

```
approved | completed → "approved"
declined | failed | expired → "rejected"
otros → "pending"
```

### Determine new level

Por convención de naming en Persona dashboard:

- Template ID que contiene `kyc_l1` o termina en `_l1` → level 1.
- `kyc_l2` / `_l2` → level 2.
- `kyc_l3` / `_l3` → level 3.

Si el inquiry es `approved` → upgrade al level del template. Si es `declined` o `pending` → mantiene `prev_level`.

### Compliance triggers (Sprint 6+)

Cuando level cambia (post-update profile), llamar:

- `unlockUserOperations(userId, newLevel)` — habilita cashouts según cap.
- `alertComplianceOfficer(userId, "kyc_declined", ...)` si decline.

Sprint 1.04: stubs en `apps/api/src/services/compliance.ts` con `log.info`. Implementación real Sprint 6 (Bold rails) + Sprint 7 (sanctions).

---

## Sandbox testing (founder)

### Persona setup

1. **Sign up** en https://withpersona.com → sandbox environment auto-creado.
2. **Create inquiry templates**:
   - **Level 1**: "Government ID + Selfie". Slug: `kyc_l1_default`.
   - **Level 2**: + "Database Verification" + "Address Proof". Slug: `kyc_l2_default`.
3. **Configure webhook**:
   - URL: `https://<DEV_REF>.supabase.co/functions/v1/kyc-webhook`.
   - Secret: copiar el "Webhook Secret" que Persona genera.
4. **Setear secrets**:
   ```bash
   cd packages/db
   supabase secrets set PERSONA_WEBHOOK_SECRET=<from persona dashboard>
   pnpm fn:deploy kyc-webhook
   ```
5. **Pegar template IDs** en `apps/mobile/.env.local`:
   ```
   EXPO_PUBLIC_PERSONA_TEMPLATE_L1=itmpl_xxx_l1
   EXPO_PUBLIC_PERSONA_TEMPLATE_L2=itmpl_xxx_l2
   ```

### Smoke test cases

- [ ] User abre `/kyc` (target_level=1) → ve intro → tap "Comenzar".
- [ ] WebView carga Persona inquiry → user toma foto del ID + selfie.
- [ ] Persona test data: válido → webhook llega → `kyc_audit_log` row + `profiles.kyc_level=1`.
- [ ] Persona test data: declined → webhook llega → audit row + status=rejected, level stays.
- [ ] User cancela mid-inquiry → mobile vuelve a intro con copy "cancelaste, reintentá".
- [ ] Webhook duplicado (Persona reintenta) → 200 OK idempotent, sin doble update.
- [ ] Webhook con firma fake → 401 invalid_signature.
- [ ] Webhook con timestamp viejo (>5min) → 401 timestamp_out_of_range.

### Audit log queries útiles

```sql
-- Activity reciente.
select user_id, event_type, prev_level, new_level, prev_status, new_status, created_at
from public.kyc_audit_log
order by created_at desc
limit 20;

-- Funnel approved/rejected en último mes.
select new_status, count(*)
from public.kyc_audit_log
where event_type = 'inquiry.completed' and created_at > now() - interval '30 days'
group by new_status;

-- Idempotency check — debería ser 0 (UNIQUE en persona_event_id).
select persona_event_id, count(*)
from public.kyc_audit_log
group by persona_event_id
having count(*) > 1;
```

---

## Compliance retention

7 años (LATAM regulatorio mínimo) para `kyc_audit_log` y `raw_event` JSON. Configurar en Supabase backups + PITR (production tier).

KYC documents (foto del ID, selfie) **NO se almacenan en Supabase** — viven solo en Persona's encrypted storage. Si Persona deja de operar, hay que rerun KYC manual (acceptable trade-off vs storing PII nosotros).

---

## PostHog events

Los eventos siguen la taxonomy de `packages/observability/src/events.ts`:

| Event           | Trigger                                                 | Props                     |
| --------------- | ------------------------------------------------------- | ------------------------- |
| `kyc_started`   | User tap "Comenzar verificación" en `/kyc`              | `level`                   |
| `kyc_submitted` | WebView recibe `complete` postMessage                   | `level`                   |
| `kyc_completed` | Webhook procesa `inquiry.completed` con status approved | `level, duration_minutes` |
| `kyc_rejected`  | Webhook procesa con status declined                     | `level, reason`           |

Sprint 1.06 (logout cleanup) wirea estos events desde `kyc.tsx` + edge fn (vía PostHog server-side SDK o forwarding desde mobile post-webhook).

---

## Lo que NO cambia automáticamente — el founder ejecuta

1. **Crear cuenta Persona** + sandbox + 2 inquiry templates (L1, L2).
2. **Configurar webhook** en Persona dashboard apuntando al edge fn deployed.
3. **Setear `PERSONA_WEBHOOK_SECRET`** en Supabase secrets.
4. **Deploy `kyc-webhook`** edge fn (`pnpm --filter @moneto/db fn:deploy kyc-webhook`).
5. **Pegar template IDs** en `apps/mobile/.env.local` (público).
6. **Test E2E** con Persona test data desde mobile dev build.

Para production: pricing Persona ~$1.50–3.00 per L1 verification, $5–8 per L2. Ver `docs/templates/outreach/persona.md` para la negociación de pricing.
