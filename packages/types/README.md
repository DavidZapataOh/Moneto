# @moneto/types

Shared domain types and Zod schemas for the Moneto monorepo.

## Purpose

Single source of truth for runtime-validated data shapes across:
- Mobile app (Expo)
- Backend API (Hono on Cloudflare Workers)
- Web app (Next.js)

## Conventions

- All exports use **named exports** (no defaults).
- Zod schemas are the source of truth — TS types are inferred via `z.infer<...>`.
- Domain modules live in `src/domain/`. Cross-cutting helpers in `src/`.
- BigInt fields (e.g., `Asset.balance`) accept both `bigint` and string for wire-safe serialization.

## Layout

```
src/
├── domain/
│   ├── asset.ts         # Asset, AssetId, AssetCategory
│   ├── transaction.ts   # Transaction, TxType, TxStatus
│   └── user.ts          # Profile, UserPreferences, KycLevel
└── index.ts
```

## Usage

```typescript
import { type Asset, AssetSchema } from "@moneto/types";

const validated = AssetSchema.parse(serverPayload);
```
