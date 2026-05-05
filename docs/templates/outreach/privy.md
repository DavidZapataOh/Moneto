# Privy — outreach template

> Privy es nuestro **embedded wallet + auth provider**. Decisión
> arquitectural en `moneto-auth-architecture.md` v0.3 — Privy + Supabase
> compartmentalization es el corazón de la privacy thesis.
>
> Idioma: inglés (US-based, post-Stripe acquisition).
> Contacto: `sales@privy.io` + Discord.
> Deadline respuesta: **2026-04-12**.

---

## Subject

```
Privy embedded wallets for Moneto — Solana neobank LATAM, hackathon 2026
```

---

## Body

```
Hi Privy team,

I'm {{FOUNDER_NAME}}, founder of Moneto — a privacy-first neobank for
LATAM remote workers on Solana. We're targeting Privy as our auth +
embedded wallet provider for the Solana Frontier Hackathon 2026.

**Why Privy (not Turnkey, Dynamic, Magic):**
- Best DX for embedded Solana wallets in Expo we've evaluated.
- OAuth-first matches our consumer-grade UX (Apple/Google passkey-ready).
- MPC + TEE custody model aligns with our self-custodial positioning —
  user owns the wallet, Privy shards reduce single point of failure.
- Stripe acquisition signals enterprise-grade longevity (matters for a
  banking product).

**What we need:**
1. **Sandbox app** for hackathon dev (mainnet-ready post-submission).
2. **Custom JWT integration** docs — we mint a Privy JWT, then exchange
   it for a Supabase session via `customJWT` flow. The Supabase project
   only knows the Privy DID (no wallet address).
3. **Office hours / Discord access** for SDK questions (specifically:
   `@privy-io/expo` integration with our Hono backend on Cloudflare
   Workers using `@privy-io/server-auth`).
4. **Pricing tier confirmation** post-hackathon for the production app.

**Architecture (compartmentalization):**
- **Mobile**: `@privy-io/expo` — embedded wallet + biometric MFA via
  expo-local-authentication.
- **Backend** (Cloudflare Workers + Hono): Privy server SDK validates
  JWTs on every authenticated request.
- **Identity layer** (Supabase): stores ONLY Privy DID + KYC level + user
  preferences. No wallet address, no transaction history.
- **On-chain**: Token-2022 Confidential Balances + Umbra for shielded
  amounts and stealth addresses.

This compartmentalization is **the** thesis of our product — Privy is
the hinge that makes it work without UX compromise.

Happy to share `moneto-auth-architecture.md` (60+ pages) with detailed
Privy integration plan, including:
- Session refresh policy.
- JWT verification key rotation handling.
- MPC-key recovery flow with social guardians (Sprint 5).
- Threat model for compromised Privy session vs compromised mobile device.

Best,
{{FOUNDER_NAME}}
{{FOUNDER_TITLE}} · Moneto
{{FOUNDER_EMAIL}} · {{FOUNDER_LINKEDIN}} · {{FOUNDER_TWITTER}}
{{LANDING_URL}}
```

---

## Discord intro (paralelo al email)

Joinear Privy Discord (`https://discord.gg/privy`), presentarse en `#general`:

```
Hey Privy community! 👋

Founder here — building Moneto, a privacy-first neobank for LATAM on
Solana for the Frontier Hackathon 2026. Privy is our chosen embedded
wallet + auth provider (sandbox account incoming).

Quick question: anyone have experience with `@privy-io/expo` + custom
JWT exchange to Supabase? Looking for the cleanest pattern for sessions
that don't leak wallet address to our identity DB.

Sent a sales email yesterday — posting here in case faster on Discord.
Happy to share architecture docs in DM.

— {{FOUNDER_NAME}} ({{FOUNDER_TWITTER}})
```

---

## Office hours protocol

Privy ofrece office hours regulares. Cuando confirmen call:

- **Preparar specific questions** — no "general intro". Founders que
  preparan reciben más value.
- Ejemplos:
  - JWT expiration handling cuando el Worker isolate dura >access token TTL.
  - Multi-app same DID (mobile + web) — un solo Privy session?
  - Recovery: si user pierde mobile + Privy MPC, ¿qué fallback nos da?
  - Cómo se behaves Privy si Supabase está down y necesitamos validar
    JWT en otro service?
  - Latency p95 esperada del verification endpoint (afecta CSP api budget).

---

## Stripe acquisition advantage

Privy fue adquirida por Stripe (2024). Para Moneto esto significa:

- Path eventual a integration directa con Stripe payments si expandimos
  beyond LATAM.
- Stability garantizada (no shutdown risk típico de startups crypto).
- Compliance posture mejorada (Stripe compliance team detrás).

Mencionar este alignment en el call — muestra que entendemos su contexto.

---

## Fallback si Privy no responde / dice no

Activar plan B según `docs/partnerships/alternatives-matrix.md`:

1. **Turnkey** — más enterprise, mismo MPC model, más dev work pero
   feasible.
2. **Dynamic** — similar features, menos Solana-mature, fallback secundario.

---

## CRM update

Después de enviar:

```
| Privy | contacted | founder | YYYY-MM-DD | YYYY-MM-DD | Office hours scheduling | Privy DID + JWT in vault TBD |
```
