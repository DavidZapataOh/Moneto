# Rain Cards — outreach template

> Rain es nuestro **card issuer** — sin Rain (o Reap como fallback), no
> hay tarjeta Visa virtual, que es uno de los 3 hero use-cases del MVP.
>
> Idioma: inglés (US-based team).
> Contacto: `sandbox@raincards.xyz` + Twitter DM `@raincards`.
> Deadline respuesta: **2026-04-14**.

---

## Subject

```
Sandbox request — Moneto neobank on Solana, Visa card integration
```

---

## Body

```
Hi Rain team,

I'm {{FOUNDER_NAME}}, founder of **Moneto** — a privacy-first neobank
for LATAM remote workers built on Solana. We're competing in the
**Solana Frontier Hackathon 2026** and Rain is our card issuer partner
of choice.

**What we're building:**
- Mobile app where users hold multi-asset balances (USD stables, SOL, BTC)
  shielded via Umbra + Token-2022 Confidential Balances.
- Visa card that auto-routes from any asset (priority editable: USD-first,
  fallback to local stable like COP/MXN).
- Backend uses Privy embedded wallets (custodial UX, MPC-secured).
- Privacy-first compartmentalization: Privy holds wallet, Supabase holds
  identity, neither has the join key visible to the other.

**What we need:**
1. Sandbox access to Rain card issuance API.
2. Documentation for authorization webhooks — we need to validate auth
   requests in real-time (sub-second) and decrement shielded balance.
3. Pricing/fee structure for cards in CO/MX/BR/AR.
4. Compliance requirements for our KYC level → card limits mapping.

**Why Rain:**
- Solana-native, fastest path to functional Visa cards on chain.
- Already used by serious projects (we follow your case studies).
- API-first, fits our edge backend (Cloudflare Workers + Hono).
- Your auth-time settlement model aligns with our shielded-balance flow.

**Tech stack:**
- Mobile: Expo SDK 54 + React Native 0.81 + Privy embedded wallets
- Backend: Hono on Cloudflare Workers + Supabase
- On-chain: Anchor programs + Token-2022 + Umbra SDK
- Observability: Sentry + Axiom (privacy-scrubbed pipeline)

We have 6 detailed technical docs (architecture, compliance stance,
threat model, observability conventions, security baseline). Can we get
on a 30min call this week? Happy to share `moneto-auth-architecture.md`
in advance.

Best,
{{FOUNDER_NAME}}
{{FOUNDER_TITLE}} · Moneto
{{FOUNDER_EMAIL}} · {{FOUNDER_LINKEDIN}} · {{FOUNDER_TWITTER}}
{{LANDING_URL}}
```

---

## Adjuntos sugeridos

- Pitch deck PDF (English version).
- Link a `moneto-auth-architecture.md` (Notion público) cuando lo pidan.

---

## Canales paralelos

Si email no responde en 3 días:

1. **Twitter DM `@raincards`** — soft reminder con thread del email subject.
2. **LinkedIn al CTO / VP Engineering** de Rain.
3. **Solana Discord** — buscar miembros del team de Rain en canales públicos.

---

## Negociación notes

- **Card BIN**: ¿qué BIN usan? Affecta acceptance internacional.
- **Auth latency p99**: Moneto promete <1s para card auth. Confirmar Rain
  cumple este SLA.
- **Settlement model**: real-time vs batched? Para shielded balance
  decrement, real-time es ideal.
- **3DS support**: para tx >USD 50, queremos 3DS step-up (matches Privy
  biometric requirement).
- **Currency conversion**: cuando user gasta en MXN con balance USD, ¿quién
  hace el FX? Rain o nuestro side via Jupiter?
- **Pricing**: fee per tx + monthly active card fee + interchange share?

---

## Fallback si Rain no responde / dice no

Activar plan B según `docs/partnerships/alternatives-matrix.md`:

1. **Reap Card** — HK-based, API global, similar feature set.
2. **Baanx** — powers MetaMask Card. Más maduro pero menos Solana-native.

---

## CRM update

Después de enviar, actualizar `docs/partnerships/crm-tracker.md`:

```
| Rain Cards | contacted | founder | YYYY-MM-DD | YYYY-MM-DD | Follow-up D+3 | Sandbox URL TBD |
```
