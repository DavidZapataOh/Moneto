import { createLogger } from "@moneto/utils";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { z } from "zod";

import { useApi, ApiError } from "@/lib/api";
import { capture, Events, getPostHog, bucketAmountUsd } from "@/lib/observability";
import { queryKeys } from "@/lib/query-keys";

const log = createLogger("cashout");

export type CashoutLocalCurrency = "COP" | "MXN" | "BRL" | "ARS" | "EUR" | "USD";
export type CashoutStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface CashoutInput {
  /** USD-equivalent del send. */
  amount_usd: number;
  /** Tasa USD → local frozen al confirm. */
  exchange_rate: number;
  local_currency: CashoutLocalCurrency;
  /** Pre-computed local amount = amount_usd * exchange_rate. */
  amount_local: number;
  /** Display label del destination. */
  destination_label: string;
  destination_account_id?: string;
}

const CashoutResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]),
  estimated_completion_at: z.string().nullable(),
  fee_usd: z.number(),
  estimated_completion_minutes: z.number(),
});

export type CashoutResponse = z.infer<typeof CashoutResponseSchema>;

/**
 * Mutation cashout (Sprint 4.06 stub). Sprint 6 swap-eará el backend
 * a Bold sin tocar este hook.
 *
 * Flow:
 * 1. POST `/api/cashout` con payload validado.
 * 2. invalidate balance (el server descontó el USD).
 * 3. PostHog `send_completed type=cashout` con bucketed amount.
 * 4. Errores: ApiError mapeado a UI copy en el caller.
 */
export function useCashout(): UseMutationResult<CashoutResponse, Error, CashoutInput> {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<CashoutResponse, Error, CashoutInput>({
    mutationFn: async (input) => api.post("/api/cashout", input, { schema: CashoutResponseSchema }),
    onSuccess: (data, vars) => {
      log.info("cashout queued", {
        cashoutId: data.id,
        currency: vars.local_currency,
      });

      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.send_completed, {
          type: "cashout",
          currency: vars.local_currency,
          fee_pct: 0.0075,
          amount_bucket: bucketAmountUsd(vars.amount_usd),
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.balance() });
      queryClient.invalidateQueries({ queryKey: queryKeys.txs() });
    },
    onError: (error, vars) => {
      const code = error instanceof ApiError ? error.code : "unknown";
      log.warn("cashout failed", { code, message: error.message });

      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.send_failed, { type: "cashout", reason: code });
      }
      // Sentry tag context — dejamos en variables para el caller leer.
      void vars;
    },
    retry: false,
  });
}
