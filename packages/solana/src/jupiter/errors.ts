/**
 * Tipos discretos de error que `JupiterSwapService` puede surface al
 * caller. Mapean al matrix de UI copy en
 * `plans/sprint-3-multi-asset-swap/04-jupiter-swap-engine.md`.
 *
 * **Por qué enum**: el caller (mobile UI) puede branch por code en
 * un switch sin tener que parsear el message. Los messages son útiles
 * para Sentry; los codes para UX.
 */
export type SwapErrorCode =
  /** Quote tiene >30s de antigüedad — expiró antes de execute. */
  | "QUOTE_STALE"
  /** Pre-flight simulation falló (slippage, decimals, mint blacklist). */
  | "SIMULATION_FAILED"
  /** User no tiene saldo suficiente del input asset. */
  | "INSUFFICIENT_BALANCE"
  /** Pools no tienen liquidez para el monto requested. */
  | "INSUFFICIENT_LIQUIDITY"
  /** Jupiter API rate limited el request. Auto-retry con backoff. */
  | "RATE_LIMITED"
  /** Tx fue submitted pero no confirmed en el timeout. */
  | "CONFIRMATION_TIMEOUT"
  /** Tx confirmed con `err` (revert / token-2022 logic / etc). */
  | "EXECUTION_FAILED"
  /** Network error intentando llegar a Jupiter / RPC. */
  | "NETWORK_ERROR"
  /** Invalid input — bad mint, amount=0, etc. Bug del caller. */
  | "INVALID_INPUT";

export class SwapError extends Error {
  override readonly name = "SwapError";

  constructor(
    public readonly code: SwapErrorCode,
    message: string,
    /** Detalle opcional para logging — Sentry-safe. */
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
  }

  /** Type guard para chequear `err instanceof SwapError` cross-package. */
  static is(err: unknown): err is SwapError {
    return err instanceof SwapError || (err as { name?: string } | null)?.name === "SwapError";
  }
}
