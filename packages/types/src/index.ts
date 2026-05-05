/**
 * @moneto/types — shared Zod schemas + TypeScript types.
 *
 * Single source of truth for domain models across mobile, api, and web apps.
 * All types are runtime-validated via Zod schemas.
 */

export * from "./domain/asset";
export * from "./domain/transaction";
export * from "./domain/user";

// Asset registry + helpers — fuente de verdad de mints, decimals,
// metadata visual. Toda app (mobile, api, on-chain orchestrator)
// importa de acá en lugar de hardcodes.
export * from "./assets";
export * from "./asset-helpers";
