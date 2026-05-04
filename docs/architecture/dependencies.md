# Dependency review process

> Cómo decidimos agregar (o quitar) una dep. Cada dep es deuda y superficie
> de ataque — vale el costo solo si el upside es claro.

---

## Filosofía

> "El mejor código es el que no escribís. El peor es el que importás sin
> entender." — adaptación de varios autores.

Moneto es un neobanco: cada dep que agregamos es una potencial
supply-chain vulnerability. La pregunta antes de `pnpm add X` no es
"¿funciona?" — es "¿vale la pena el riesgo?".

---

## Decision tree pre-add

```
                 ┌─────────────────────────┐
                 │   Necesito feature X     │
                 └──────────┬──────────────┘
                            │
              ┌─────────────┴─────────────┐
              │ ¿Lo puedo hacer en <50    │
              │  LOC custom?              │
              └─────┬─────────────┬───────┘
                Yes │             │ No
                    ▼             ▼
              ┌──────────┐  ┌───────────────────┐
              │  Write   │  │ Search npm + GH   │
              │  custom  │  │ stars + downloads │
              └──────────┘  └────────┬──────────┘
                                     │
                          ┌──────────┴───────────┐
                          │  Pasa los 5 checks?  │
                          └──┬───────────────┬───┘
                          No │           Yes │
                             ▼               ▼
                  ┌─────────────────┐  ┌──────────┐
                  │ Buscar otra opt │  │ pnpm add │
                  │ o escribir cust │  │  + doc   │
                  └─────────────────┘  └──────────┘
```

---

## Los 5 checks

### 1. ¿Está mantenida?

- **Last commit ≤6 meses**.
- **Repository no archived**.
- **Issues abiertos críticos** ≤30 días respondidos.
- **Releases regulares** (no abandoned).

### 2. ¿Es popular pero no super-popular maliciosamente?

- **Weekly downloads ≥10K** (señal de uso real, no abandonware).
- **Stars + watchers** razonables proporcionales a downloads.
- **Pero**: si una dep "trivial" tiene 50M downloads/week, sospechar typosquatting o supply chain attack histórica. Verificar el package real vs typo.

### 3. ¿Está auditada?

- **Socket.dev rating** — verificar antes de instalar (https://socket.dev/npm/package/X).
- **`pnpm audit`** después de install — debe estar limpio.
- **Snyk advisor** secondary check.
- Si tiene CVE high/critical sin fix → no usar.

### 4. ¿License compatible?

| License                       | Usar? | Notas                                                                         |
| ----------------------------- | ----- | ----------------------------------------------------------------------------- |
| MIT, Apache 2.0, BSD-2/3, ISC | ✅    | Default OK                                                                    |
| MPL 2.0, LGPL                 | ⚠️    | Caso por caso (Moneto es propietario; LGPL OK para libs dinámicamente linked) |
| GPL v2/v3, AGPL               | ❌    | Copyleft viral incompatible con código propietario                            |
| Commercial / proprietary      | ⚠️    | Solo si validamos los terms — algunos prohíben uso en SaaS                    |
| WTFPL, BSL, JSON              | ⚠️    | Caso por caso — algunos tienen quirks                                         |
| Sin license                   | ❌    | All rights reserved by default — prohibido usar                               |

### 5. ¿Bundle size aceptable?

- **Mobile**: dep importante (importada en >3 screens) <100KB minified gzipped. Check con [bundlephobia](https://bundlephobia.com).
- **Backend (Workers)**: <500KB total worker size. Workers tienen 1MB cap (paid 10MB).
- **Web**: depende del page; deps en client components son críticos, en server components/loaders no impactan.

---

## Casos especiales

### Crypto / financial / auth deps

Hard rule: **doble review** (founder + senior eng) para cualquier dep que toque:

- Wallet keys / signatures
- Hashing / encryption (no rolling our own pero verificar implementación de la dep)
- JWT validation
- Key derivation (KDF)
- Random number generation (debe usar CSPRNG)

### Solana ecosystem deps

Solana ecosystem es young y rápido. Deps relevantes (`@solana/web3.js`,
`@coral-xyz/anchor`, etc.) suelen tener breaking changes. Pin majors,
test exhaustivamente al actualizar.

### Polyfills

Workers + RN tienen runtimes restringidos. Antes de agregar una dep que
parece "node-only", verificar que tiene polyfills o adapter para nuestra
target. Cf. `@axiomhq/js` que funciona en Workers porque usa `fetch`
nativo.

---

## Documentación obligatoria

Cada dep significativa (importada en código de producción, no solo dev) se documenta en `docs/architecture/dependencies.md` (este file) en la tabla de abajo:

| Dep                       | Versión | Por qué                                                                                | Alternativas evaluadas                                                        | Trigger para reevaluar                                      |
| ------------------------- | ------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `hono`                    | ^4.6    | DX excelente para Cloudflare Workers, type-safe routing, middlewares maduros           | Itty-router (más simple), worktop (menos mantenido)                           | Si Hono pierde tracción o aparece algo con mejor TS support |
| `zod`                     | ^3.23   | Single source of truth para validation runtime + types. Standard de facto.             | Yup (menos type-safe), io-ts (DX peor)                                        | Standard library de TS adopta validation (Stage 3 proposal) |
| `@sentry/cloudflare`      | ^10     | Error tracking + tracing native al edge runtime.                                       | Custom logger (no UX bueno para triage)                                       | Cambio de stack de error tracking                           |
| `@axiomhq/js`             | ^1.6    | Logs structured, ingest por HTTP (Workers-friendly), tier free generoso.               | Datadog (caro), CloudWatch (poor UX cross-cloud), self-hosted Loki (overhead) | Si Axiom cambia pricing                                     |
| `@sentry/react-native`    | ^8      | Sentry RN SDK estándar.                                                                | Bugsnag (similar pero menos features)                                         | Cambio de stack                                             |
| `posthog-react-native`    | ^4.44   | Analytics + feature flags + session replay en una herramienta. Free tier 1M events/mo. | Mixpanel (caro), Amplitude (caro), Segment (es un router, no destination)     | Cambio de stack                                             |
| `expo`                    | ~54     | RN framework con managed workflow + EAS. Sprint 1 evalua si seguimos managed.          | Bare RN (más control, más overhead)                                           | Si Expo limita features que necesitamos en Sprint 6+        |
| `expo-router`             | ~6      | Routing file-based, deep links, type-safe routes.                                      | React Navigation directo (más boilerplate)                                    | Si breaking changes mayores en v7                           |
| `react-native-reanimated` | ~4      | Animations nativas, 60fps.                                                             | Animated API (no perf)                                                        | n/a — estándar de la industria                              |
| `nativewind`              | ^4      | Tailwind para RN — DX consistente con web.                                             | StyleSheet.create (verbose)                                                   | Si rompe perf en screens densas                             |
| `@privy-io/*`             | TBD S1  | Embedded wallets + auth + MFA. Compartmentalization-aligned.                           | Web3Auth (similar), Magic (similar)                                           | Si Privy cambia pricing o terms hostiles                    |
| `@supabase/supabase-js`   | TBD S1  | Postgres managed + RLS + Auth + Storage.                                               | Neon + Auth0 (más componentes a manejar)                                      | Si Supabase RLS no escala o cambian pricing                 |

**Owner**: el dev que agregó la dep mantiene su entry actualizada.

---

## Cuando evaluar removerla

Reevaluar cada dep al menos cada 6 meses (Sprint review):

- ¿Sigue mantenida?
- ¿La estamos usando? (`depcheck` puede flagear unused).
- ¿Apareció algo más liviano / mejor mantenido / con mejor security track record?
- ¿Su bundle size se infló?
- ¿Tuvo algún CVE?

Si la respuesta a alguna es "preocupante" → ticket de tech debt para evaluar reemplazo.

---

## Anti-patterns

### ❌ `pnpm add` rápido sin review

Friction es feature, no bug. Tomarse 10 minutos por dep nueva ahorra horas/días post-incident.

### ❌ "Es solo dev dep"

Dev deps también son supply chain. `husky`, `eslint-*`, `prettier` corren en tu máquina + en CI. Mismo nivel de scrutiny.

### ❌ Pin de exact version (`5.2.3` en lugar de `^5.2.3`)

Lockfile ya pinea exact. El range del `package.json` dice "qué tan tolerante soy a updates". `^` para minor/patch automáticos via Dependabot, `~` para patch only en deps high-risk, exact pin solo cuando hay un bug conocido en una versión.

### ❌ Múltiples utilities libs (lodash + ramda + just-\*)

Elegir UNA. Bundle cost se multiplica. Si necesitás algo específico que no está en la elegida, escribir el helper custom (50 LOC < 100KB de bundle).

---

## Bash rituals útiles

```bash
# Audit dep tree para una package específica.
pnpm why <package>

# Ver deps unused.
pnpm dlx depcheck

# Update interactivo con preview.
pnpm update -i

# Outdated.
pnpm outdated -r

# Bundle analysis (Next.js).
pnpm --filter @moneto/web build && open .next/analyze
```
