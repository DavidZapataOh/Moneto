# @moneto/programs

Anchor workspace para los smart contracts de Moneto.

## Status

Sprint 0 stub — scaffolding inicial. Los programas reales se construyen en sprints posteriores:

- **Sprint 5** — `moneto_recovery` (social recovery con guardians + 48h timelock).
- **Sprint 7** — `moneto_yield_router` (router de yield protocols, integración Drift/Kamino).

## Toolchain

- Anchor 0.30.1
- Solana CLI 1.18+
- Rust 1.79+ (managed via `rustup`)

## Layout

```
apps/programs/
├── Anchor.toml          ← Anchor workspace config
├── Cargo.toml           ← Rust workspace
├── programs/            ← Cada subdir = 1 programa
│   └── (vacío hasta Sprint 5)
├── tests/               ← Anchor test suites
└── target/              ← Build artifacts (gitignored)
```

## Comandos

| Comando                                 | Acción                   |
| --------------------------------------- | ------------------------ |
| `pnpm --filter @moneto/programs build`  | `anchor build`           |
| `pnpm --filter @moneto/programs test`   | `anchor test` (localnet) |
| `pnpm --filter @moneto/programs deploy` | `anchor deploy`          |

## Por qué Anchor (vs raw Solana)

- IDLs auto-generados → typed clients para `@moneto/solana`.
- Macros `#[derive(Accounts)]` reducen boilerplate y errores de validación.
- Standard de la industria — auditores y devs los reconocen.
