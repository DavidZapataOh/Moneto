# Helius — outreach template

> Helius es nuestro **Solana RPC + indexing provider**. Helius ofrece
> automatic hackathon discount via formulario — no requiere outreach
> personalizado, pero documento el flow para record.
>
> Idioma: inglés.
> Contacto: form en https://helius.dev/hackathon (o equivalente Frontier 2026).
> Deadline: **2026-04-09** (lo más temprano posible — sin Helius el
> backend no puede hablar con Solana).

---

## Step 1 — Apply hackathon discount

Helius típicamente ofrece para hackathons:

- Free dev tier upgrade (mainnet RPC + Webhooks).
- Discount o credits para production tier post-hackathon.
- Discord channel dedicado para participants.

**Acción founder**:

1. Visitar https://helius.dev (homepage banner suele tener el form en
   hackathon season).
2. Search "Frontier hackathon" en su Discord o blog.
3. Si no hay form visible: email `support@helius.dev` con el template abajo.

---

## Backup email (si no hay form público)

**Subject:**

```
Hackathon credits request — Moneto, Solana Frontier 2026
```

**Body:**

```
Hi Helius team,

I'm {{FOUNDER_NAME}}, founder of Moneto — a Solana neobank competing in
the Frontier Hackathon 2026 (organized by Colosseum). We're using Helius
as our Solana RPC + indexing layer.

Quick request: can we get the standard hackathon participant credits /
discount for the duration of the hackathon (April 6 – May 11, 2026)?

**Usage estimate:**
- Devnet: heavy — testing Token-2022 confidential balances, Umbra stealth
  addresses, multisig setups for guardian recovery.
- Mainnet (post-MVP demo): moderate — limited to demo wallet during
  judging period.

**What we use:**
- Standard JSON-RPC for transaction sends + account state.
- Webhooks for monitoring deposits to user shielded addresses.
- Possibly Helius RPC + Geyser stream (Sprint 5+) if performance demands.

**Project:**
- Privacy-first neobank for LATAM remote workers.
- Stack: Expo + Hono on Cloudflare Workers + Anchor + Privy + Umbra +
  Token-2022 Confidential Balances.
- 6 detailed technical docs available on request.

Happy to credit Helius in our hackathon submission + future docs.

Best,
{{FOUNDER_NAME}}
{{FOUNDER_TITLE}} · Moneto
{{FOUNDER_EMAIL}}
{{LANDING_URL}}
```

---

## Step 2 — Discord intro

Joinear https://discord.gg/helius (link puede haber cambiado, buscar
desde su homepage).

Presentarse en `#general` o `#hackathon`:

```
Hey Helius community 👋

Founder here — building **Moneto**, a privacy-first neobank for LATAM
remote workers on Solana for the Frontier Hackathon 2026. Just applied
for hackathon credits + jumping in here to be active.

Stack uses Helius RPC heavily (Token-2022 Confidential Balances + Umbra
stealth address scanning). Anyone with experience scanning a high
viewing-key count efficiently? Looking for the cleanest pattern with
Helius getProgramAccounts + filters.

— {{FOUNDER_NAME}} ({{FOUNDER_TWITTER}})
```

---

## Technical questions to ask Helius support

Una vez tengamos canal:

- **Compressed NFTs / state compression** support — relevant si introducimos
  account abstraction patterns para guardians (Sprint 5+).
- **Webhook signature validation** — pattern recomendado para nuestro
  Cloudflare Workers handler (Hono).
- **Geyser stream pricing** — para Sprint 5+ cuando necesitamos near-RT
  notifications de incoming deposits.
- **Rate limits**: cuál es el tier free hackathon vs production? Affecta
  nuestra arquitectura de batch scanning.
- **Devnet vs mainnet differences** en Token-2022 Confidential Balances
  endpoint support.

---

## Pricing contingency

Si Helius hackathon discount no cubre nuestras necesidades de devnet
heavy testing:

1. Usar **devnet free public RPC** para tests no críticos.
2. Reservar Helius keys para tests E2E que requieren features paid
   (webhooks, getProgramAccounts con filtros complejos).
3. Fallback total: **Triton One** (bare-metal, devnet free; ver
   `alternatives-matrix.md`).

---

## Fallback

| Si Helius dice no / falla | Alternativa                          | Trade-off                           |
| ------------------------- | ------------------------------------ | ----------------------------------- |
| Hackathon period          | RPC Fast (también hackathon sponsor) | Diferente API surface               |
| Mainnet production        | Triton One                           | Más bare-metal, más setup           |
| Backup secondary          | Public devnet RPC                    | Sin webhooks, rate limits agresivos |

---

## CRM update

Después de form/email:

```
| Helius | contacted | founder | YYYY-MM-DD | YYYY-MM-DD | Confirm hackathon credits + Discord channel | API key in vault TBD |
```
