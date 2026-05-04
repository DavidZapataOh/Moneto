# Vendor security checklist

> Aplicar antes de integrar cualquier partner en production paths críticos
> (auth, custody, compliance, payments). Para vendors no críticos
> (analytics opcional, font CDN), checklist liviano abajo.

---

## Critical vendor checklist (Privy, Supabase, Helius, Persona, Bold, Rain, etc.)

### Compliance

- [ ] **SOC 2 Type II report** — request directo a sales si no público.
      Validar fecha (≤12 meses) + scope (cubre el servicio que usaremos).
- [ ] **GDPR / data processing addendum (DPA)** firmado si manejan PII.
- [ ] **Sub-processor list** — quiénes más tocan nuestros datos? ¿Cada
      uno tiene su propio SOC 2?
- [ ] **Data residency** — ¿en qué regiones almacenan? Para users LATAM,
      preferir US/EU; evitar regiones con regímenes hostiles.
- [ ] **Data retention policy** clara y configurable.
- [ ] **Right to erasure (GDPR Art. 17)** — proceso para borrar user data
      on-demand. Critical para LATAM compliance también (Habeas Data en CO/AR).
- [ ] **Encryption at rest + in transit** documented.

### Security operations

- [ ] **Pen test reciente** (≤12 meses) — request summary o public attestation.
- [ ] **Bug bounty program activo** — señal de madurez.
- [ ] **Incident response policy** — MTTR target, comms playbook, post-mortem culture.
- [ ] **Status page público** con históricos.
- [ ] **Security advisories channel** — RSS / mailing list / blog. Suscribirse.

### Technical

- [ ] **Scoped API tokens** — no requieren master key.
- [ ] **2FA / SSO** disponible para nuestra cuenta.
- [ ] **IP allowlisting** disponible (post-MVP cuando endurecemos).
- [ ] **Webhook signing** — payloads firmados para prevenir replay.
- [ ] **Audit logs** accesibles para nuestros admins.
- [ ] **TLS 1.3** mandatory.

### Comerciales

- [ ] **SLA definido** (uptime %, response time).
- [ ] **Liability cap razonable** (no <USD 100K para vendors críticos).
- [ ] **Termination clause** con offboarding de data.
- [ ] **Pricing transparente** — no surprise tiers.

**Decisión**: si <80% de los items están ✅, **NO usar para production paths críticos**. Para items pendientes de cumplir post-launch, documentar en `docs/security/vendor-decisions.md` con timeline.

---

## Per-vendor status (matrix viva)

> Actualizar cada vez que firmamos con un nuevo vendor.

| Vendor      | Tier             | Service                 | SOC 2       | DPA                  | Sub-processors reviewed | Pen test   | Status                        |
| ----------- | ---------------- | ----------------------- | ----------- | -------------------- | ----------------------- | ---------- | ----------------------------- |
| Privy       | Critical         | Auth + embedded wallets | ⏳ Sprint 1 | ⏳                   | ⏳                      | ⏳         | Pre-integration review        |
| Supabase    | Critical         | Identity DB             | ⏳ Sprint 1 | ⏳                   | ⏳                      | ⏳         | Pre-integration review        |
| Helius      | Critical         | Solana RPC + indexing   | ⏳ Sprint 3 | n/a (no PII)         | ⏳                      | ⏳         | Pre-integration review        |
| Persona     | Critical         | KYC                     | ⏳ Sprint 4 | ⏳                   | ⏳                      | ⏳         | Pre-integration review        |
| Chainalysis | Critical         | Sanctions screening     | ⏳ Sprint 4 | n/a (only addresses) | ⏳                      | ⏳         | Pre-integration review        |
| Bold        | Critical (CO)    | Off-ramp Colombia       | ⏳ Sprint 6 | ⏳                   | ⏳                      | ⏳         | Pre-integration review        |
| Rain        | Critical         | Card issuer             | ⏳ Sprint 9 | ⏳                   | ⏳                      | ⏳         | Pre-integration review        |
| Sentry      | Important        | Error tracking          | ✅ public   | ⏳                   | ✅ public               | ✅ regular | Approved                      |
| Axiom       | Important        | Logs                    | ✅ public   | ⏳                   | ✅ public               | ⏳         | Approved (data flow scrubbed) |
| PostHog     | Important        | Analytics               | ✅ public   | ⏳                   | ✅ public               | ⏳         | Approved (events bucketed)    |
| Cloudflare  | Critical (infra) | Workers + CDN + DNS     | ✅ public   | ✅ standard          | ✅ public               | ✅ regular | Approved                      |
| Resend      | Important        | Transactional email     | ⏳          | ⏳                   | ⏳                      | ⏳         | Sprint 1 review               |
| Vercel      | Important        | Web hosting             | ✅ public   | ✅ standard          | ✅ public               | ✅ regular | Approved                      |

---

## Non-critical vendor — light checklist

Para tools que no tocan PII directamente (CI services, dev tools, analytics opcional):

- [ ] License compatible (MIT/Apache/BSD; no GPL para core, no comercial restricted).
- [ ] Tiene status page público o canal de incidents.
- [ ] No requiere admin access a nuestro infra.
- [ ] Si free tier, política de retention de datos clara.

---

## Cuando un vendor falla un check

1. **Documentar el gap** en `docs/security/vendor-decisions.md` con justificación.
2. **Implementar mitigación compensatoria** si vamos a usarlo igual (ej: encryption at rest del lado nuestro antes de mandar a vendor).
3. **Set timeline de remediation** — re-evaluate en 6 meses o cuando vendor remedie el gap.
4. **Si critical y sin mitigación posible** → no usar. Buscar alternativa.

---

## Vendor offboarding playbook

Cuando deprecamos un vendor (cambiamos de provider o discontinuamos integración):

1. Stop ingest de nueva data al vendor.
2. Export historical data si retain rights aplican.
3. Submit data deletion request (GDPR Art. 17 / equivalente LATAM).
4. Confirm deletion con vendor (algunos retornan certificate).
5. Rotate cualquier shared secret.
6. Revoke API tokens en vendor dashboard.
7. Document offboarding en `docs/security/vendor-decisions.md`.

---

## Resources

- **Cloud Security Alliance STAR Registry** — https://cloudsecurityalliance.org/star/registry/ — many vendors publish self-attestations.
- **SOC 2 Type II vs Type I**: Type II covers operating effectiveness over a period (≥6 months). Type I es una snapshot — preferir Type II.
- **CCPA / GDPR / Habeas Data (CO) / LFPDPPP (MX)** — regulatory frameworks aplicables a Moneto.
