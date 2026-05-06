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

export const SOLANA_PACKAGE_VERSION = "0.2.0-sprint-4.05";

// Re-export jupiter desde el root para back-compat con callers
// existentes (Sprint 3.04+). `transfer` se accede solo via subpath
// `@moneto/solana/transfer` para evitar colisión de tipos
// (`SignTransactionFn` existe en ambos módulos con shape idéntico).
export * from "./jupiter";
