# Dev setup — onboarding

> Time-to-first-PR target: **<2 horas** desde laptop limpia. Si tardás más,
> el blocker probablemente está en este doc — abrí un issue para fixearlo.

---

## 0. Pre-requisitos

| Tool           | Min version    | macOS install                                                 | Linux install                                                                                |
| -------------- | -------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Node.js        | 20.x           | `brew install node@20`                                        | nvm o `apt install nodejs`                                                                   |
| pnpm           | 9.x            | `npm i -g pnpm`                                               | `npm i -g pnpm`                                                                              |
| Git            | 2.30+          | viene con macOS                                               | `apt install git`                                                                            |
| Watchman       | reciente       | `brew install watchman`                                       | `apt install watchman`                                                                       |
| gitleaks       | 8.x            | `brew install gitleaks`                                       | binary release [github.com/gitleaks/gitleaks](https://github.com/gitleaks/gitleaks/releases) |
| Xcode          | 16.x           | App Store (~30min)                                            | n/a (no iOS dev en Linux)                                                                    |
| Android Studio | reciente       | [developer.android.com](https://developer.android.com/studio) | idem                                                                                         |
| Wrangler       | comes vía pnpm | `pnpm install` lo trae                                        | idem                                                                                         |

Opcional pero recomendado:

- **1Password CLI** (`brew install 1password-cli`) — para acceder al vault de secrets desde la terminal.
- **gh CLI** (`brew install gh`) — para PRs y secrets de GitHub.

---

## 1. Clonar + instalar

```bash
git clone git@github.com:DavidZapataOh/frontier.git
cd frontier/moneto
pnpm install
```

Husky se instala automáticamente vía `prepare` script. Verificá:

```bash
ls -la .husky/_/   # debe existir; pre-commit y commit-msg hooks instalados
```

---

## 2. Acceso al vault de secrets

Pedile al founder acceso al **1Password vault "Moneto Engineering"**.

Dentro vas a encontrar:

| Item                          | Lo necesitás si vas a...                      |
| ----------------------------- | --------------------------------------------- |
| `Mobile dev .env`             | Correr la app contra el backend dev           |
| `Mobile staging .env`         | Reproducir un bug reportado en staging        |
| `API dev secrets (.dev.vars)` | Correr el worker localmente                   |
| `API staging secrets`         | Sólo founder + senior (no necesario el día 1) |
| `API prod secrets`            | NUNCA necesario para dev — gated por approval |
| `Partner contacts`            | Bold, Rain, Persona, Helius, Privy onboarding |

**Política:** secrets se piden por 1Password share request → founder approve → tu vault. **NUNCA Slack, email, WhatsApp, ni paste en docs.**

---

## 3. Llenar `.env` files

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
```

Pegar los valores desde 1Password en cada file. Verificá que NINGUNO esté staged accidentally:

```bash
git status -s | grep -E "\.env\.local|\.dev\.vars$"
# (debe estar vacío — están gitignored)
```

---

## 4. Smoke test

```bash
# Typecheck (debe pasar 10/10 packages):
pnpm typecheck

# Lint (debe pasar):
pnpm lint

# Build (debe pasar):
pnpm build
```

Si alguno falla con un error que no parece venir de tu setup, abrí un issue
con el log completo — probablemente es un problema del repo, no tuyo.

---

## 5. Correr cada app

### Backend (`@moneto/api`)

```bash
pnpm --filter @moneto/api dev
# → http://localhost:8787
```

Test:

```bash
curl http://localhost:8787/health
# → {"status":"ok","service":"moneto-api","env":"development","ts":"..."}
```

### Mobile (`@moneto/mobile`)

```bash
pnpm --filter @moneto/mobile dev
```

- Apretá `i` para iOS simulator (necesita Xcode).
- Apretá `a` para Android emulator (necesita Android Studio + AVD configurado).
- Escaneá el QR con Expo Go en tu device físico.

### Web landing (`@moneto/web`)

```bash
pnpm --filter @moneto/web dev
# → http://localhost:3000
```

---

## 6. Workflow de día a día

```bash
# 1. Branch
git checkout -b feat/<sprint>-<descripcion-corta>

# 2. Hackeá. Cuando quieras commit:
git add <files>
git commit -m "feat(scope): subject in lowercase"
# Husky corre prettier en staged files + gitleaks scan + commitlint validate.

# 3. Push + PR
git push -u origin feat/<...>
gh pr create --fill
```

**Conventional Commits enforced** (commitlint):

- Tipos: `feat | fix | refactor | perf | test | docs | chore | ci | style | build | revert`
- Scopes: `mobile | api | web | programs | ui | theme | types | solana | config | utils | auth | wallet | swap | privacy | rails | compliance | yield | card | recovery | deps | release | ci | docs`

Ejemplo: `feat(mobile): add Toggle to settings screen`

---

## 7. Deploys

- **Auto a staging** en cada merge a `main` (workflow `main-deploy.yml`).
- **Production manual**: Actions → "Production release" → workflow_dispatch con
  version + release notes. Requiere founder approval (environment gate).

Ver `docs/runbooks/external-setup.md` para los secrets de GH Actions que
necesitás configurar (solo founder los rota).

---

## 8. Cuando algo se rompe

| Síntoma                             | Probable causa                           | Fix                                                                        |
| ----------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm install` falla                | Lockfile desync                          | `pnpm install --frozen-lockfile=false` (luego commit el nuevo lockfile)    |
| `pnpm typecheck` falla post-pull    | Tipos cambiaron en un workspace upstream | `pnpm install` para refrescar links + retry                                |
| `wrangler dev` no inicia            | `.dev.vars` tiene chars raros            | Verificá: sin trailing whitespace, no comillas extras alrededor de valores |
| Mobile `Metro bundler` errors       | Cache corrupto                           | `pnpm --filter @moneto/mobile exec expo start --clear`                     |
| `eslint` pasa local pero CI falla   | Versión local diferente de pinned        | `pnpm install --frozen-lockfile`                                           |
| Husky hook no corre                 | `.husky/_/` no existe                    | `pnpm exec husky` (el `prepare` lo recrea)                                 |
| Hook falla con "gitleaks not found" | Gitleaks no instalado local              | `brew install gitleaks` (o ignorá — CI lo gatea)                           |

---

## 9. Convenciones

- **TypeScript estricto siempre** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No relajar para "que pase".
- **Theme tokens, no literals** — cero `#fff` o `rgba(...)` en componentes. Todo via `useTheme()` o tokens de `@moneto/theme`.
- **Logger, no `console.log`** — usar `createLogger("scope")` de `@moneto/utils`. ESLint bloquea `console.log`.
- **`testID` en componentes interactivos** — para Maestro/Detox (Sprint 8).
- **Cero secrets en git** — gitleaks lo gatea, pero la mejor defensa es no escribirlos en archivos versionados nunca.

---

## 10. Recursos

- **CLAUDE.md** del repo (raíz, si existe) — agent-specific guidance.
- **`plans/`** — planning docs por sprint. Implementación reference.
- **`docs/runbooks/`** — secret rotation, external setup, DNS.
- **Slack `#moneto-eng`** — async questions.
- **Founder office hours** — bloque diario, calendario compartido.

¿Falta algo en este doc? PR welcome (`docs(onboarding):`).
