# Partnerships — index

> Index para todo lo relacionado a partner outreach. Founder usa este
> file como punto de entrada — desde acá navega a templates, CRM,
> calendario y matrices de fallback.

---

## Estructura

```
docs/partnerships/
├── README.md                       (este file — index)
├── crm-tracker.md                  (source of truth, status por partner)
├── judges-and-influencers.md       (jueces probables, engagement orgánico)
├── workshops-calendar.md           (eventos hackathon, attendance protocol)
└── alternatives-matrix.md          (fallback providers por critical path)

docs/templates/outreach/
├── README.md                       (placeholders + tone guidelines + cadencia)
├── bold.md                         (Bold Colombia — off-ramp)
├── rain.md                         (Rain Cards — Visa virtual)
├── umbra.md                        (Umbra Privacy — bounty target)
├── privy.md                        (Privy — auth + embedded wallets)
├── persona.md                      (Persona — KYC)
├── helius.md                       (Helius — Solana RPC)
└── follow-up.md                    (genérico D+3 / D+7)
```

---

## Workflow del founder

### Día 0 (Sprint 0 close-out)

1. Leer `templates/outreach/README.md` — placeholders + tone.
2. Personalizar cada template con datos reales (`{{FOUNDER_NAME}}`,
   email, etc.).
3. Send 6 emails/DMs según `crm-tracker.md`.
4. Update CRM tracker → status `contacted`.

### Día 1-3

5. Schedule follow-ups en calendar (D+3 si silencio).
6. Atender Discords (Solana, Privy, Helius, Umbra) para visibility.
7. Actualizar `judges-and-influencers.md` con handles de Twitter cuando
   Colosseum confirme jueces oficial.

### Semana 1+

8. Update `crm-tracker.md` cada vez que hay status change.
9. Atender workshops según `workshops-calendar.md`. Notas en
   `partnerships/workshop-notes/<slug>.md` (crear file por workshop).
10. Si critical partner `dead`, activar fallback en `alternatives-matrix.md`
    el mismo día.

### Sync semanal

- **Lunes 09:00 BOG**: founder review CRM, identifica blockers.
- **Friday 17:00 BOG**: retro semana, plan próximos contactos.

---

## Quality gates Sprint 0.07

| Gate                                                                      | Status                       |
| ------------------------------------------------------------------------- | ---------------------------- |
| Templates 7 partners (incluyendo follow-up) en `docs/templates/outreach/` | ✅ done                      |
| CRM tracker creado y poblado                                              | ✅ done                      |
| Judges + influencers map                                                  | ✅ done                      |
| Workshops calendar con attendance protocol                                | ✅ done                      |
| Alternatives matrix con activation criteria                               | ✅ done                      |
| 6 partners contactados                                                    | ⏳ pending founder execution |
| 3+ partners respondieron primera semana                                   | ⏳ pending                   |
| 1+ sandbox confirmado al cierre Sprint 0                                  | ⏳ pending                   |

---

## Cómo el equipo lee esto

- **Founder**: source of truth, daily checking, update on every interaction.
- **Senior eng**: lee `workshops-calendar.md` + `alternatives-matrix.md`
  para anticipar engineering changes.
- **Cualquier hire futuro**: lee `crm-tracker.md` para context de status,
  `templates/outreach/` para tone consistency.
- **Investors/jueces post-hackathon**: ven el diligent process documented
  → señal de discipline.

---

## Referencias cruzadas

- Setup técnico de los partners (cuando obtenemos sandbox): `docs/runbooks/external-setup.md`.
- Vendor security checklist (SOC 2, DPA, etc): `docs/security/vendor-checklist.md`.
- Threat model si cambia con vendor swap: `docs/security/threat-model.md`.
- Plan original Sprint 0.07: `plans/sprint-0-foundation/07-partner-outreach.md`.
