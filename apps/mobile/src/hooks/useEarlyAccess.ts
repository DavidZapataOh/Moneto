import { createLogger } from "@moneto/utils";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { z } from "zod";

import { useApi, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@stores/useAppStore";

const log = createLogger("early-access");

/**
 * Slugs whitelisted (espejo del backend `KNOWN_FEATURE_SLUGS`). Cambios
 * acá requieren cambios en `apps/api/src/routes/early-access.ts`.
 */
export type EarlyAccessFeature = "bridge:btc" | "bridge:eth";

const RequestSchema = z.object({
  feature: z.string(),
  first_requested_at: z.string(),
  last_requested_at: z.string(),
});

const ListResponseSchema = z.object({
  requests: z.array(RequestSchema),
});

const PostResponseSchema = RequestSchema;

export type EarlyAccessRequest = z.infer<typeof RequestSchema>;

export interface RequestEarlyAccessInput {
  feature: EarlyAccessFeature;
  /** Provider planeado (ej. "zeus", "wormhole"). Mejora el dashboard de marketing. */
  provider?: string;
}

/**
 * Lista de solicitudes early-access del user. Útil para que la UI sepa
 * si ya solicitó (mostrar "Ya estás en la lista") vs ofrecer la CTA.
 *
 * Cuando el user no está autenticado o el endpoint falla, retorna lista
 * vacía — el banner sigue funcionando (tap → login flow → re-render).
 */
export function useEarlyAccessRequests(): UseQueryResult<EarlyAccessRequest[], Error> {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  return useQuery<EarlyAccessRequest[], Error>({
    queryKey: queryKeys.earlyAccess(),
    queryFn: async ({ signal }) => {
      try {
        const data = await api.get("/api/early-access", {
          schema: ListResponseSchema,
          signal,
        });
        return data.requests;
      } catch (err) {
        // 404 / 401 / network → vacío. El user puede solicitar igual,
        // el POST validará auth.
        if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
          return [];
        }
        throw err;
      }
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000, // 5 min — esto es marketing data, no urgente.
    gcTime: 30 * 60_000,
  });
}

/**
 * Mutation que registra al user en la waitlist. Idempotent — el server
 * usa upsert por (user_id, feature) y bumpa `last_requested_at`. Optimistic
 * update agrega la request al cache local mientras llega la response.
 *
 * @example
 *   const requestAccess = useRequestEarlyAccess();
 *   requestAccess.mutate(
 *     { feature: "bridge:btc", provider: "zeus" },
 *     { onSuccess: () => Alert.alert("Listo", "Te avisamos.") },
 *   );
 */
export function useRequestEarlyAccess(): UseMutationResult<
  EarlyAccessRequest,
  Error,
  RequestEarlyAccessInput
> {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    EarlyAccessRequest,
    Error,
    RequestEarlyAccessInput,
    { previous: EarlyAccessRequest[] | undefined }
  >({
    mutationFn: async ({ feature, provider }) => {
      const body = provider !== undefined ? { feature, provider } : { feature };
      return api.post("/api/early-access", body, { schema: PostResponseSchema });
    },
    onMutate: async ({ feature }) => {
      const key = queryKeys.earlyAccess();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EarlyAccessRequest[]>(key);

      // Patch optimistic — si ya existe, bumpa last_requested_at; sino,
      // append.
      const now = new Date().toISOString();
      const next: EarlyAccessRequest[] = (() => {
        const list = previous ?? [];
        const idx = list.findIndex((r) => r.feature === feature);
        if (idx >= 0) {
          const copy = [...list];
          const existing = copy[idx];
          if (existing) {
            copy[idx] = { ...existing, last_requested_at: now };
          }
          return copy;
        }
        return [...list, { feature, first_requested_at: now, last_requested_at: now }];
      })();
      queryClient.setQueryData<EarlyAccessRequest[]>(key, next);
      return { previous };
    },
    onError: (error, _vars, context) => {
      log.warn("early access request failed", {
        message: error.message,
        code: error instanceof ApiError ? error.code : undefined,
      });
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.earlyAccess(), context.previous);
      }
    },
    onSuccess: (data) => {
      // Reemplaza el optimistic con server response (timestamps reales).
      const key = queryKeys.earlyAccess();
      const list = queryClient.getQueryData<EarlyAccessRequest[]>(key) ?? [];
      const idx = list.findIndex((r) => r.feature === data.feature);
      const next = [...list];
      if (idx >= 0) next[idx] = data;
      else next.push(data);
      queryClient.setQueryData<EarlyAccessRequest[]>(key, next);
    },
  });
}

/**
 * Helper convenience — true si el user ya solicitó este feature.
 *
 * @example
 *   const requested = useHasRequestedEarlyAccess("bridge:btc");
 */
export function useHasRequestedEarlyAccess(feature: EarlyAccessFeature): boolean {
  const requests = useEarlyAccessRequests();
  return !!requests.data?.some((r) => r.feature === feature);
}
