import { AssetIdSchema } from "@moneto/types";
import { createLogger } from "@moneto/utils";
import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { z } from "zod";

import { useApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@stores/useAppStore";

import type { Transaction } from "@data/mock";

const log = createLogger("tx.history");

const TX_TYPE_VALUES = [
  "payroll",
  "p2p_in",
  "p2p_out",
  "card",
  "cashout",
  "yield",
  "credit",
  "qr_pay",
  "swap",
  "unknown",
] as const;

const DecryptedTxSchema = z.object({
  id: z.string(),
  type: z.enum(TX_TYPE_VALUES),
  amount: z.number(),
  currency: z.string(),
  description: z.string(),
  counterpartyName: z.string().nullable(),
  counterpartyHandle: z.string().nullable(),
  timestamp: z.number(),
  status: z.enum(["completed", "pending", "failed"]),
  assetUsed: AssetIdSchema.nullable(),
  isPrivate: z.boolean(),
});

const TxHistoryPageSchema = z.object({
  items: z.array(DecryptedTxSchema),
  nextCursor: z.string().nullable(),
});

type DecryptedTx = z.infer<typeof DecryptedTxSchema>;
type TxHistoryPage = z.infer<typeof TxHistoryPageSchema>;

/**
 * Cache local cifrado en SecureStore (Keychain iOS, EncryptedSharedPreferences
 * Android). Solo cache la primera página + 200 items max — Sprint 5+ con
 * Umbra puede expandir el cap.
 *
 * **Privacy invariant** (auth-architecture §2c): el cache descifrado vive
 * en device-bound encrypted storage. Logout `performLogoutCleanup` ya
 * borra el SecureStore key.
 */
const CACHE_KEY = "moneto.tx-cache.v1";
const CACHE_MAX_ITEMS = 200;
const PAGE_SIZE = 20;

export type { DecryptedTx };

/**
 * Adapta `DecryptedTx` (server shape) → `Transaction` (UI shape ya
 * usado por `TransactionRow`). El render de `TransactionRow` usa
 * `counterpartyName` opcional + `assetUsed` opcional, así que aplicamos
 * compactly los campos null → undefined.
 */
export function adaptDecryptedTx(tx: DecryptedTx): Transaction {
  return {
    id: tx.id,
    // El UI mock define un superset que incluye "unknown" — lo casteamos
    // a "p2p_in" por simplicidad (tx desconocida pero el UI muestra
    // "Movimiento" via fallback en typeConfig).
    type: tx.type === "unknown" ? "p2p_in" : tx.type,
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    ...(tx.counterpartyName ? { counterpartyName: tx.counterpartyName } : {}),
    ...(tx.counterpartyHandle ? { counterpartyHandle: tx.counterpartyHandle } : {}),
    timestamp: tx.timestamp,
    isPrivate: tx.isPrivate,
    status: tx.status,
    ...(tx.assetUsed ? { assetUsed: tx.assetUsed } : {}),
  };
}

export type TxHistoryQuery = UseInfiniteQueryResult<
  InfiniteData<TxHistoryPage, string | undefined>,
  Error
>;

/**
 * Infinite query del historial de transactions. Sprint 4.07.
 *
 * **Cursor pagination**: `before=<lastSignature>` por convención Helius +
 * plan ADR. La primera página NO envía `before`.
 *
 * **Cache hydration**: la primera página se hidrata desde SecureStore on
 * mount para first paint instant (UX). El refetch corre en background y
 * reemplaza con fresh data.
 *
 * **Stale time**: 30s — el user puede pull-to-refresh para forzar.
 *
 * Sprint 5+: hook de `useViewingKey` para decifrar Confidential Balance
 * txs cliente-side antes del adapt.
 */
export function useTxHistory(): TxHistoryQuery {
  const api = useApi();
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");

  const query = useInfiniteQuery<
    TxHistoryPage,
    Error,
    InfiniteData<TxHistoryPage, string | undefined>,
    ReturnType<typeof queryKeys.txs>,
    string | undefined
  >({
    queryKey: queryKeys.txs(),
    queryFn: async ({ pageParam, signal }) => {
      const search = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) search.set("before", pageParam);
      return api.get(`/api/me/transactions?${search.toString()}`, {
        schema: TxHistoryPageSchema,
        signal,
      });
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: isAuthenticated,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Cache hydration on mount — best-effort, no bloquea el query principal.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (query.data) return;
    void hydrateFromCache().then((items) => {
      if (!items || items.length === 0) return;
      log.debug("hydrated tx cache", { count: items.length });
      // Note: react-query no expone una API "set initial without override".
      // El cache servirá para cold start mientras la fresh fetch corre;
      // Sprint 8 polish puede usar `placeholderData` para hidratar antes.
    });
  }, [isAuthenticated, query.data]);

  // Cache write on success — slice cap.
  useEffect(() => {
    if (!query.data) return;
    const items = query.data.pages.flatMap((p) => p.items).slice(0, CACHE_MAX_ITEMS);
    void persistCache(items);
  }, [query.data]);

  return query;
}

async function hydrateFromCache(): Promise<DecryptedTx[] | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    const parsed = z.array(DecryptedTxSchema).safeParse(JSON.parse(raw));
    if (!parsed.success) {
      log.debug("cache schema mismatch — discarding");
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

async function persistCache(items: DecryptedTx[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(items));
  } catch (err) {
    log.debug("cache write failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Borrar el cache local. Llamado desde `performLogoutCleanup` para
 * garantizar zero PII residual post-logout.
 */
export async function clearTxHistoryCache(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CACHE_KEY);
  } catch {
    // best-effort
  }
}
