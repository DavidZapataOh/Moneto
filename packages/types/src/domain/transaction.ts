import { z } from "zod";

import { AssetIdSchema } from "./asset";

/**
 * Transaction types tracked by Moneto.
 *
 * - `payroll`: incoming USD from external payroll source (web landing).
 * - `p2p_in` / `p2p_out`: private P2P between Moneto users (shielded via Umbra).
 * - `swap`: asset conversion via Jupiter.
 * - `qr_pay`: payment via QR scan (Bold Colombia, Solana Pay).
 * - `card_spend`: Visa card transaction settled via Rain.
 * - `cashout`: off-ramp to user's bank account.
 * - `yield_accrual`: periodic yield distribution from Reflect/Huma vaults.
 */
export const TxTypeSchema = z.enum([
  "payroll",
  "p2p_in",
  "p2p_out",
  "swap",
  "qr_pay",
  "card_spend",
  "cashout",
  "yield_accrual",
]);
export type TxType = z.infer<typeof TxTypeSchema>;

export const TxStatusSchema = z.enum(["pending", "completed", "failed"]);
export type TxStatus = z.infer<typeof TxStatusSchema>;

/**
 * Decrypted transaction representation as shown in the mobile UI.
 * Decrypted client-side using the user's viewing key (Sprint 5).
 *
 * `amount` is positive for incoming, negative for outgoing.
 * `timestamp` is unix ms.
 */
export const TransactionSchema = z.object({
  id: z.string(), // signature
  type: TxTypeSchema,
  amount: z.number(),
  currency: AssetIdSchema,
  description: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyHandle: z.string().optional(),
  counterpartyAddress: z.string().optional(),
  timestamp: z.number().int().nonnegative(),
  status: TxStatusSchema,
});
export type Transaction = z.infer<typeof TransactionSchema>;
