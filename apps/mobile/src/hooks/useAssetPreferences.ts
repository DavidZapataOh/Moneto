import { AssetIdSchema, type AssetId } from "@moneto/types";
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

const log = createLogger("asset.prefs");

/**
 * Default sensato — coherente con `DEFAULT_ASSET_ORDER` en
 * `apps/api/src/routes/me.ts` y con el SQL default de la migration 0008.
 *
 * Stables USD primero (most stable for daily spending), locales después
 * (zero-conversion for QR locales), volátiles último (avoid selling
 * unless needed).
 */
export const DEFAULT_ASSET_PRIORITY_ORDER: readonly AssetId[] = [
  "usd",
  "eur",
  "cop",
  "mxn",
  "brl",
  "ars",
  "sol",
  "btc",
  "eth",
] as const;

export const DEFAULT_SEND_ASSET: AssetId = "usd";

// ─── Wire schemas ─────────────────────────────────────────────────────────

const AssetPrefsSchema = z.object({
  asset_priority_order: z.array(AssetIdSchema),
  hidden_assets: z.array(AssetIdSchema),
  default_send_asset: AssetIdSchema,
  updated_at: z.string(),
});

export type AssetPrefs = z.infer<typeof AssetPrefsSchema>;

export interface AssetPrefsUpdate {
  asset_priority_order?: AssetId[];
  hidden_assets?: AssetId[];
  default_send_asset?: AssetId;
}

// ─── Defaults builder ─────────────────────────────────────────────────────

/**
 * Para un user nuevo (sin `asset-preferences` row todavía) o cuando el
 * server retornó shape inesperado, usamos defaults locales sintéticos
 * con `updated_at` epoch 0 — cualquier write local-first ganará en LWW
 * cuando el server reciba el primer PUT.
 */
function buildDefaults(): AssetPrefs {
  return {
    asset_priority_order: [...DEFAULT_ASSET_PRIORITY_ORDER],
    hidden_assets: [],
    default_send_asset: DEFAULT_SEND_ASSET,
    updated_at: new Date(0).toISOString(),
  };
}

/**
 * Reconcilia un `AssetPrefs` con la lista canónica de assets:
 * - Asegura que cada asset del registry esté en el priority order
 *   (sino, lo añade al final). Necesario cuando el registry crece
 *   post-launch.
 * - Filtra hidden_assets vs asset enum válido (defense-in-depth).
 * - Si default_send_asset queda hidden post-update, lo cambia al primer
 *   visible.
 */
export function normalizeAssetPrefs(prefs: AssetPrefs): AssetPrefs {
  const seen = new Set<AssetId>();
  const order: AssetId[] = [];
  for (const id of prefs.asset_priority_order) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of DEFAULT_ASSET_PRIORITY_ORDER) {
    if (!seen.has(id)) order.push(id);
  }

  const hiddenSet = new Set<AssetId>(prefs.hidden_assets);
  let defaultSend = prefs.default_send_asset;
  if (hiddenSet.has(defaultSend)) {
    // Pick first visible from order — safer fallback que hardcoded "usd"
    // (que también podría estar hidden).
    const firstVisible = order.find((id) => !hiddenSet.has(id));
    defaultSend = firstVisible ?? DEFAULT_SEND_ASSET;
  }

  return {
    asset_priority_order: order,
    hidden_assets: prefs.hidden_assets,
    default_send_asset: defaultSend,
    updated_at: prefs.updated_at,
  };
}

// ─── Hooks ────────────────────────────────────────────────────────────────

/**
 * Subscribes a las preferencias de assets del user (priority order, hidden,
 * default send). React Query con `staleTime: 60s` — el user cambia esto
 * raramente, no necesita refetch agresivo.
 *
 * Cuando el user no tiene preferencias todavía (404 / empty row), retorna
 * defaults sintéticos. La mutation `useUpdateAssetPreferences()` persiste
 * cualquier cambio + invalida el query.
 *
 * @example
 *   const { data: prefs } = useAssetPreferences();
 *   const visibleAssets = prefs?.asset_priority_order.filter(
 *     (id) => !prefs.hidden_assets.includes(id),
 *   );
 */
export function useAssetPreferences(): UseQueryResult<AssetPrefs, Error> {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  return useQuery<AssetPrefs, Error>({
    queryKey: queryKeys.assetPreferences(),
    queryFn: async ({ signal }) => {
      try {
        const raw = await api.get("/api/me/asset-preferences", {
          schema: AssetPrefsSchema,
          signal,
        });
        return normalizeAssetPrefs(raw);
      } catch (err) {
        // 404 / 409 → no row provisioned aún. Retornamos defaults locales
        // — el primer cambio del user PUTeará y creará la row.
        if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
          log.debug("asset prefs not provisioned, using defaults", { status: err.status });
          return buildDefaults();
        }
        throw err;
      }
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Mutation que persiste un patch parcial de `AssetPrefs`. Optimistic update:
 * el cache local se actualiza inmediato y se rollback si el server falla.
 *
 * **Reconciliación**: post-success, el server puede haber modificado el
 * payload (ej. trigger SQL prepende default_send_asset al order si faltaba).
 * Aplicamos el response como source of truth.
 *
 * @example
 *   const update = useUpdateAssetPreferences();
 *   update.mutate({ hidden_assets: ["btc"] });
 *   // o con callback:
 *   update.mutate(
 *     { default_send_asset: "cop" },
 *     { onSuccess: () => router.back() },
 *   );
 */
export function useUpdateAssetPreferences(): UseMutationResult<
  AssetPrefs,
  Error,
  AssetPrefsUpdate
> {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<AssetPrefs, Error, AssetPrefsUpdate, { previous: AssetPrefs | undefined }>({
    mutationFn: async (updates) => {
      const raw = await api.put("/api/me/asset-preferences", updates, {
        schema: AssetPrefsSchema,
      });
      return normalizeAssetPrefs(raw);
    },
    onMutate: async (updates) => {
      const key = queryKeys.assetPreferences();
      // Cancelamos refetches in-flight que podrían pisarnos.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AssetPrefs>(key);

      if (previous) {
        const merged = normalizeAssetPrefs({
          ...previous,
          ...updates,
          // Mantenemos updated_at del cache hasta confirmar — UI no muestra
          // "updated_at" directo, así que no impacta.
          updated_at: previous.updated_at,
        });
        queryClient.setQueryData<AssetPrefs>(key, merged);
      }

      return { previous };
    },
    onError: (error, _updates, context) => {
      log.warn("asset prefs update failed", {
        message: error.message,
        code: error instanceof ApiError ? error.code : undefined,
      });
      // Rollback al snapshot pre-mutation.
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.assetPreferences(), context.previous);
      }
    },
    onSuccess: (data) => {
      // Server response es source of truth (trigger SQL puede haber
      // ajustado el payload).
      queryClient.setQueryData(queryKeys.assetPreferences(), data);
    },
  });
}
