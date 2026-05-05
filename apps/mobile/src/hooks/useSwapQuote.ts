import { SwapError, type SwapQuote } from "@moneto/solana/jupiter";
import { displayToRaw, getMint, type AssetId } from "@moneto/types";
import { PublicKey } from "@solana/web3.js";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { capture, Events, getPostHog } from "@/lib/observability";

import { useDebouncedValue } from "./useDebouncedValue";
import { useSolanaServices } from "./useSolanaServices";

export interface SwapQuoteParams {
  /** Asset que el user envía. Null mientras el user no eligió. */
  inputAsset: AssetId | null;
  /** Asset que el user recibe. Null mientras el user no eligió. */
  outputAsset: AssetId | null;
  /** Amount como string del input controlled (mantiene leading zeros, decimales). */
  amount: string;
  /** Slippage tolerance en bps. Default 50 (0.5%) — viene de UI selector. */
  slippageBps: number;
}

/**
 * Subscribes a un quote dinámico. Re-fetch cada 25s (renueva antes
 * que Jupiter declare quote stale a los 30s) y cuando cualquier param
 * cambie. El amount es debounced 300ms para evitar query spam mientras
 * el user tipea.
 *
 * Auto-disable cuando faltan params (input/output null, amount vacío,
 * o amount inválido).
 *
 * Eventos emitidos:
 * - `swap_quote_requested` — cada quote disparado (post-debounce).
 * Sprint 3.06 wirea `swap_executed`/`swap_failed` en el mutation hook.
 *
 * @example
 *   const quote = useSwapQuote({
 *     inputAsset: "usd",
 *     outputAsset: "cop",
 *     amount: "100",
 *     slippageBps: 50,
 *   });
 *   if (quote.isPending) return <QuoteSkeleton />;
 *   if (quote.error) return <QuoteError err={quote.error} />;
 *   if (quote.data) return <QuotePreview quote={quote.data} />;
 */
export function useSwapQuote(params: SwapQuoteParams): UseQueryResult<SwapQuote | null, Error> {
  const { jupiter } = useSolanaServices();
  const debouncedAmount = useDebouncedValue(params.amount, 300);

  const enabled =
    !!params.inputAsset &&
    !!params.outputAsset &&
    params.inputAsset !== params.outputAsset &&
    isValidAmount(debouncedAmount);

  return useQuery<SwapQuote | null, Error>({
    queryKey: [
      "swap-quote",
      params.inputAsset,
      params.outputAsset,
      debouncedAmount,
      params.slippageBps,
    ],
    queryFn: async () => {
      if (!params.inputAsset || !params.outputAsset) return null;

      const inputMint = new PublicKey(getMint(params.inputAsset));
      const outputMint = new PublicKey(getMint(params.outputAsset));
      const amountRaw = displayToRaw(parseFloat(debouncedAmount), params.inputAsset);

      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.swap_quote_requested, {
          input: params.inputAsset,
          output: params.outputAsset,
          slippage_bps: params.slippageBps,
        });
      }

      return jupiter.getQuote({
        inputMint,
        outputMint,
        amount: amountRaw,
        slippageBps: params.slippageBps,
      });
    },
    enabled,
    // staleTime ligeramente menor a `refetchInterval` para que el cache
    // siempre quede fresh — evita que `useQuery` retorne stale entre
    // refetches.
    staleTime: 20_000,
    refetchInterval: 25_000,
    retry: (failureCount, error) => {
      if (SwapError.is(error)) {
        // Rate limited → permitimos hasta 2 retries con backoff.
        if (error.code === "RATE_LIMITED") return failureCount < 2;
        // Liquidez insuficiente / invalid input → no retry, es bug user
        // o realidad de mercado. Mostrar error inmediato.
        if (error.code === "INSUFFICIENT_LIQUIDITY" || error.code === "INVALID_INPUT") {
          return false;
        }
      }
      return failureCount < 1;
    },
  });
}

function isValidAmount(s: string): boolean {
  if (!s || s === "0" || s === "0." || s === ".") return false;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0;
}
