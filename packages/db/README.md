# @moneto/db

Schema Postgres + migrations + typed Database interface para Supabase.

## Architecture

```
packages/db/
├── src/
│   ├── index.ts                    re-exports
│   └── types.ts                    Database type para `createClient<Database>`
├── supabase/
│   ├── config.toml                 local stack config (`supabase start`)
│   ├── migrations/
│   │   ├── 0001_create_profiles.sql
│   │   ├── 0002_create_user_preferences.sql
│   │   ├── 0003_create_guardian_notifications.sql
│   │   ├── 0004_create_viewing_keys.sql
│   │   └── 0005_setup_vault.sql
│   └── functions/
│       └── sync-profile/           Deno edge fn (Privy JWT → upsert profile)
└── tests/
    └── rls.test.ts                 RLS smoke tests (run con vitest cuando hay project linked)
```

## Compartmentalization invariant

**Supabase NUNCA almacena**:

- `wallet_address` / `pubkey` — eso vive en Privy
- balances / financial data — eso vive on-chain
- transaction history — eso vive on-chain

Romper este invariant es un escalation P0 — ver `docs/security/threat-model.md` § "Compartmentalization invariants".

Cada migration que toca `profiles` debe pasar por code review (CODEOWNERS lo enforce). El comment en la tabla refuerza la regla.

## Comandos

| Script              | Acción                                           |
| ------------------- | ------------------------------------------------ |
| `pnpm db:start`     | Levanta Postgres + Auth + Storage local (Docker) |
| `pnpm db:reset`     | Drop + recreate + apply all migrations           |
| `pnpm db:push`      | Push migrations al project remoto linked         |
| `pnpm db:diff`      | Genera migration desde diff vs DB linked         |
| `pnpm db:gen-types` | Regenera `src/types.generated.ts` desde DB local |
| `pnpm db:lint`      | Lint SQL + check policies                        |
| `pnpm fn:serve`     | Corre edge fns local (con `.env.local`)          |
| `pnpm fn:deploy`    | Deploy fns al project remoto linked              |

## Setup (founder)

Ver `docs/runbooks/supabase-setup.md` paso a paso completo. Resumen:

1. Crear 3 projects (`moneto-dev`, `moneto-staging`, `moneto-prod`) en supabase.com.
2. Instalar Supabase CLI: `brew install supabase/tap/supabase`.
3. Login: `supabase login`.
4. Link al project dev: `cd packages/db && supabase link --project-ref <DEV_REF>`.
5. Push migrations: `pnpm db:push`.
6. Deploy edge fns: `pnpm fn:deploy`.
7. Configurar Custom JWT en Supabase dashboard con Privy JWKS URL.
8. Repetir 4-7 para staging + prod.

## Tests

`tests/rls.test.ts` corre con vitest. Requiere `SUPABASE_URL` + 2 JWTs de prueba (UserA, UserB) en env. CI los inyecta como secrets en Sprint 8 cuando ramp-eemos test coverage.

Local-only run:

```bash
SUPABASE_URL=http://localhost:54321 \
ANON_KEY=... \
USER_A_TOKEN=... \
USER_B_TOKEN=... \
pnpm --filter @moneto/db test
```
