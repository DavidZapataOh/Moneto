# Partnerships CRM tracker

> Source of truth para outreach status de cada partner. Founder updatea
> inline cuando hay un cambio de status. Git history = audit trail.
>
> Si preferís Notion: copiar esta tabla allí y mantener sync semanal —
> pero **este file es el canónico** para que el equipo entero vea sin
> permisos extras.

**Última revisión**: 2026-05-04 (Sprint 0.07).

---

## Status enum

| Status              | Definición                                 |
| ------------------- | ------------------------------------------ |
| `not_contacted`     | No hemos enviado el primer mensaje aún     |
| `contacted`         | Mensaje enviado, esperando respuesta (D+0) |
| `bumped`            | Follow-up enviado (D+3)                    |
| `responded`         | Respondieron pero sin commit todavía       |
| `meeting_scheduled` | Call/intro confirmada con fecha            |
| `sandbox_obtained`  | Tenemos sandbox keys funcionando           |
| `signed`            | Acuerdo cerrado para producción (post-MVP) |
| `dead`              | Sin respuesta D+10, fallback activado      |
| `dropped`           | Decidimos no usar (rationale en notes)     |

---

## Críticos para MVP

| Partner           | Status          | Owner   | First contact | Last touch | Next action                                  | Due        | Notes                                           |
| ----------------- | --------------- | ------- | ------------- | ---------- | -------------------------------------------- | ---------- | ----------------------------------------------- |
| **Bold Colombia** | `not_contacted` | founder | —             | —          | Send `templates/outreach/bold.md`            | 2026-04-09 | Critical para off-ramp CO. Fallback: Littio.    |
| **Rain Cards**    | `not_contacted` | founder | —             | —          | Send `templates/outreach/rain.md`            | 2026-04-09 | Critical para Visa card. Fallback: Reap.        |
| **Umbra Privacy** | `not_contacted` | founder | —             | —          | Discord intro `templates/outreach/umbra.md`  | 2026-04-08 | Critical — bounty target. No fallback técnico.  |
| **Privy**         | `not_contacted` | founder | —             | —          | Send `templates/outreach/privy.md` + Discord | 2026-04-09 | Critical para auth. Fallback: Turnkey.          |
| **Persona KYC**   | `not_contacted` | founder | —             | —          | Send `templates/outreach/persona.md`         | 2026-04-10 | Critical para KYC L1+L2. Fallback: Sumsub.      |
| **Helius**        | `not_contacted` | founder | —             | —          | Apply hackathon form + Discord               | 2026-04-08 | Critical para RPC. Fallback: RPC Fast / Triton. |

---

## Estratégicos (post-MVP, contactar en sprints específicos)

| Partner                    | Status          | Owner   | Sprint trigger        | Notes                            |
| -------------------------- | --------------- | ------- | --------------------- | -------------------------------- |
| **Reflect**                | `not_contacted` | founder | Sprint 5 (yield)      | Yield USDC+                      |
| **Huma Finance**           | `not_contacted` | founder | Sprint 5 (yield)      | Yield infra para stables locales |
| **Squads Labs**            | `not_contacted` | founder | Sprint 7 (recovery)   | Multisig para guardian recovery  |
| **Chainalysis**            | `not_contacted` | founder | Sprint 7 (compliance) | Sanctions screening              |
| **Bitso México**           | `not_contacted` | founder | Post-MVP              | Off-ramp expansion MX            |
| **Lemon Argentina**        | `not_contacted` | founder | Post-MVP              | Off-ramp expansion AR            |
| **Mercado Bitcoin Brasil** | `not_contacted` | founder | Post-MVP              | Off-ramp expansion BR            |

---

## Vendors infra (ya wired filesystem-wise, pending account setup)

| Vendor                 | Status                             | Owner   | Notes                                                   |
| ---------------------- | ---------------------------------- | ------- | ------------------------------------------------------- |
| **Cloudflare Workers** | `sandbox_obtained` (free tier dev) | founder | Account TBD para staging/prod, ver `external-setup.md`. |
| **Vercel**             | `not_contacted`                    | founder | Project link pendiente, ver `external-setup.md`.        |
| **Sentry**             | `not_contacted`                    | founder | Crear org `moneto`, 2 projects (mobile + api).          |
| **Axiom**              | `not_contacted`                    | founder | Crear org, 4 datasets (api/mobile/jobs/compliance).     |
| **PostHog**            | `not_contacted`                    | founder | Crear project, configurar session replay sample.        |
| **Resend**             | `not_contacted`                    | founder | Sprint 1 (transactional email).                         |
| **Supabase**           | `not_contacted`                    | founder | 3 projects (dev/staging/prod).                          |
| **Expo / EAS**         | `not_contacted`                    | founder | Org `moneto` + EAS project linked.                      |

---

## Quality gates

Plan 07 dice 4 gates concretos para outreach. Status tracking:

| Gate                                                 | Status                                             | Notes                                         |
| ---------------------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| 6 partners contactados con templates personalizados  | ⏳ pending founder                                 | Templates listos en `templates/outreach/`     |
| CRM Notion creado y poblado                          | ✅ markdown CRM done (este file) — Notion opcional |                                               |
| 3+ partners respondieron en primera semana           | ⏳ pending                                         |                                               |
| 1+ sandbox confirmado al cierre del Sprint 0         | ⏳ pending                                         |                                               |
| Templates documentados en `docs/templates/outreach/` | ✅ done                                            | 7 archivos                                    |
| Lista de jueces clave + canales en CRM               | ✅ done                                            | `docs/partnerships/judges-and-influencers.md` |
| Calendario de workshops del hackathon en agenda      | ✅ done                                            | `docs/partnerships/workshops-calendar.md`     |

---

## Cómo updatear este file

1. **Cuando enviás un mensaje** → status `contacted`, set `First contact` + `Last touch` a hoy, `Next action` a "follow-up D+3".
2. **D+3 sin respuesta** → status `bumped`, send `follow-up.md` D+3, `Last touch` = hoy.
3. **D+7 sin respuesta** → send `follow-up.md` D+7, `Last touch` = hoy.
4. **D+10 sin respuesta** → status `dead`, abrir alternative en `alternatives-matrix.md`, Notes = "moved to fallback X".
5. **Respuesta recibida** → status `responded`, Notes = brief de qué dijeron, Next action = lo que pidieron / call schedule.
6. **Call confirmed** → status `meeting_scheduled`, Notes = fecha + agenda.
7. **Sandbox funcionando** → status `sandbox_obtained`, Notes = link a runbook con setup específico.

Cada update va en un commit con mensaje `docs(partnerships): {partner} status → {new_status}`. Git history = audit trail.

---

## Sync semanal

**Lunes 09:00 BOG** — founder review:

- Update statuses según interacciones de la semana.
- Identificar críticos en `dead` → activar fallback inmediatamente.
- Standup con equipo si critical partner es blocker para sprint actual.

**Friday 17:00 BOG** — founder retro:

- ¿Qué partner avanzó esta semana?
- ¿Qué sigue bloqueado?
- ¿Hay que escalar (LinkedIn / Twitter / mutual intro)?

---

## Decisiones de outreach pendientes

- [ ] Confirmar founder personal email (`{{FOUNDER_EMAIL}}` en templates) — usar `david@moneto.xyz` post-DNS o personal interim.
- [ ] Pitch deck v1 ready — 10 slides, ENG + ES versions.
- [ ] Landing page `moneto.xyz` live (Sprint 1) — actualmente templates referencian, pero está pendiente.
- [ ] Notion público con `moneto-analysis.md` + `moneto-auth-architecture.md` — para linkear desde emails.
- [ ] Founder `@DavidZapataOh` Twitter activo + bio actualizada (proof-of-builder).
