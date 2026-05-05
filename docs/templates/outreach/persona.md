# Persona — outreach template

> Persona es nuestro **KYC provider**. Critical para Sprint 4 (KYC L1+L2)
> y compliance posture LATAM. Decisión documentada en `moneto-compliance-stance.md`.
>
> Idioma: inglés (US-based).
> Contacto: `sales@withpersona.com`.
> Deadline respuesta: **2026-04-14**.

---

## Subject

```
KYC partnership inquiry — Moneto, LATAM neobank on Solana, hackathon 2026
```

---

## Body

```
Hi Persona team,

I'm {{FOUNDER_NAME}}, founder of Moneto — a privacy-first neobank for
LATAM remote workers built on Solana. We're competing in the Solana
Frontier Hackathon 2026 and are evaluating Persona for our KYC provider.

**Why Persona:**
- Best DX for embedded KYC flows in mobile (we tested Sumsub, Onfido,
  and Persona side-by-side).
- LATAM document coverage is strong (CO cédula, MX INE, AR DNI, BR RG/CPF).
- Compliance dashboard we can hand to a regulator without translation.
- Webhook-first integration fits our edge backend (Cloudflare Workers).

**KYC tier model we're implementing (4 levels per `moneto-compliance-stance.md`):**

- **L0** — pseudónimo, hasta USD 200 lifetime. Just Privy auth, no docs.
- **L1** — selfie + document, hasta USD 2K/mo. **Persona Government ID +
  Selfie verification.**
- **L2** — proof of address + source of funds, hasta USD 10K/mo.
  **Persona Database + Document verification + custom flow.**
- **L3** — bank account verification, sin límite. Manual review + bank
  micro-deposit (sprint 7+).

**Asks:**
1. **Sandbox access** for hackathon dev (CO/MX/AR/BR document support
   verified pre-mainnet).
2. **Pricing tier** confirmation — flat fee per verification or volume-based?
3. **Webhook signing key** + retry policy docs.
4. **Data retention policy** — for compliance, we need explicit retention
   periods per document type.
5. **Sub-processor list** + DPA for our compliance review (per
   `docs/security/vendor-checklist.md`).
6. **Demo call** to walk through the LATAM-specific flows (some doc types
   need pre-config).

**Timeline:**
- Sprint 4 (mid-April): integration + sandbox testing.
- Sprint 7 (early May): production-ready with KYC L1 + L2 flows.
- Hackathon submission 2026-05-11.

Happy to share `moneto-compliance-stance.md` (15 pages on our compliance
posture, KYC tiering, sanctions screening via Chainalysis, regulatory
mapping per LATAM jurisdiction) and our full threat model.

Best,
{{FOUNDER_NAME}}
{{FOUNDER_TITLE}} · Moneto
{{FOUNDER_EMAIL}} · {{FOUNDER_LINKEDIN}}
{{LANDING_URL}}
```

---

## Sales call preparation

Cuando confirmen call, tener listo:

- **Volume estimate**: ~500 KYC verifications en hackathon period
  (mostly L0→L1 conversions during demo). Production target Sprint 8+:
  10K/mo en CO+MX, 1K/mo en AR+BR.
- **Country breakdown**: 60% CO, 25% MX, 10% AR, 5% BR (initial).
- **Document types preferidos**: cédula CO, INE MX, DNI AR, RG/CPF BR.
- **Custom branding**: Persona soporta white-label de la UI — confirmar
  setup time + cost.
- **PEP/sanctions integration**: Persona tiene su own watchlist o lo
  integramos separado con Chainalysis/Refinitiv?

---

## Compliance dovetail

Persona output debe ser aceptable input para nuestros 2 partners
downstream:

1. **Bold Colombia** — exige KYC verificado lado nuestro antes de aceptar
   off-ramp request. Confirmar formato (PDF report? JSON payload? API
   callback?) que Bold acepta.
2. **Rain Cards** — exige KYC para card issuance. Misma confirmación.

Si Persona no exporta a un formato que ambos acepten, evaluar Sumsub.

---

## Pricing target

Para Moneto en hackathon stage:

- **Sandbox**: free (industry standard).
- **Production launch**: budget USD 1.50 - 3.00 per L1 verification, ramp
  down con volume. L2 budget USD 5-8.
- **Total Sprint 0-7 budget**: ~USD 200 (sandbox + handful of real verifications).

Si Persona pide >USD 5/L1 sin volume tier, alt evaluation:

---

## Fallback si Persona no responde / dice no

Activar plan B según `docs/partnerships/alternatives-matrix.md`:

1. **Sumsub** — más LATAM coverage histórica, comparable pricing.
2. **Onfido** — caro pero robust, último resort.

---

## CRM update

Después de enviar:

```
| Persona KYC | contacted | founder | YYYY-MM-DD | YYYY-MM-DD | Sandbox + LATAM doc support call | Sandbox URL TBD |
```
