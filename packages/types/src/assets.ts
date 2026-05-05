/**
 * Moneto assets registry — fuente de verdad estática para los 9 assets
 * soportados. Cambia solo via deploy.
 *
 * **Verificación de mints**: cualquier add/edit a `MAINNET_MINTS`
 * requiere triple cross-reference:
 *
 * 1. Solscan (https://solscan.io/token/<mint>) — confirma symbol +
 *    decimals + total supply hace sentido.
 * 2. Project docs oficiales (Paxos USDG, Zeus zBTC, etc).
 * 3. Jupiter token list (https://token.jup.ag/all) — el SDK lo lista.
 *
 * Mints marcados con `// TODO mint:` son placeholders que **no se
 * pueden usar en producción** hasta verificación. El registry los
 * incluye para que el shape esté completo y los flujos compilen.
 *
 * Devnet tiene su propio set de mints (USDC devnet, etc.) — separado
 * en `DEVNET_MINTS`.
 */

import type { AssetId, AssetMeta } from "./domain/asset";

// ─────────────────────────────────────────────────────────────────────
// Mints — mainnet-beta
// ─────────────────────────────────────────────────────────────────────

/**
 * Mainnet SPL mint pubkeys. Verified ✓ vs placeholder TODO.
 * Tagged con la fuente cuando aplica.
 */
export const MAINNET_MINTS = {
  // ✓ USDC — Circle official, Jupiter listed
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  // ✓ USDT — Tether official, Jupiter listed
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  // ✓ PYUSD — PayPal official (yield via Reflect/sUSD)
  PYUSD: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  // TODO mint: USDG (Paxos) — verificar en hackathon week. Jupiter aún
  // no lo listaba al momento del Sprint 0; Reflect liquid-stakes USDC
  // a USDG. Mientras tanto el primary del USD asset es USDC.
  USDG: "PLACEHOLDER_USDG_VERIFY_BEFORE_MAINNET",

  // ✓ EURC — Circle EUR, Jupiter listed
  EURC: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",

  // ✓ BRZ — Transfero BRZ, Jupiter listed
  // eslint-disable-next-line no-secrets/no-secrets -- SPL mint pubkey, public on-chain
  BRZ: "FtgGSFADXBtroxq8VCausXRr2of47QBf5AS1NtZCu4GD",

  // TODO mint: COPm wrapped — confirmar bridge (probable Wormhole desde
  // Celo o Avalanche). Sin esto, COP cashout es manual via Bold.
  WCOPM: "PLACEHOLDER_WCOPM_VERIFY_BEFORE_MAINNET",
  // TODO mint: MXNB wrapped — Bitso MXN bridged. Sprint 6+.
  WMXNB: "PLACEHOLDER_WMXNB_VERIFY_BEFORE_MAINNET",
  // TODO mint: ARST wrapped — Argentine peso stable. Numix protocol.
  WARST: "PLACEHOLDER_WARST_VERIFY_BEFORE_MAINNET",

  // ✓ Native SOL (wrapped) — System default
  NATIVE_SOL: "So11111111111111111111111111111111111111112",

  // TODO mint: zBTC (Zeus Network) — confirmar el mint real en producción.
  // Zeus zBTC es bridged Bitcoin a Solana via Zeus Programmable BTC.
  ZBTC: "PLACEHOLDER_ZBTC_VERIFY_BEFORE_MAINNET",

  // ✓ wETH (Wormhole) — Solana ETH wrapped via Wormhole
  WETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
} as const;

/**
 * Devnet mints. La mayoría de assets no tienen devnet equivalent;
 * los comentamos según corresponda. Mock data en mobile usa estos.
 */
export const DEVNET_MINTS = {
  // USDC devnet faucet — Circle dev
  // eslint-disable-next-line no-secrets/no-secrets -- SPL mint pubkey, public on-chain
  USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  // USDT devnet — placeholder, no oficial Tether testnet
  USDT: "PLACEHOLDER_USDT_DEVNET",
  // SOL devnet — same address as mainnet
  NATIVE_SOL: "So11111111111111111111111111111111111111112",
} as const;

// ─────────────────────────────────────────────────────────────────────
// Pyth price feed IDs (mainnet)
// ─────────────────────────────────────────────────────────────────────

/**
 * Pyth Network feed IDs (Hermes API). Format: 32-byte hex string,
 * obtenido de https://pyth.network/developers/price-feed-ids.
 *
 * Used para volátiles (SOL/BTC/ETH). Stables se asumen 1.0 USD para
 * cálculos de balanceUsd.
 */
export const PYTH_FEEDS = {
  /** SOL/USD — Pyth */
  SOL_USD: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  /** BTC/USD — Pyth */
  BTC_USD: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  /** ETH/USD — Pyth */
  ETH_USD: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
} as const;

// ─────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────

export const ASSETS_REGISTRY: Record<AssetId, AssetMeta> = {
  usd: {
    id: "usd",
    symbol: "USD",
    name: "Dólar",
    nameLong: "Dólar estadounidense",
    category: "stable_usd",
    decimals: 6,
    // USDC primary mientras USDG no esté verificado en mainnet.
    // Sprint 6 cuando wireemos Reflect, switch a USDG primary +
    // yieldBearing. PYUSD también yieldBearing (Reflect).
    underlyingMints: [
      { mint: MAINNET_MINTS.USDC, weight: 1, isPrimary: true },
      { mint: MAINNET_MINTS.USDG, weight: 1, yieldBearing: true },
      { mint: MAINNET_MINTS.PYUSD, weight: 1, yieldBearing: true },
      { mint: MAINNET_MINTS.USDT, weight: 1 },
    ],
    iconType: "flag",
    iconAsset: "flags/us.png",
    apySource: "reflect-usdg",
    defaultApy: 0.062,
    enabledOn: ["mainnet-beta", "devnet"],
    pinnedInUI: true,
  },
  eur: {
    id: "eur",
    symbol: "EUR",
    name: "Euro",
    nameLong: "Euro",
    category: "stable_eur",
    decimals: 6,
    underlyingMints: [{ mint: MAINNET_MINTS.EURC, weight: 1, isPrimary: true }],
    iconType: "flag",
    iconAsset: "flags/eu.png",
    defaultApy: 0.038,
    enabledOn: ["mainnet-beta"],
  },
  cop: {
    id: "cop",
    symbol: "COPm",
    name: "Peso colombiano",
    nameLong: "Peso colombiano (stable)",
    category: "stable_local",
    decimals: 6,
    underlyingMints: [
      { mint: MAINNET_MINTS.WCOPM, weight: 1, isPrimary: true, bridgeFrom: "celo" },
    ],
    iconType: "flag",
    iconAsset: "flags/co.png",
    apySource: "moneto-pool",
    defaultApy: 0.051,
    enabledOn: ["mainnet-beta"],
  },
  mxn: {
    id: "mxn",
    symbol: "MXNB",
    name: "Peso mexicano",
    nameLong: "Peso mexicano (Bitso MXNB)",
    category: "stable_local",
    decimals: 6,
    underlyingMints: [
      { mint: MAINNET_MINTS.WMXNB, weight: 1, isPrimary: true, bridgeFrom: "arbitrum" },
    ],
    iconType: "flag",
    iconAsset: "flags/mx.png",
    apySource: "moneto-pool",
    defaultApy: 0.048,
    enabledOn: ["mainnet-beta"],
  },
  brl: {
    id: "brl",
    symbol: "BRZ",
    name: "Real brasileño",
    nameLong: "Real brasileño (Transfero BRZ)",
    category: "stable_local",
    decimals: 4,
    underlyingMints: [{ mint: MAINNET_MINTS.BRZ, weight: 1, isPrimary: true }],
    iconType: "flag",
    iconAsset: "flags/br.png",
    apySource: "moneto-pool",
    defaultApy: 0.057,
    enabledOn: ["mainnet-beta"],
  },
  ars: {
    id: "ars",
    symbol: "ARST",
    name: "Peso argentino",
    nameLong: "Peso argentino (Numix ARST)",
    category: "stable_local",
    decimals: 6,
    underlyingMints: [
      { mint: MAINNET_MINTS.WARST, weight: 1, isPrimary: true, bridgeFrom: "tron" },
    ],
    iconType: "flag",
    iconAsset: "flags/ar.png",
    apySource: "moneto-pool",
    defaultApy: 0.072,
    enabledOn: ["mainnet-beta"],
  },
  sol: {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    nameLong: "Solana",
    category: "volatile",
    decimals: 9,
    underlyingMints: [{ mint: MAINNET_MINTS.NATIVE_SOL, weight: 1, isPrimary: true }],
    iconType: "logo",
    iconAsset: "crypto/sol.png",
    pythPriceFeedId: PYTH_FEEDS.SOL_USD,
    enabledOn: ["mainnet-beta", "devnet"],
  },
  btc: {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    nameLong: "Bitcoin (zBTC vía Zeus Network)",
    category: "volatile",
    decimals: 8,
    underlyingMints: [
      { mint: MAINNET_MINTS.ZBTC, weight: 1, isPrimary: true, bridgeFrom: "bitcoin-zeus" },
    ],
    iconType: "logo",
    iconAsset: "crypto/btc.png",
    pythPriceFeedId: PYTH_FEEDS.BTC_USD,
    // Devnet: Zeus aún no soporta — UI muestra mock balance.
    enabledOn: ["mainnet-beta"],
  },
  eth: {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    nameLong: "Ethereum (wETH vía Wormhole)",
    category: "volatile",
    // wETH on Solana = 8 decimals (NO 18 como ETH native).
    decimals: 8,
    underlyingMints: [
      { mint: MAINNET_MINTS.WETH, weight: 1, isPrimary: true, bridgeFrom: "ethereum-wormhole" },
    ],
    iconType: "logo",
    iconAsset: "crypto/eth.png",
    pythPriceFeedId: PYTH_FEEDS.ETH_USD,
    enabledOn: ["mainnet-beta"],
  },
};
