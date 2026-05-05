/**
 * Solana Pay URL builder. Spec:
 * https://docs.solanapay.com/spec
 *
 * Forma:
 *   solana:<recipient>
 *     ?amount=<numeric>
 *     &spl-token=<mint base58>
 *     &reference=<extra signatures>
 *     &label=<URI-encoded>
 *     &message=<URI-encoded>
 *     &memo=<URI-encoded>
 *
 * No usamos `@solana/pay` (pulla `@solana/web3.js` ~500KB) — el spec es
 * trivial y construirlo a mano da bundle minimal para la landing.
 */

export interface SolanaPayParams {
  /** Pubkey base58 del receptor. */
  recipient: string;
  /** Display amount (decimal-adjusted). undefined → user pega el monto en el wallet. */
  amount?: number;
  /** SPL mint base58. undefined → SOL nativo. */
  splToken?: string;
  /** Label corto que el wallet muestra como sender-facing context. */
  label?: string;
  /** Message más largo (descripción del pago). */
  message?: string;
  /** Memo on-chain. Se incluye en el SPL transfer instruction. */
  memo?: string;
}

/**
 * Construye un Solana Pay URI conformant al spec. Retorna string.
 *
 * @example
 *   buildSolanaPayUrl({
 *     recipient: "AbcDefG...",
 *     amount: 100,
 *     splToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
 *     label: "Pay Maria",
 *     message: "Salario diciembre",
 *   })
 *   // → "solana:AbcDefG...?amount=100&spl-token=EPj...&label=Pay%20Maria&message=Salario%20diciembre"
 */
export function buildSolanaPayUrl(params: SolanaPayParams): string {
  const search = new URLSearchParams();
  if (params.amount !== undefined && Number.isFinite(params.amount) && params.amount > 0) {
    // Spec: el amount va sin notación científica, max 9 decimales (lamports).
    // toFixed(9) y luego strip de zeros trailing para legibilidad.
    const amountStr = params.amount.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
    search.set("amount", amountStr);
  }
  if (params.splToken) search.set("spl-token", params.splToken);
  if (params.label) search.set("label", params.label);
  if (params.message) search.set("message", params.message);
  if (params.memo) search.set("memo", params.memo);

  const query = search.toString();
  return query.length > 0 ? `solana:${params.recipient}?${query}` : `solana:${params.recipient}`;
}

/**
 * USDC mainnet — default token para Moneto payroll links. Mismo valor
 * que `MAINNET_MINTS.USDC` en `@moneto/types`. Lo inlineamos acá para
 * que el bundle web NO importe el package types completo (que pulla
 * el registry entero).
 */
export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
