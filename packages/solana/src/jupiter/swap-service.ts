import { createJupiterApiClient, type QuoteResponse, type SwapApi } from "@jup-ag/api";
import {
  type Connection,
  type PublicKey,
  VersionedTransaction,
  type SignatureStatus,
} from "@solana/web3.js";

import { SwapError } from "./errors";

/**
 * Jupiter Quote API base. V6 es el endpoint canónico actual; cuando V7
 * estabilice (Sprint 8+), swap-eable acá sin tocar callers.
 */
const DEFAULT_JUPITER_BASE = "https://quote-api.jup.ag/v6";

/**
 * Quote freshness — Jupiter quotes son válidos típicamente 30s antes
 * que el routing pierda accuracy (pools shift). Antes de ejecutar
 * verificamos esta edad para fail-fast con `QUOTE_STALE`.
 */
const QUOTE_FRESHNESS_MS = 30_000;

/**
 * Default slippage para swaps Moneto: 0.5% (50 bps). UI permite override
 * 0.25% / 0.5% / 1% / 3%. Sprint 3.06 wirea el selector.
 */
export const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * Polling para confirm. Cada 1s — más agresivo es overkill (block time
 * Solana ~400ms, pero confirmation status updates ~1s). Total timeout
 * default 60s.
 */
const CONFIRM_POLL_INTERVAL_MS = 1_000;
const CONFIRM_DEFAULT_TIMEOUT_MS = 60_000;

export interface JupiterServiceConfig {
  /** Solana Connection — apunta al RPC del environment (Helius dedicated). */
  connection: Connection;
  /** Override del base URL de Jupiter — default V6 mainnet. */
  jupiterBasePath?: string;
}

export interface SwapQuoteParams {
  /** SPL mint pubkey del input. */
  inputMint: PublicKey;
  /** SPL mint pubkey del output. */
  outputMint: PublicKey;
  /** Cantidad a tradear, en raw decimals del input mint. */
  amount: bigint;
  /** Slippage tolerance en bps (50 = 0.5%). Default 50. */
  slippageBps?: number;
  /** "ExactIn" (default) o "ExactOut". */
  swapMode?: "ExactIn" | "ExactOut";
  /** Fuerza ruta directa (sin multi-hop). Default false. */
  onlyDirectRoutes?: boolean;
  /** Lista de DEXes a excluir del routing (e.g., low-trust venues). */
  excludeDexes?: string[];
}

export interface SwapQuote {
  /** Quote raw de Jupiter — pasada como-es a `swapPost`. */
  raw: QuoteResponse;
  /** Cantidad input raw (input decimals). */
  inputAmount: bigint;
  /** Cantidad output raw expected. */
  outputAmount: bigint;
  /** Cantidad output mínima post-slippage (peor caso aceptable). */
  outputAmountMin: bigint;
  /** Price impact decimal (`0.012` = 1.2%). */
  priceImpactPct: number;
  /** Hops del route plan. 1 = directo. */
  routeNumHops: number;
  /** Estimado de fees agregadas (raw input units). */
  estimatedFee: bigint;
  /** Epoch ms cuando se fetched — para freshness check. */
  fetchedAt: number;
}

export interface BuildSwapTxOptions {
  /** Si true, intenta JITO bundles (MEV mitigation). Sprint 8+. */
  useJito?: boolean;
  /** Priority fee max lamports (CU price). Auto-derived si null. */
  priorityFeeLamports?: number;
}

export interface ExecuteSwapOptions extends BuildSwapTxOptions {
  /** Override del confirmation timeout. Default 60s. */
  confirmTimeoutMs?: number;
}

/**
 * Sign callback inyectado por el caller — Privy embedded wallet en
 * mobile, wallet adapter en futuro web app. Recibe la VersionedTransaction
 * builda y debe retornarla firmada.
 */
export type SignTransactionFn = (tx: VersionedTransaction) => Promise<VersionedTransaction>;

/**
 * Servicio de swaps construido sobre Jupiter Aggregator. Encapsula:
 *
 * 1. **Quote** — `getQuote()` consulta Jupiter v6 quote endpoint con
 *    routing automático multi-hop.
 * 2. **Build** — `buildSwapTransaction()` materializa la quote en una
 *    `VersionedTransaction` lista para firmar (lookup tables incluidas).
 * 3. **Simulate** — `simulateSwap()` corre pre-flight contra RPC para
 *    catch errors antes de pedir signature al user.
 * 4. **Execute** — `executeSwap()` orquestra: freshness check → build →
 *    simulate → sign (delegado al caller) → send → confirm.
 *
 * **Ningún state interno** — la clase es pure functional, fácil de
 * testear y safe para singleton compartido.
 */
export class JupiterSwapService {
  private readonly api: SwapApi;
  private readonly connection: Connection;

  constructor(config: JupiterServiceConfig) {
    this.connection = config.connection;
    this.api = createJupiterApiClient({
      basePath: config.jupiterBasePath ?? DEFAULT_JUPITER_BASE,
    });
  }

  /**
   * Fetch quote para un swap. NO hace network calls a la blockchain —
   * Jupiter API resuelve el routing off-chain. Latency típica <500ms.
   */
  async getQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    if (params.amount <= 0n) {
      throw new SwapError("INVALID_INPUT", "amount must be > 0");
    }

    const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

    let quote: QuoteResponse;
    try {
      quote = await this.api.quoteGet({
        inputMint: params.inputMint.toBase58(),
        outputMint: params.outputMint.toBase58(),
        amount: Number(params.amount),
        slippageBps,
        swapMode: params.swapMode ?? "ExactIn",
        onlyDirectRoutes: params.onlyDirectRoutes ?? false,
        ...(params.excludeDexes && params.excludeDexes.length > 0
          ? { excludeDexes: params.excludeDexes }
          : {}),
      });
    } catch (err) {
      throw classifyJupiterError(err);
    }

    if (!quote.routePlan || quote.routePlan.length === 0) {
      throw new SwapError("INSUFFICIENT_LIQUIDITY", "no route found", {
        inputMint: params.inputMint.toBase58(),
        outputMint: params.outputMint.toBase58(),
      });
    }

    const priceImpactPct = parseFloat(quote.priceImpactPct);

    return {
      raw: quote,
      inputAmount: BigInt(quote.inAmount),
      outputAmount: BigInt(quote.outAmount),
      outputAmountMin: BigInt(quote.otherAmountThreshold),
      priceImpactPct: Number.isFinite(priceImpactPct) ? priceImpactPct : 0,
      routeNumHops: quote.routePlan.length,
      estimatedFee: estimateFeeFromRoute(quote),
      fetchedAt: Date.now(),
    };
  }

  /**
   * Materializa la quote en una `VersionedTransaction`. Jupiter incluye
   * lookup tables y compute unit settings óptimos. La tx aún NO está
   * firmada — el caller la pasa al wallet después.
   */
  async buildSwapTransaction(
    quote: SwapQuote,
    userPubkey: PublicKey,
    options: BuildSwapTxOptions = {},
  ): Promise<VersionedTransaction> {
    try {
      const swap = await this.api.swapPost({
        swapRequest: {
          quoteResponse: quote.raw,
          userPublicKey: userPubkey.toBase58(),
          wrapAndUnwrapSol: true,
          // `useSharedAccounts: true` es default Jupiter — reusa accounts
          // entre users para reduced rent overhead. Para Sprint 5+
          // (Token-2022 + confidential balances) revisamos.
          useSharedAccounts: true,
          dynamicComputeUnitLimit: true,
          // Priority fee: si el caller pasa un cap explícito, usamos
          // priorityLevelWithMaxLamports. Sino omitimos el field y
          // Jupiter aplica su "auto" default — el type union no acepta
          // el string literal aunque el doc lo sugiere.
          ...(options.priorityFeeLamports
            ? {
                prioritizationFeeLamports: {
                  priorityLevelWithMaxLamports: {
                    maxLamports: options.priorityFeeLamports,
                    priorityLevel: "high" as const,
                  },
                },
              }
            : {}),
        },
      });

      // Decodificar base64 → bytes → VersionedTransaction. Workers + RN
      // soportan globalThis.atob para base64.
      const buf = base64ToUint8Array(swap.swapTransaction);
      return VersionedTransaction.deserialize(buf);
    } catch (err) {
      if (SwapError.is(err)) throw err;
      throw classifyJupiterError(err);
    }
  }

  /**
   * Pre-flight simulation. NO firma — el RPC simula la tx unsigned
   * (con `sigVerify: false` + `replaceRecentBlockhash: true` defaults).
   *
   * Útil para catch errors temprano: insufficient balance, slippage
   * exceeded, blacklisted mints, etc.
   */
  async simulateSwap(
    quote: SwapQuote,
    userPubkey: PublicKey,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    let tx: VersionedTransaction;
    try {
      tx = await this.buildSwapTransaction(quote, userPubkey);
    } catch (err) {
      const code = SwapError.is(err) ? err.code : "SIMULATION_FAILED";
      return { ok: false, error: code };
    }

    try {
      const sim = await this.connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });
      if (sim.value.err) {
        return { ok: false, error: JSON.stringify(sim.value.err) };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `simulate_threw:${message}` };
    }
  }

  /**
   * Orquesta el flow end-to-end de un swap:
   *
   * 1. Quote freshness check.
   * 2. Build tx.
   * 3. Pre-flight simulate.
   * 4. Sign (delegated callback — Privy embedded wallet).
   * 5. Send raw + skip preflight (ya simulamos).
   * 6. Confirm con polling cada 1s, default timeout 60s.
   *
   * Cualquier paso failing throw `SwapError` con code apropiado para
   * que el caller mapee a UI copy.
   */
  async executeSwap(
    quote: SwapQuote,
    userPubkey: PublicKey,
    sign: SignTransactionFn,
    options: ExecuteSwapOptions = {},
  ): Promise<{ signature: string }> {
    if (Date.now() - quote.fetchedAt > QUOTE_FRESHNESS_MS) {
      throw new SwapError("QUOTE_STALE", "quote expired");
    }

    const tx = await this.buildSwapTransaction(quote, userPubkey, options);

    const sim = await this.simulateSwap(quote, userPubkey);
    if (!sim.ok) {
      throw new SwapError("SIMULATION_FAILED", sim.error);
    }

    let signed: VersionedTransaction;
    try {
      signed = await sign(tx);
    } catch (err) {
      // Cancelación del user en el wallet sheet, biometric fail, etc.
      // Mantenemos el detail original para Sentry.
      throw new SwapError("EXECUTION_FAILED", "user_sign_failed", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    let signature: string;
    try {
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true, // ya simulamos arriba
        maxRetries: 3,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SwapError("EXECUTION_FAILED", "send_failed", { error: message });
    }

    const confirmation = await this.confirmTransaction(
      signature,
      options.confirmTimeoutMs ?? CONFIRM_DEFAULT_TIMEOUT_MS,
    );
    if (confirmation.err) {
      throw new SwapError("EXECUTION_FAILED", "confirmed_with_error", {
        signature,
        err: confirmation.err,
      });
    }

    return { signature };
  }

  /**
   * Polling de status con timeout. Retorna `{ err }` cuando la tx está
   * confirmed/finalized; throws `CONFIRMATION_TIMEOUT` si el timeout
   * vence sin confirm.
   */
  private async confirmTransaction(
    signature: string,
    timeoutMs: number,
  ): Promise<{ err: SignatureStatus["err"] | null }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.connection
        .getSignatureStatus(signature, { searchTransactionHistory: true })
        .catch(() => null);

      const value = status?.value;
      const conf = value?.confirmationStatus;
      if (conf === "confirmed" || conf === "finalized") {
        return { err: value?.err ?? null };
      }
      await sleep(CONFIRM_POLL_INTERVAL_MS);
    }
    throw new SwapError("CONFIRMATION_TIMEOUT", `not confirmed within ${timeoutMs}ms`, {
      signature,
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function estimateFeeFromRoute(quote: QuoteResponse): bigint {
  // Jupiter v6 expone fees a nivel de QuoteResponse vía `platformFee.amount`
  // (raw input token units). Fees DEX individuales por hop ya quedan
  // reflected en la diferencia inAmount → outAmount, no se suman acá.
  const raw = quote.platformFee?.amount;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      return BigInt(raw);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function base64ToUint8Array(base64: string): Uint8Array {
  // RN tiene atob globalmente (RN 0.74+); Workers también. Si necesitamos
  // soporte Node legacy, agregar fallback Buffer.from acá. Cast a unknown
  // primero porque el tsconfig base no incluye lib `dom`.
  const atobFn = (globalThis as unknown as { atob: (input: string) => string }).atob;
  const binary = atobFn(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function sleep(ms: number): Promise<void> {
  // setTimeout es global tanto en RN como Workers. Cast vía unknown
  // porque tsconfig base no incluye lib `dom` ni `node`.
  const timer = (globalThis as unknown as { setTimeout: (cb: () => void, ms: number) => unknown })
    .setTimeout;
  return new Promise<void>((resolve) => {
    timer(() => resolve(), ms);
  });
}

/**
 * Maps Jupiter API errors a SwapError codes. La librería tira
 * `ResponseError` con status code; mapeamos los más comunes a nuestros
 * codes UX-friendly. Sentry recibe el detail completo.
 */
function classifyJupiterError(err: unknown): SwapError {
  // ResponseError de Jupiter tiene `response.status`.
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === 429) {
    return new SwapError("RATE_LIMITED", "jupiter_429");
  }
  if (status === 400) {
    return new SwapError("INVALID_INPUT", "jupiter_400");
  }
  if (status && status >= 500) {
    return new SwapError("NETWORK_ERROR", `jupiter_${status}`);
  }
  // Network-level failure (no response).
  const msg = err instanceof Error ? err.message : String(err);
  return new SwapError("NETWORK_ERROR", msg);
}
