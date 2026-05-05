# Umbra Privacy — outreach template

> Umbra es nuestra **core privacy layer** — toda la thesis de "neobanco
> privado" depende de la integración profunda de Umbra SDK + Token-2022
> Confidential Balances. **Bounty target**: Privacy + Confidential Compute.
>
> Idioma: español/inglés (team mixed).
> Contacto: Discord directo (Telegram `@umbra-team` como backup).
> Deadline respuesta: **2026-04-09** (workshop hackathon es key).

---

## Discord intro DM

```
Hola @Umbra team! 👋

Soy {{FOUNDER_NAME}}, founder de **Moneto** — un neobanco privacy-first
para LATAM en Solana, participando en el Frontier Hackathon 2026.

Vamos a hacer **integración profunda** de Umbra SDK como nuestra core
privacy layer (no es un skin — es la base arquitectural). Concretamente:

1. Stealth addresses para receiving payroll de empleadores extranjeros
   (cero correlation on-chain entre el pago y el user identity).
2. Combo con Token-2022 Confidential Balances para hide montos en cards y
   yield positions.
3. Viewing keys + scan keys gestionados via expo-secure-store en mobile.

3 cosas que necesito de la comunidad:

1. ¿Acceso a Discord channel de devs / DM con quien lleve SDK support?
2. ¿Hay grupo dedicado para hackathon participantes?
3. ¿Confirmar attendance al Umbra workshop (fecha TBC) para Q&A en vivo?
   {{FOUNDER_NAME}} confirma attendance — preferible si saben fecha
   exacta para bloquear agenda.

Compartiendo nuestro doc técnico de privacy stack para feedback:
{{ANCHOR_DOC_URL}} (sección "Compartmentalization architecture").

Apuntamos al **1er lugar del bounty Privacy + Confidential Compute**.
Hagamos que esto vuele 🚀

Saludos,
{{FOUNDER_NAME}}
{{FOUNDER_TWITTER}}
moneto.xyz
```

---

## Email backup (si Discord no responde en 48h)

**Subject:**

```
Moneto + Umbra — Solana Frontier Hackathon, deep integration plan
```

**Body:**

```
Hi Umbra team,

I'm {{FOUNDER_NAME}}, founder of Moneto — a privacy-first neobank for
LATAM on Solana competing in the Frontier Hackathon 2026. We're targeting
the **Privacy + Confidential Compute bounty** with a deep Umbra SDK
integration.

Architecture highlights:
- Stealth addresses for incoming payroll (employer → user, no on-chain link).
- Token-2022 Confidential Balances for shielded amounts in card spend +
  yield positions.
- Mobile (Expo) integration via Privy embedded wallets — Umbra keys derived
  from Privy MPC-protected seed.
- Server-side (Cloudflare Workers) handles only metadata; never sees
  viewing keys or transaction details.

We're not casual users — Umbra is in the architecture from day 1, not
bolted on. Sharing our `moneto-analysis.md` doc which has 12 pages on
the privacy stack design ({{ANCHOR_DOC_URL}}).

Asks:
1. SDK developer support contact (Discord DM is fine).
2. Pre-mainnet visibility into upcoming Umbra changes that affect our
   Token-2022 integration plan.
3. Workshop date confirmed so we can attend live for Q&A.

We deliver demo + on-chain mainnet deployment by 2026-05-11 (hackathon
end). Happy to share more docs (auth architecture, threat model,
compliance stance) on request.

Best,
{{FOUNDER_NAME}}
{{FOUNDER_TITLE}} · Moneto
{{FOUNDER_EMAIL}}
```

---

## Workshop attendance protocol

Cuando confirmen workshop date:

1. Bloquear agenda full (founder + senior eng).
2. Preparar 3 preguntas técnicas específicas para Q&A — que demuestren que
   leímos los docs SDK + entendemos las edge cases.
3. Demo en vivo de nuestro stack (5 min) si hay slot abierto post-Q&A.
4. Networking post-workshop con team Umbra + otros hackathon participants.

Preguntas candidatas para el workshop:

- ¿Cómo manejan key rotation cuando un user rota su Privy MPC seed?
- ¿Pattern recomendado para batch scan de viewing keys cuando tenemos N
  scopes activos por user (e.g., 1 scope per employer)?
- ¿Cuál es el tradeoff de latency entre stealth address derivation
  on-device vs server-side proxy?

---

## Bounty alignment

**Solana Frontier 2026 — Privacy + Confidential Compute** track:

- Premio principal: TBD por Colosseum.
- Criterios típicos: technical depth, mainnet deployment, novel use case,
  developer experience.
- Moneto target: full integration en Sprint 5 (privacy primitives) +
  Sprint 7 (confidential card auth) + demo en submission.

---

## Fallback

No hay fallback técnico para Umbra — es nuestra thesis. Si Umbra no
provee soporte, igual integramos via SDK público. Pero el premio del
bounty se complica sin acceso a su team para validación técnica.

---

## CRM update

Después del Discord DM, actualizar `docs/partnerships/crm-tracker.md`:

```
| Umbra Privacy | contacted | founder | YYYY-MM-DD | YYYY-MM-DD | Workshop attendance + SDK support contact | Discord channel TBD |
```
