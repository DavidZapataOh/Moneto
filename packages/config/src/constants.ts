/**
 * Cross-app constants. Network-specific overrides happen via env, not here.
 */

export const APP_NAME = "Moneto";
export const APP_BUNDLE_ID = "xyz.moneto.app";
export const APP_SCHEME = "moneto";

export const SUPPORT_EMAIL = "support@moneto.xyz";
export const PRIVACY_EMAIL = "privacy@moneto.xyz";
export const LEGAL_EMAIL = "legal@moneto.xyz";

/** Solana mainnet stablecoin mints. Devnet uses different addresses (resolved at runtime). */
export const MAINNET_MINTS = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  PYUSD: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  EURC: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
  WETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  NATIVE_SOL: "So11111111111111111111111111111111111111112",
} as const;

/** Pyth price feed IDs (mainnet). */
export const PYTH_FEEDS = {
  SOL_USD: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC_USD: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH_USD: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
} as const;

/** KYC tier limits (USD/month). Sprint 1.04 enforces these server-side. */
export const KYC_LIMITS_USD = {
  0: { lifetime: 200, monthly: 0 },
  1: { lifetime: Infinity, monthly: 2_000 },
  2: { lifetime: Infinity, monthly: 10_000 },
  3: { lifetime: Infinity, monthly: Infinity },
} as const;

/** Biometric thresholds (USD). Sprint 7.08 enforces. */
export const BIOMETRIC_THRESHOLDS_USD = {
  P2P_REQUIRED_AT: 100,
  CARD_LIMIT_RAISE_COOLDOWN_HOURS: 24,
} as const;

/** Privacy / recovery timing. */
export const RECOVERY_DELAY_HOURS = 48;
export const RECOVERY_NOTIFICATION_HOURS = [12, 24, 36, 47] as const;
export const VIEWING_KEY_DEFAULT_TTL_DAYS = 30;
export const MAX_ACTIVE_VIEWING_KEYS_PER_USER = 10;
