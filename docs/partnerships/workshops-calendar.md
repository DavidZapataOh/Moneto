# Hackathon workshops calendar

> Eventos del **Solana Frontier Hackathon 2026** (organizado por
> Colosseum, **April 6 – May 11, 2026**). Founder + senior eng atienden
> los críticos en vivo. Workshops grabados → review en H+24.
>
> **Última revisión**: 2026-05-04 (Sprint 0.07).
> Workshops con date "TBD" se confirman cuando Colosseum publique el
> calendario oficial — actualizar este file inmediatamente.

---

## Hackathon timeline (oficial)

| Hito                            | Fecha                    | Acción Moneto                             |
| ------------------------------- | ------------------------ | ----------------------------------------- |
| **Hackathon kick-off**          | 2026-04-06               | Founder en kick-off live + Discord intro. |
| **Application deadline**        | 2026-04-06               | Confirmed registered.                     |
| **Submission deadline**         | 2026-05-11               | Demo + deck + mainnet deploy live.        |
| **Judging period**              | 2026-05-11 → ~2026-05-25 | Office hours abiertas para jueces.        |
| **Winners announce**            | ~2026-05-25              | TBD por Colosseum.                        |
| **Colosseum accelerator start** | ~Junio 2026              | Si grand champion, start onboarding.      |

---

## Workshops críticos (fechas TBD por Colosseum)

### Privacy + Confidential Compute (Umbra, Token-2022)

- **Cuándo**: TBD — esperado primera semana hackathon (~April 8-12).
- **Por qué crítico**: bounty target principal. Umbra team Q&A en vivo.
- **Quién atiende**: founder + senior eng.
- **Preparación**:
  - Leer Umbra SDK docs end-to-end.
  - Leer spec Token-2022 Confidential Balances completa.
  - Preparar 3 preguntas técnicas específicas de nuestra integración
    (ver `templates/outreach/umbra.md` para ejemplos).
- **Action items pre-workshop**:
  - [ ] Architecture sketch Privacy stack listo.
  - [ ] Lista de questions priorizada.
  - [ ] Demo preliminar (incluso si parcial) listo si hay slot Q&A.

### Privy embedded wallets

- **Cuándo**: TBD.
- **Por qué**: confirma DX choices, identifica gotchas tempranas.
- **Quién**: senior eng (founder opcional).
- **Preparación**:
  - Leer `@privy-io/expo` docs + Cloudflare Workers integration patterns.
  - Lista de preguntas (ver `templates/outreach/privy.md` "Office hours
    protocol").

### Helius RPC + Geyser

- **Cuándo**: TBD.
- **Por qué**: scaling pattern para getProgramAccounts + webhooks.
- **Quién**: senior eng.

### Solana program development (Anchor 0.30+)

- **Cuándo**: TBD — generalmente early week 1.
- **Por qué**: confirmar Anchor patterns para nuestros programs (Sprint 5
  recovery, Sprint 7 yield router).
- **Quién**: senior eng / Solana eng.

### Compliance + KYC en Solana apps

- **Cuándo**: TBD.
- **Por qué**: validar nuestra `moneto-compliance-stance.md` posture.
- **Quién**: founder.

---

## Mentor office hours

Colosseum suele ofrecer mentor office hours con:

- **Solana Foundation devrels** — tech architecture review.
- **Anza engineers** — protocol deep-dives.
- **Investors** (si aplica via Copilot program) — pitch refinement.

**Action items**:

- [ ] Aplicar a Colosseum Copilot tan pronto se abra (form aparece en
      Colosseum dashboard post-registration).
- [ ] Schedule mentor office hours en weeks 2 + 4 (mid-hackathon
      feedback loops).
- [ ] Preparar deck + arquitectura review para cada session.

---

## Side events / community

| Evento                                        | Date           | Owner      | Action                                          |
| --------------------------------------------- | -------------- | ---------- | ----------------------------------------------- |
| **Superteam Colombia weekly**                 | TBD recurrente | founder    | Atender a 2 reuniones, presentar Moneto formal. |
| **Solana Foundation LATAM AMA**               | TBD            | founder    | Atender, hacer pregunta visible.                |
| **Privy hackathon office hours** (si ofrecen) | TBD            | senior eng | Schedule call.                                  |
| **Helius hackathon Discord live**             | TBD            | senior eng | Active participation.                           |

---

## Workshop attendance protocol

Para CADA workshop atendido en vivo:

### Pre-workshop (T-24h)

1. Read materials del workshop (slides, docs si publicaron).
2. Bloquear agenda completo: founder + relevant eng.
3. Preparar **3 preguntas calificadas** (no genéricas).
4. Tener proyecto demo listo en caso de Q&A interactivo.

### Durante el workshop

1. **Camera on, mic muted hasta Q&A**.
2. Discord/chat active — comment thoughtful, no spam.
3. **Notes en doc compartido** (`docs/partnerships/workshop-notes/<slug>.md`
   — crear este file por workshop atendido).
4. Q&A: asks one of the prepared questions. Mention Moneto context if
   relevant pero NO pitch.

### Post-workshop (T+2h)

1. Summary de lo aprendido en workshop notes file.
2. Action items: qué cambia en nuestra arquitectura/code post-workshop?
3. **DM al speaker** thank-you genuino (no pitch). Open relationship for
   follow-up.
4. Tweet con 1 insight clave del workshop, tag @speaker + @ColosseumOrg.

---

## Workshop notes structure

`docs/partnerships/workshop-notes/<YYYY-MM-DD>-<slug>.md`:

```markdown
# Workshop notes — <title>

**Date**: 2026-04-DD
**Speaker(s)**: <names>
**Track**: <bounty track if relevant>
**Attended by**: <founder/eng>

## TL;DR

<1-2 sentences>

## Key insights

- <bullets>

## Questions asked + answers

- Q: <our question>
  - A: <speaker response>

## Action items for Moneto

- [ ] <thing> — by <date>

## Resources shared

- <links>
```

---

## Recordings index

Cuando Colosseum publica recordings:

| Workshop | Recording URL | Reviewed by | Notes link |
| -------- | ------------- | ----------- | ---------- |
| TBD      | TBD           | TBD         | TBD        |

---

## Update cadence

Este file se updatea:

- **Cuando Colosseum publica calendario oficial** → fill all "TBD" dates.
- **Cuando atendemos un workshop** → mark attended, link notes.
- **Post-hackathon** → archive recordings list, lessons learned summary.
