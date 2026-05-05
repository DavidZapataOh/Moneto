# @moneto/types

> Single source of truth para domain models + asset registry. Cero React,
> cero platform deps — consumed por mobile, api, on-chain orchestrator,
> y future apps.

---

## Layout

```
src/
  domain/
    asset.ts          # AssetId, AssetCategory, AssetMeta, Asset (Zod runtime)
    transaction.ts    # Tx schemas
    user.ts           # User schemas
  assets.ts           # MAINNET_MINTS, DEVNET_MINTS, PYTH_FEEDS, ASSETS_REGISTRY
  asset-helpers.ts    # getAsset, getMint, rawToDisplay, formatBalance, etc
  index.ts
```

## Conventions

- All exports use **named exports** (no defaults).
- Zod schemas are the source of truth — TS types are inferred via `z.infer<...>`.
- Domain modules live in `src/domain/`. Cross-cutting helpers + registry
  en `src/`.
- BigInt fields (`Asset.balance`) accept `bigint | string` para wire-safe
  serialization JSON.

---

## Asset registry

`ASSETS_REGISTRY` es la **única** fuente de verdad para los 9 assets:

| AssetId | Category     | Decimals | Notes                                     |
| ------- | ------------ | -------- | ----------------------------------------- |
| `usd`   | stable_usd   | 6        | Unified: USDC + USDG + PYUSD + USDT       |
| `eur`   | stable_eur   | 6        | EURC (Circle)                             |
| `cop`   | stable_local | 6        | wCOPm bridged Celo (mainnet only)         |
| `mxn`   | stable_local | 6        | wMXNB bridged Arbitrum                    |
| `brl`   | stable_local | 4        | BRZ (Transfero)                           |
| `ars`   | stable_local | 6        | wARST bridged Tron                        |
| `sol`   | volatile     | 9        | Native SOL                                |
| `btc`   | volatile     | 8        | zBTC (Zeus Network)                       |
| `eth`   | volatile     | 8        | wETH (Wormhole) — **NO 18, es 8 wrapped** |

### Cómo agregar un asset

1. Add `AssetId` literal en `domain/asset.ts > AssetIdSchema`.
2. Verificar mint en **3 fuentes** antes de hardcodear:
   - Solscan: confirm symbol + decimals + total supply.
   - Project docs oficiales (Paxos, Zeus, Circle, etc).
   - Jupiter token list (`https://token.jup.ag/all`).
3. Add a `MAINNET_MINTS` y `DEVNET_MINTS` (si aplica).
4. Add Pyth feed ID a `PYTH_FEEDS` (si volatile).
5. Add `AssetMeta` entry a `ASSETS_REGISTRY` con todos los fields.
6. Add icon path en mobile `AssetIcon` ICON_MAP cuando esté la PNG.

### Mint verification protocol

Wrong mint = funds lost. **Triple-check** required:

```bash
# 1. Solscan — confirm metadata
open "https://solscan.io/token/<mint>"

# 2. Jupiter — confirm está listado
curl -s https://token.jup.ag/all | jq '.[] | select(.address == "<mint>")'

# 3. Project docs — paste link en commit message
```

Mints marcados con `PLACEHOLDER_*_VERIFY_BEFORE_MAINNET` **no se pueden
desplegar a mainnet** hasta verificación. El registry los incluye solo
para que el shape esté completo y los flujos compilen pre-launch.

---

## Helpers

```ts
import {
  getAsset,
  getMint,
  rawToDisplay,
  displayToRaw,
  formatBalance,
  getEnabledAssets,
  getAssetIdByMint,
  isAssetId,
} from "@moneto/types";

// Resolve metadata
const meta = getAsset("usd");
// meta.decimals === 6
// meta.symbol === "USD"

// Resolve mint para swap
const mint = getMint("usd"); // → USDC primary
const yieldMint = getMint("usd", { yieldBearing: true }); // → USDG / PYUSD

// Convert chain ↔ display
rawToDisplay(1_000_000n, "usd"); // 1.0
displayToRaw(1.5, "usd"); // 1500000n

// Format
formatBalance(1234.56, "usd"); // "1,234.56"
formatBalance(0.042, "btc"); // "0.04200000"
formatBalance(45000, "cop"); // "45.000"

// Network filtering
getEnabledAssets("devnet"); // → [usd, sol] (only ones with devnet mints)

// Reverse lookup (parsing on-chain data)
getAssetIdByMint("EPjFWdd5..."); // → "usd"
```

---

## Decimals heuristic — crítico

| Asset                         | Decimals | Nota                            |
| ----------------------------- | -------- | ------------------------------- |
| USDC, USDT, PYUSD, USDG, EURC | 6        | Stable standard                 |
| BRZ                           | 4        | **Excepción** — Transfero usa 4 |
| BTC (zBTC)                    | 8        | Industria standard              |
| ETH (wETH on Solana)          | 8        | **NO es 18** como ETH native    |
| SOL                           | 9        | Native lamports                 |

`displayToRaw(1.5, "usd")` con decimals 6 = `1500000n`. Wrong decimals
= factor 100x / 1000x discrepancia → tx ejecuta con amount mal y user
pierde funds.

**SIEMPRE** pasar via `rawToDisplay` / `displayToRaw` — nunca calcular
decimals manualmente.

---

## Network gating

```ts
const enabled = getEnabledAssets(currentNetwork);
```

User en devnet ve solo USD + SOL. El wallet NO acepta operaciones
contra assets disabled — el balance fetcher las retorna como 0 + UI
esconde la row.

---

## API/wire serialization

`Asset.balance` es `bigint` — **NO** se serializa nativamente a JSON.
Para HTTP transport:

- API server: convierte bigint a string en response.
- Mobile: el Zod schema accepta `string | bigint` y transforma a bigint.

```ts
// On the wire:
{
  "balance": "1000000000";
}

// Parsed by client:
const asset = AssetSchema.parse(data); // asset.balance is bigint
```

---

## Sentry tagging

Toda operación que toque un asset specific debe tag-ear `asset_id`:

```ts
Sentry.setTag("asset_id", id);
```

Permite filtrar por asset en Sentry dashboard cuando hay incident
("¿BTC swap fallando? Filtra por `asset_id:btc`").

---

## Tests

Sprint 8 con Jest. Mientras tanto, smoke manual:

```ts
// rawToDisplay roundtrip
rawToDisplay(displayToRaw(1.5, "usd"), "usd"); // === 1.5 ✓

// formatBalance per asset
formatBalance(1234.56, "usd"); // "1,234.56"
formatBalance(0.005, "btc"); // "0.00500000"
formatBalance(45000, "cop"); // "45.000" (sin decimales)
```
