import { AssetIdSchema as _AssetIdSchema } from "@moneto/types";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";

import { useApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@stores/useAppStore";

import { useDebouncedValue } from "./useDebouncedValue";

// Hack: silence unused import — `AssetIdSchema` queda referenciado para
// futuro field `default_asset` en el shape del search response (Sprint 4.07).
void _AssetIdSchema;

const SearchUserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  country_code: z.string(),
  wallet_address: z.string(),
});

const SearchResponseSchema = z.array(SearchUserSchema);

export type SearchUser = z.infer<typeof SearchUserSchema>;

/**
 * Búsqueda de users por handle. Sprint 4.05.
 *
 * - **Debounce 300ms** del query — evita 1 request per keystroke.
 * - **enabled** solo cuando `query.length >= 2` post-debounce.
 * - **staleTime 30s** — el universo de users no cambia rápido para un
 *   query repetido.
 * - **gcTime 2min** — cache para que volver al search no re-fetch.
 */
export function useUserSearch(rawQuery: string): UseQueryResult<SearchUser[], Error> {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");
  const debounced = useDebouncedValue(rawQuery.trim(), 300);

  return useQuery<SearchUser[], Error>({
    queryKey: queryKeys.userSearch(debounced),
    queryFn: ({ signal }) =>
      api.get(`/api/users/search?q=${encodeURIComponent(debounced)}`, {
        schema: SearchResponseSchema,
        signal,
      }),
    enabled: isAuthenticated && debounced.length >= 2,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    retry: 1,
  });
}

/**
 * Lista de contactos recientes. Sprint 4.05 stub server-side ([] siempre).
 * Sprint 4.07 wirea con datos reales desde history de transferencias.
 *
 * Mantenemos el hook desde ya para que el render del Recipient step no
 * cambie cuando los datos lleguen.
 */
export function useRecentContacts(): UseQueryResult<SearchUser[], Error> {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  return useQuery<SearchUser[], Error>({
    queryKey: queryKeys.recentContacts(),
    queryFn: ({ signal }) =>
      api.get("/api/users/recent-contacts", {
        schema: SearchResponseSchema,
        signal,
      }),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
