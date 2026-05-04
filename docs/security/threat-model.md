# Threat model — Moneto

> Living document. Actualizar cuando agregamos un componente nuevo,
> integramos un partner, o respondemos a un incident.
>
> Última revisión: Sprint 0.06.

---

## Assets a proteger

| Asset                                                | Criticality | Por qué                                                    |
| ---------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| User funds (on-chain)                                | **P0**      | Pérdida irreversible. La razón por la que existimos.       |
| Viewing keys + scan keys                             | **P0**      | Acceso a la historia financiera privada del user.          |
| Recovery configuration (guardians, social recovery)  | **P0**      | Compromiso = takeover de la cuenta.                        |
| KYC documents (selfie, ID)                           | **P0**      | Identity theft + regulatory liability.                     |
| Privy embedded wallet keys                           | **P0**      | Compromiso = drain de funds.                               |
| Supabase service-role key                            | **P0**      | Bypass RLS = lectura de toda la base.                      |
| Server JWT signing secret                            | **P0**      | Forge de session tokens.                                   |
| User pseudónimo (Privy DID) ↔ wallet address mapping | P1          | Romper compartmentalization → de-anonymization on-chain.   |
| Logs / observability data                            | P1          | Indirect leak si tienen PII (mitigado por scrubber).       |
| CI/CD pipeline                                       | P1          | Compromise = supply chain attack.                          |
| Source code                                          | P2          | Open-by-design en intent, pero leak prematuro pierde edge. |

---

## Adversaries (en orden de relevancia día 1)

### Pre-launch (Sprint 0–7)

| Actor                                    | Motivación                                | Capability                                            |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| **Supply chain attacker**                | Inyectar malicious code via npm dep       | Alta — automated; afecta sin targeting                |
| **Repo compromise (cuenta GH hackeada)** | Pivote a infra (CF, Supabase)             | Media — credenciales del founder son target           |
| **Local dev compromise**                 | Laptop perdida/hackeada                   | Media — secrets en vault, pero memoria/clipboard      |
| **Curious devs (futuro equipo)**         | Acceso a prod data más allá de su rol     | Baja — internal threat, mitigada por scoped vault     |
| **Partner breach**                       | Provider (Privy/Supabase/Helius) hackeado | Baja-Media — cubierto por SOC 2 + sub-processor lists |

### Post-launch (Sprint 8+)

A las anteriores se agregan:

| Actor                               | Motivación                        | Capability                                                         |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| **Targeted attack a user (whale)**  | Drain wallet específico           | Alta — phishing + social engineering avanzado                      |
| **Mass phishing (LATAM scams)**     | Cosechar credentials              | Alta — volume-based, low effort por target                         |
| **State actor / regulator hostile** | Compelled disclosure de user data | Variable — mitigado por compartmentalization arquitectónica        |
| **Insider (post-hire)**             | Robo financiero o IP              | Media — mitigado por least-privilege + audit logs                  |
| **MEV / on-chain adversaries**      | Front-run, sandwich               | Alta — automated, mitigado por confidential balances + private RPC |

---

## STRIDE-lite por componente

### Mobile app

| Threat                           | Mitigation Sprint 0                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| **Spoofing** (fake auth screen)  | Universal links + biometric required + Privy passkey flow                                     |
| **Tampering** (modified APK/IPA) | Sentry release tracking + `appVersion` tag — anomaly detection post-launch                    |
| **Repudiation**                  | Server-side audit log de todas las txs (Sprint 1.06)                                          |
| **Info disclosure**              | SecureStore para tokens (no AsyncStorage), `attachScreenshot: false` Sentry, scrubber en logs |
| **DoS**                          | N/a por componente (relevante en API)                                                         |
| **Elevation of privilege**       | Biometric thresholds en `@moneto/config` (Sprint 7)                                           |

### API (Cloudflare Workers)

| Threat                     | Mitigation Sprint 0                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| **Spoofing**               | JWT validation Privy + Privy verification key                                                       |
| **Tampering**              | TLS 1.3 mandatory (CF default)                                                                      |
| **Repudiation**            | Axiom logs con `userId` (Sprint 0.05)                                                               |
| **Info disclosure**        | CORS allowlist por env, `secureHeaders` middleware, scrubber en errors                              |
| **DoS**                    | Rate limit middleware (Sprint 0.06), CF Bot Fight Mode, CF rate limiting per-IP en routes sensibles |
| **Elevation of privilege** | Service-role key NUNCA en mobile bundle, RLS Supabase, CODEOWNERS para auth routes                  |

### Web (landing)

| Threat                  | Mitigation Sprint 0                                                      |
| ----------------------- | ------------------------------------------------------------------------ |
| **XSS**                 | CSP estricta (Sprint 0.06) — `script-src 'self'`, no `unsafe-eval`       |
| **Clickjacking**        | `X-Frame-Options: DENY`, `frame-ancestors 'none'` en CSP                 |
| **CSRF**                | SameSite cookies (default Lax), no cookie-based auth (usamos Bearer JWT) |
| **MITM**                | HSTS preload + DNSSEC + CF Full (strict) TLS                             |
| **Credential stuffing** | Auth NO vive en web (ocurre en mobile vía Privy). Web es marketing only. |

### CI/CD

| Threat                             | Mitigation Sprint 0                                                     |
| ---------------------------------- | ----------------------------------------------------------------------- |
| **Malicious workflow merged**      | Branch protection + CODEOWNERS para `.github/workflows/*` (Sprint 0.03) |
| **Compromised action (3rd party)** | Pinear majors (`@v4` no `@latest`); evaluar SHA pinning post-MVP        |
| **Stolen GH PAT**                  | `GITHUB_TOKEN` scope mínimo en workflows; no PATs personales en repo    |
| **Secret leak via workflow logs**  | GH auto-redacta secrets en logs; gitleaks bloquea pre-merge             |

---

## Trust boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User device                                 │
│  ┌─────────────┐  bio   ┌──────────────┐                            │
│  │  Mobile UI  │◄──────►│  SecureStore │                            │
│  └──────┬──────┘        └──────────────┘                            │
└─────────┼───────────────────────────────────────────────────────────┘
          │ TLS 1.3 + JWT Bearer + CORS allowlist
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Cloudflare edge (worker)                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐                   │
│  │ Hono app │◄──►│ Rate lim │◄──►│ Sentry+Axiom │                   │
│  └────┬─────┘    └──────────┘    └──────────────┘                   │
│       │ scoped service tokens                                       │
└───────┼─────────────────────────────────────────────────────────────┘
        ├──► Privy (auth)
        ├──► Supabase (compartmentalized identity, NO wallet data)
        ├──► Helius (Solana RPC)
        ├──► Chainalysis (sanctions)
        └──► Solana mainnet (on-chain via Helius)
```

**Cada arrow cruza un trust boundary** — input/output validado con Zod en
ambos lados, scopes de tokens mínimos, rate limit en cada hop.

---

## Compartmentalization invariants (privacy thesis)

Estos invariants son **hard requirements** — su violación es escalada P0:

1. **Supabase NUNCA conoce wallet addresses, viewing keys, ni transaction signatures.**
2. **API server NUNCA loggea balances, montos, ni counterparties.**
3. **Privy DID es el único join key entre Supabase identity y Solana wallet.** Romperlo = de-anonymization.
4. **Mobile bundle NUNCA contiene service-role keys ni server secrets.**
5. **Source code NUNCA contiene credentials reales** (gitleaks pre-commit + CI).

Cada PR que toque código en `apps/api/src/{auth,compliance}/`, `packages/solana/src/umbra/`, o `apps/mobile/src/lib/observability.ts` debe verificar estos invariants. CODEOWNERS lo enforce automáticamente.

---

## Risk register (ongoing)

Tabla de risks identificados con severity + mitigation status. Update post-incident.

| ID    | Risk                             | Severity | Status                 | Mitigation                                                         |
| ----- | -------------------------------- | -------- | ---------------------- | ------------------------------------------------------------------ |
| R-001 | npm supply chain                 | High     | Mitigated (S0.03+0.06) | pnpm audit + Trivy + gitleaks + Dependabot grouped weekly          |
| R-002 | Secret leak en repo              | High     | Mitigated (S0.04)      | gitleaks pre-commit + CI + .gitignore agresivo                     |
| R-003 | Branch protection bypass         | High     | Documented (S0.03)     | Founder ejecuta external setup según runbook                       |
| R-004 | Cloudflare account compromise    | High     | Mitigated (S0.04)      | Scoped API tokens + 90d rotation + 2FA                             |
| R-005 | Privy app compromise             | Medium   | Vendor risk            | Vendor checklist + monitor Privy security advisories               |
| R-006 | Supabase RLS misconfiguration    | High     | Pending (S1)           | RLS templates en `docs/security/rls-baseline.md`, tests pre-deploy |
| R-007 | Mobile reverse engineering       | Medium   | Mitigated (S0.04)      | Cero secrets reales en bundle (solo IDs públicos)                  |
| R-008 | Logger leak PII/financial        | High     | Mitigated (S0.05)      | scrubber en `@moneto/observability` + ESLint rule (S0.06)          |
| R-009 | Rate limit bypass via spoofed IP | Medium   | Partial                | KV-backed rate limit (S0.06) + CF-Connecting-IP (CF strips X-F-F)  |
| R-010 | KYC doc storage compromise       | High     | Vendor (Persona)       | Persona SOC 2 verified pre-integration                             |

---

## Review cadence

- **Cada sprint**: actualizar tabla de risks si emerge uno nuevo.
- **Cada 90 días**: founder + senior eng review completo del threat model.
- **Post-incident**: agregar el risk + mitigation a la tabla, update assets si cambió la criticality.
- **Pre-major-release**: re-validar trust boundaries y compartmentalization invariants.
