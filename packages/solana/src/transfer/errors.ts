/**
 * Tipos discretos de error que `SplTransferService` puede surface al
 * caller. Mapean al matrix de UI copy en
 * `plans/sprint-4-receive-send/05-p2p-send-flow.md`.
 *
 * **Por qué enum**: el caller (mobile UI) puede branch por code en
 * un switch sin tener que parsear el message.
 */
export type TransferErrorCode =
  /** Pubkey del destinatario malformada (no base58 32-bytes). */
  | "INVALID_RECIPIENT"
  /** Amount inválido (NaN, ≤0, > balance). */
  | "INVALID_AMOUNT"
  /** Sender no tiene saldo suficiente (incluye fee + ATA rent). */
  | "INSUFFICIENT_BALANCE"
  /** No pudimos crear/derivar la ATA del recipient. */
  | "ATA_DERIVATION_FAILED"
  /** Pre-flight simulation falló (revert, decimal mismatch, etc.). */
  | "SIMULATION_FAILED"
  /** Tx fue submitted pero no confirmed en el timeout. */
  | "CONFIRMATION_TIMEOUT"
  /** Tx confirmed con `err` (token freeze, etc.). */
  | "EXECUTION_FAILED"
  /** Network error intentando llegar al RPC. */
  | "NETWORK_ERROR"
  /** Sender intentó self-send. UI debe block antes pero defensa server-side. */
  | "SELF_SEND";

export class TransferError extends Error {
  override readonly name = "TransferError";

  constructor(
    public readonly code: TransferErrorCode,
    message: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
  }

  /** Type guard cross-package. */
  static is(err: unknown): err is TransferError {
    return (
      err instanceof TransferError || (err as { name?: string } | null)?.name === "TransferError"
    );
  }
}
