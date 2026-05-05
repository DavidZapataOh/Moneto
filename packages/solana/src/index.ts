/**
 * @moneto/solana — Solana helpers, Jupiter integration, Squads, Umbra.
 *
 * Surface por sprint:
 * - Sprint 3.04 ✅: Jupiter swap engine (`./jupiter`).
 * - Sprint 5: Umbra wrapper, Token-2022 Confidential Balances.
 * - Sprint 7: Squads vault service.
 *
 * Package no React, no platform-specific — consumed por mobile (Expo)
 * y server (Workers / Deno) cuando aplique.
 */

export const SOLANA_PACKAGE_VERSION = "0.1.0-sprint-3.04";

export * from "./jupiter";
