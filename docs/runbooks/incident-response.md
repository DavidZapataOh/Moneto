# Incident response runbook

> Playbook de qué hacer cuando algo se rompe. Aplicable desde día 1
> (incluso pre-launch — incidents internos cuentan también).
>
> Si estás leyendo esto durante un incident: respirá, abrí Slack
> `#moneto-incidents`, llamá al on-call, seguí los pasos.

---

## Severidades

| Sev               | Definición                                                                     | Response time          | Quien responde                          |
| ----------------- | ------------------------------------------------------------------------------ | ---------------------- | --------------------------------------- |
| **P0 — Critical** | Funds at risk, data breach, mass user impact (>50% users), regulatory exposure | **<15min**             | All hands. Founder + senior eng + comms |
| **P1 — High**     | Core feature down (auth, send, balance), partial impact (10-50%)               | **<1h**                | On-call eng + founder                   |
| **P2 — Medium**   | Degraded UX, workaround exists, <10% users affected                            | **<4h business hours** | On-call eng                             |
| **P3 — Low**      | Minor bug, no immediate impact, can wait next sprint                           | Next standup           | Whoever picks it up                     |

**Cuando dudás de la severidad, escalá**. Bajar de P0 a P1 mid-incident es OK; subir P3 a P0 después de horas es peor.

---

## Roles durante un incident

### Incident Commander (IC)

- **Quién**: founder default; cuando equipo crezca, on-call rotation.
- **Job**: coordina, decide, comunica. NO ejecuta el fix (eso es el SME).
- **Decisiones**: severity, when to roll back, when to comms, when to declare resolved.

### Subject Matter Expert (SME)

- **Quién**: dev del componente afectado (ej: backend eng si el incident es API; mobile eng si es crash).
- **Job**: diagnoses, propone fix, ejecuta, monitoriza. Reporta al IC.
- **Si no hay SME claro**: el IC asigna al dev disponible más senior en el área.

### Comms

- **Quién**: founder (Sprint 0–4); dedicated rol post-launch.
- **Job**: status page, customer notifications, Slack updates internas, post-incident comms.

---

## Playbook P0 — Critical

### Minuto 0–5 (detection)

1. **Confirma el incident** — ¿es real? ¿Sentry pico, Axiom alert, user reports? Si es un solo user → puede ser P1/P2.
2. **Declarar P0** en Slack `#moneto-incidents` con:
   - Una frase de qué está pasando.
   - Severidad.
   - Quien es el IC (vos si nadie más responde).
3. **Page al on-call** si no es horario laboral.

### Minuto 5–15 (triage)

4. **IC abre incident channel** `#inc-YYYYMMDD-<slug>` para el chat detallado, y deja `#moneto-incidents` para summary updates.
5. **SME diagnoses** — Sentry stack trace, Axiom logs alrededor del timestamp, PostHog session replay si user-affecting.
6. **Decisión inmediata**: rollback vs hotfix?
   - **Rollback** si: causa conocida es un deploy reciente, baja confianza en hotfix rápido.
   - **Hotfix** si: causa conocida y fix es trivial (revert single commit, env var).
7. **Comms** — si user-facing >5min, status page update + Slack a customers afectados.

### Minuto 15–60 (mitigation)

8. **SME ejecuta** rollback o hotfix.
9. **Verificar** que el incident está mitigado:
   - Sentry error rate baja a baseline.
   - `/health` healthy en todos los envs.
   - Smoke test del flow afectado.
10. **Monitoreo activo** 30min después de "resuelto" — incidents tienen aftershocks.

### Hora+ (post-mortem)

11. **Declarar resolved** cuando confianza ≥95% (no 100% — eso es deception).
12. **Status page** update final.
13. **Post-mortem** doc en `docs/incidents/YYYY-MM-DD-<slug>.md` dentro de 48h. Template abajo.

---

## Playbook P1 — High

Igual que P0 pero:

- Sin all-hands automático — solo on-call + founder.
- Comms a customers solo si >30min de impact.
- Post-mortem en 5 días business.

---

## Playbook P2/P3

Issue en el backlog. Si P2: priorizar para el sprint actual. Si P3: next sprint.
Sin post-mortem requerido (a menos que aparezca pattern recurrente).

---

## Comms templates

### Status page incident — initial

```
Investigating — [breve título]

We're investigating reports of [X]. Some users may experience [Y].
Updates here every 15 minutes.

Started: [timestamp UTC]
```

### Status page incident — update

```
Identified — [breve título]

We've identified the cause: [Z]. Working on a fix.

ETA: ~[N] minutes.
```

### Status page incident — resolved

```
Resolved — [breve título]

The issue has been resolved as of [timestamp UTC]. Total duration: [N] minutes.
A detailed post-mortem will follow within [48h / 5 days].
```

### Customer email (post-incident)

```
Subject: Incident on [date] — what happened

Hi [name],

On [date] between [start] and [end], some users experienced [impact]. You
were affected because [specific].

What happened: [1-2 sentence summary]
What we did: [mitigation]
What we're doing: [prevention]

We're sorry. The detailed post-mortem is at [link].

— Moneto team
```

### Slack announcement (internal)

```
🚨 Incident P[0/1/2] — [title]

What: [breve]
Impact: [users/features afectados]
Status: investigating / mitigating / monitoring / resolved
IC: [@person]
Channel: #inc-YYYYMMDD-slug
```

---

## Post-mortem template

`docs/incidents/YYYY-MM-DD-<slug>.md`:

```markdown
# Incident YYYY-MM-DD — [title]

**Severity**: P[0/1/2]
**Duration**: [start UTC] → [end UTC] = [N] minutes
**Users affected**: ~N (% of MAU)
**Author**: [@person]
**Reviewers**: [@founder]

---

## TL;DR

[1-2 sentences: what happened, what was the impact, what's the fix.]

---

## Timeline (UTC)

- HH:MM — first alert (Sentry / user report / etc.)
- HH:MM — IC declared
- HH:MM — root cause identified
- HH:MM — fix deployed
- HH:MM — declared resolved
- HH:MM — monitoring window ended

---

## What happened (technical)

[Paragraph: the chain of events. Be specific. Link to commits, Sentry
issues, Axiom queries, runbooks.]

---

## What went well

- [bullets]

---

## What went wrong

- [bullets]

---

## Root cause

[Single, specific root cause. No "human error" — that's the proximate
cause. The root cause is "the system allowed a single dev to push X without
Y check". Fix the system.]

---

## Action items

- [ ] [owner] — [thing] — by [date]
- [ ] [owner] — [thing] — by [date]

---

## Lessons learned

[What changes in our culture / processes / docs / code as result of this?]
```

---

## Backups & rollback

### API (Cloudflare Workers)

- `wrangler rollback` — revierte al deploy anterior (CF guarda histórico).
- Tiempo: <30s.

### Mobile (EAS Update)

- `eas update --branch production --republish <prev-update-id>` — revierte a un OTA anterior.
- Tiempo: ~2min para que el rollback se propague a clients que abren app.
- **Limitación**: solo cubre updates JS — si el bug es nativo, requiere new build (1+ día store review).

### Web (Vercel)

- Vercel dashboard → Deployments → "Promote to Production" en el deploy anterior.
- Tiempo: <30s.

### Supabase (Sprint 1+)

- Point-in-time recovery (PITR) habilitado — revertir a cualquier punto en últimas 7 días (paid tier).
- Migration rollback: `pnpm migrate:down` (cuando exista).

---

## On-call rotation (cuando equipo crezca)

Sprint 0–4: founder es on-call 24/7 (small team, pre-launch).
Sprint 5+: rotation semanal entre senior engs. Comp time durante on-call week.

Tools post-launch:

- **PagerDuty / Opsgenie** para escalation chains.
- **Slack** para low-severity alerts.
- **Phone call** solo P0/P1 fuera de horas.

---

## Lessons-learned policy

Cada post-mortem genera al menos 1 action item — sin excepciones. "We need
to be more careful" no es action item; "agregar test E2E para flow X" o
"agregar alert para metric Y" sí.

Los action items van al sprint backlog con label `incident-followup` y se
revisan en cada sprint review.

---

## Resources

- **Google SRE book** — capítulo 14 ("Managing Incidents").
- **Atlassian incident handbook** — https://www.atlassian.com/incident-management/handbook
- **PagerDuty IR docs** — playbooks bien curados.
