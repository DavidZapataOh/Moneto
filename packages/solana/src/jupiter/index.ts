/**
 * Jupiter swap engine — barrel.
 *
 * Sprint 3.04 surface:
 * - `JupiterSwapService` — quote + build + simulate + execute.
 * - `SwapError` — errores tipados con `code: SwapErrorCode`.
 * - `DEFAULT_SLIPPAGE_BPS` — 50 bps (0.5%).
 * - Types: `SwapQuote`, `SwapQuoteParams`, `SignTransactionFn`, etc.
 */

export {
  JupiterSwapService,
  DEFAULT_SLIPPAGE_BPS,
  type JupiterServiceConfig,
  type SwapQuote,
  type SwapQuoteParams,
  type BuildSwapTxOptions,
  type ExecuteSwapOptions,
  type SignTransactionFn,
} from "./swap-service";

export { SwapError, type SwapErrorCode } from "./errors";
