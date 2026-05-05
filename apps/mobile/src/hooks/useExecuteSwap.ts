import { SwapError, type SwapErrorCode, type SwapQuote } from "@moneto/solana/jupiter";
import { type AssetId } from "@moneto/types";
import { createLogger } from "@moneto/utils";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";

import { capture, Events, getPostHog } from "@/lib/observability";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@stores/useAppStore";

import { useSolanaServices } from "./useSolanaServices";

const log = createLogger("swap.execute");

export interface ExecuteSwapInput {
  quote: SwapQuote;
  fromAsset: AssetId;
  toAsset: AssetId;
  slippageBps: number;
}

export interface ExecuteSwapResult {
  signature: string;
  fromAsset: AssetId;
  toAsset: AssetId;
}

/**
 * Mutation hook que orquesta un swap end-to-end:
 *
 * 1. Resuelve el provider del Privy embedded Solana wallet (`getProvider()`).
 * 2. Llama `JupiterSwapService.executeSwap` con un `signTransaction` callback
 *    que delega a `provider.request({ method: "signTransaction" })`.
 * 3. Tras éxito, invalida `balance` + `txs` para refresh automático.
 * 4. Emite `swap_completed` o `swap_failed` (con `error_code`) a PostHog.
 *
 * **Auth requirement**: el user debe estar `authenticated` con wallet ready.
 * Si no, el sign callback throw `SwapError("EXECUTION_FAILED")` antes de
 * tocar fondos.
 *
 * **Errores**: el caller hace `error instanceof SwapError` (o `SwapError.is`)
 * para mapear `error.code` → UI copy. La matrix vive en
 * `plans/sprint-3-multi-asset-swap/04-jupiter-swap-engine.md`.
 *
 * @example
 *   const { mutate, isPending } = useExecuteSwap();
 *   mutate(
 *     { quote, fromAsset: "usd", toAsset: "cop", slippageBps: 50 },
 *     {
 *       onSuccess: ({ signature }) => router.replace({ ... }),
 *       onError: (err) => alertFromCode(err),
 *     },
 *   );
 */
export function useExecuteSwap(): UseMutationResult<ExecuteSwapResult, Error, ExecuteSwapInput> {
  const { jupiter } = useSolanaServices();
  const queryClient = useQueryClient();
  const wallets = useEmbeddedSolanaWallet();
  const walletAddress = useAppStore((s) =>
    s.authState.status === "authenticated" ? s.authState.walletAddress : null,
  );

  const sign = useCallback(
    async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      const provider = await resolvePrivySolanaProvider(wallets);
      if (!provider) {
        throw new SwapError("EXECUTION_FAILED", "wallet_provider_unavailable");
      }
      const result = await provider.request({
        method: "signTransaction",
        params: { transaction: tx },
      });
      // Privy expone `signedTransaction` tipado al input — pero el shape
      // del provider en runtime es generic, así que defensiveamente
      // refinamos. Si el provider devolviera un Transaction legacy, lo
      // mismo seguiría siendo compatible (Connection.sendRawTransaction
      // acepta ambos), pero JupiterSwapService asume VersionedTransaction.
      const signed = (result as { signedTransaction?: VersionedTransaction | Transaction })
        .signedTransaction;
      if (!signed) {
        throw new SwapError("EXECUTION_FAILED", "sign_returned_no_transaction");
      }
      return signed as VersionedTransaction;
    },
    [wallets],
  );

  return useMutation<ExecuteSwapResult, Error, ExecuteSwapInput>({
    mutationFn: async ({ quote, fromAsset, toAsset }) => {
      if (!walletAddress) {
        throw new SwapError("EXECUTION_FAILED", "wallet_not_ready");
      }
      const userPubkey = new PublicKey(walletAddress);
      const { signature } = await jupiter.executeSwap(quote, userPubkey, sign);
      return { signature, fromAsset, toAsset };
    },
    onSuccess: ({ signature, fromAsset, toAsset }, variables) => {
      log.info("swap completed", {
        signature: signature.slice(0, 12),
        from: fromAsset,
        to: toAsset,
      });

      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.swap_completed, {
          from_asset: fromAsset,
          to_asset: toAsset,
          slippage_bps: variables.slippageBps,
          amount_bucket: bucketSwapAmount(variables.quote, fromAsset),
          hops: variables.quote.routeNumHops,
        });
      }

      // Refresh balance + txs en background — quote completed mueve $.
      queryClient.invalidateQueries({ queryKey: queryKeys.balance() });
      queryClient.invalidateQueries({ queryKey: queryKeys.txs() });
    },
    onError: (error, variables) => {
      const code: SwapErrorCode = SwapError.is(error) ? error.code : "EXECUTION_FAILED";
      log.warn("swap failed", { code, message: error.message });

      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.swap_failed, {
          input: variables.fromAsset,
          output: variables.toAsset,
          error_code: code,
        });
      }
    },
    // No retry — un swap es un side-effect crítico y la mayoría de
    // errores (insufficient liquidity, sign cancelled, simulate failed)
    // no son retry-able. El user reintenta manualmente.
    retry: false,
  });
}

/**
 * Bucket aproximado del input amount para el evento PostHog. Usamos el
 * USD-equivalente raw del quote (input / 10^decimals * spotPriceUsd no
 * está disponible aquí — usamos category-based bucketing simple por
 * decimals para no leakear amounts exactos). Para el dashboard de fondo
 * el `amount_bucket` solo necesita resolución coarse.
 */
function bucketSwapAmount(
  quote: SwapQuote,
  _fromAsset: AssetId,
): "<10" | "10-50" | "50-200" | "200-1000" | ">1000" {
  // El raw input ya viene en native units; convertimos lossless a number
  // para los thresholds. Evita importar bucketAmountUsd que requiere
  // USD spot price.
  const raw = Number(quote.inputAmount);
  if (raw <= 10_000) return "<10"; // 6-decimals USDC ≤ $10
  if (raw <= 50_000) return "10-50";
  if (raw <= 200_000) return "50-200";
  if (raw <= 1_000_000) return "200-1000";
  return ">1000";
}

/**
 * Privy expone el wallet provider via `wallets.getProvider()` cuando el
 * status es `connected`. Su shape varía por SDK version y estado del
 * wallet, así que validamos por duck-typing — coherente con el approach
 * de `usePrivyAuthSync.extractFirstSolanaAddress`.
 */
interface PrivySolanaWalletShape {
  status: string;
  wallets?: Array<{ getProvider?: () => Promise<PrivySolanaProvider> }>;
}

interface PrivySolanaProvider {
  request: (req: {
    method: "signTransaction";
    params: { transaction: VersionedTransaction };
  }) => Promise<{ signedTransaction: VersionedTransaction }>;
}

async function resolvePrivySolanaProvider(wallets: unknown): Promise<PrivySolanaProvider | null> {
  const w = wallets as PrivySolanaWalletShape | null;
  if (!w || w.status !== "connected") return null;
  const list = w.wallets;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!first || typeof first.getProvider !== "function") return null;
  try {
    return await first.getProvider();
  } catch (err) {
    log.warn("getProvider threw", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
