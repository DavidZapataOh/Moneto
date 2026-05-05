# Alternatives matrix — fallback providers

> Por cada partner crítico, plan B (y C) listo. Cuando un partner entra
> en `dead` status (D+10 sin respuesta), el founder activa el primer
> fallback **el mismo día** — no esperar, no debatir.

---

## Critical paths con fallback

### Off-ramp Colombia (USD → COP a banco/Nequi)

| Tier                | Provider              | Tradeoff vs primary                                    | Cuándo activar                     |
| ------------------- | --------------------- | ------------------------------------------------------ | ---------------------------------- |
| **1° (primary)**    | Bold                  | Best DX, settlement <10min, brand recognition          | —                                  |
| **2° (fallback A)** | Littio                | Similar API, slightly more setup, less brand           | Si Bold `dead` o pricing inviable  |
| **3° (fallback B)** | Daviplata API directa | Última opción, requiere acuerdo bancario, más complejo | Solo si Bold + Littio ambos fallan |

**Decision criteria**:

- Activar fallback A si: Bold no responde D+10, OR pricing >2% per tx,
  OR sandbox no disponible D+14.
- Activar fallback B si: A también falla por mismas razones.

**Engineering impact**: API surface diferente entre proveedores → cada
fallback agrega ~3 días de implementation. Por eso el founder debe
activar A inmediato cuando Bold se vuelve dead.

---

### Card issuer (Visa virtual)

| Tier   | Provider  | Tradeoff                                            | Cuándo activar     |
| ------ | --------- | --------------------------------------------------- | ------------------ |
| **1°** | Rain      | Solana-native, fastest path                         | —                  |
| **2°** | Reap Card | HK-based, API global, less Solana focus             | Si Rain `dead`     |
| **3°** | Baanx     | Powers MetaMask Card, mature pero menos consumer DX | Solo último resort |

**Decision criteria**:

- Activar Reap si: Rain no responde D+10, OR no soporta CO/MX, OR
  pricing fee per active card >USD 5/mo.
- Activar Baanx si: Reap también falla.

**Engineering impact**: card auth webhook flow varía — Rain usa webhook
push real-time, Reap usa polling, Baanx usa webhook+polling híbrido.
Sprint 9 (card flow) debe abstraer detrás de una `CardIssuerAdapter`
interface en `packages/integrations/`.

---

### Auth + embedded wallets

| Tier   | Provider | Tradeoff                                      | Cuándo activar  |
| ------ | -------- | --------------------------------------------- | --------------- |
| **1°** | Privy    | Best DX Solana + Stripe acquisition stability | —               |
| **2°** | Turnkey  | Más enterprise, mismo MPC model               | Si Privy `dead` |
| **3°** | Dynamic  | Similar features, menos Solana mature         | Último resort   |

**Decision criteria**:

- Activar Turnkey si: Privy no acepta hackathon sandbox, OR pricing
  inviable post-hackathon, OR no soporta `@privy-io/expo` SDK roadmap.

**Engineering impact**: Auth abstraction crítica desde día 1. Sprint 1
debe encapsular Privy detrás de `packages/auth/AuthProvider` interface
para que swap a Turnkey en Sprint 2 (si necesario) cueste 1 día, no 10.

---

### KYC

| Tier   | Provider | Tradeoff                                         | Cuándo activar                           |
| ------ | -------- | ------------------------------------------------ | ---------------------------------------- |
| **1°** | Persona  | Best DX + LATAM doc support balanceado           | —                                        |
| **2°** | Sumsub   | Más LATAM coverage histórica, comparable pricing | Si Persona `dead` o no soporta CO cédula |
| **3°** | Onfido   | Caro pero robust, último resort                  | Solo si 1° + 2° ambos fallan             |

**Decision criteria**:

- Activar Sumsub si: Persona pricing >USD 5/L1 sin volume tier, OR no
  cubre CO cédula con OCR.
- Onfido solo si presupuesto post-funding lo permite.

**Engineering impact**: KYC SDK varía mucho entre proveedores. Sprint 4
implementation debe usar `KycProviderAdapter` pattern, similar a card.

---

### Solana RPC

| Tier               | Provider          | Tradeoff                                      | Cuándo activar                  |
| ------------------ | ----------------- | --------------------------------------------- | ------------------------------- |
| **1°**             | Helius            | Best DX, indexing+webhooks, hackathon credits | —                               |
| **2°**             | RPC Fast          | También hackathon sponsor, diferente API      | Si Helius credits no cubren uso |
| **3°**             | Triton One        | Bare-metal, free devnet, prod paid            | Si Helius+RPCFast ambos fallan  |
| **4° (emergency)** | Public devnet RPC | Sin webhooks, rate limits agresivos           | Solo dev local                  |

**Decision criteria**:

- Activar RPC Fast si: Helius credits no llegan en time, OR rate limits
  bloquean tests.
- Triton si: ambos cloud providers fallan, o necesitamos near-mainnet
  performance en testing.

**Engineering impact**: RPC URL configurable via env (ya wired desde
Sprint 0.04). Switch es 1 env var.

---

## Privacy layer (Umbra)

**Sin fallback técnico** — Umbra es la thesis. Si Umbra no provee
soporte:

1. Integramos via SDK público (siempre disponible).
2. Perdemos el ángulo del bounty Privacy + Confidential Compute (no
   tendríamos blessing del team, dificulta technical depth visible).
3. **NO swappear a alternativa** — preferimos shipping con Umbra incluso
   sin team interaction vs. integrar otra solución privacy.

**Action plan si Umbra ghosts**:

- Continuar integration usando docs públicos.
- Atender workshop si lo dan en Q&A público.
- Contactar via TG `@umbra-team` como último recurso.
- Submission menciona integration profunda, sin presumir endorsement.

---

## Off-ramp expansion (post-MVP, Sprints 8+)

Para cada país adicional, fallback hierarchy. No es bloqueante para MVP.

### México

| Tier | Provider                           |
| ---- | ---------------------------------- |
| 1°   | Bitso                              |
| 2°   | Volabit                            |
| 3°   | DolarApp (consumer) o Locker (B2B) |

### Argentina

| Tier | Provider |
| ---- | -------- |
| 1°   | Lemon    |
| 2°   | Belo     |
| 3°   | Ripio    |

### Brasil

| Tier | Provider        |
| ---- | --------------- |
| 1°   | Mercado Bitcoin |
| 2°   | Foxbit          |
| 3°   | Transfero       |

---

## Vendor swap playbook

Cuando el founder decide activar un fallback:

### Day 0 (decisión)

1. Update `crm-tracker.md`: original vendor → `dead`.
2. Update `crm-tracker.md`: alternative vendor → `not_contacted` con
   priority high.
3. Send template del alternative provider (preparar similar al primary
   en `templates/outreach/`).

### Day 1-3 (engineering prep)

4. Research alternative provider docs (en paralelo al outreach).
5. Update threat model si arquitectura cambia (Sprint 0.06 doc).
6. Update vendor-checklist.md status del alternative (ahora en review).

### Day 4-7 (integration prep)

7. Si responden con sandbox: spin up integration en feature branch.
8. Test parity con lo que esperábamos del primary.
9. Document gaps y workarounds en runbook específico del vendor nuevo.

### Day 7+ (full swap)

10. Si sandbox testing OK: merge integration a main.
11. Update env vars + secrets en `.dev.vars.example` y deploy runbooks.
12. Update arquitectural docs que mencionaban el primary.
13. Notify equipo en standup que el swap está hecho.

---

## Update cadence

Este file se updatea:

- **Cada vez que un fallback se activa** → mover el alternative a "active",
  notar fecha y rationale.
- **Cuando emergen nuevos providers viables** → agregar como tier 3+ en
  el path correspondiente.
- **Post-mortem incidents** que involucran vendor failure → update
  decision criteria con lo aprendido.
