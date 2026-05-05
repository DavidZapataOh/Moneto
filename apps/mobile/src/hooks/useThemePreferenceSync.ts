import { createLogger } from "@moneto/utils";
import { useEffect } from "react";
import { z } from "zod";

import { useApi, ApiError } from "@/lib/api";
import { useAppStore } from "@stores/useAppStore";
import { useThemeStore, type ThemePreference } from "@stores/useThemeStore";

const log = createLogger("theme.sync");

/**
 * Debounce del PUT — deja al user seleccionar varias opciones rápido en
 * `appearance.tsx` sin disparar 3 calls. 2s es el sweet spot: corto
 * suficiente para que el cambio se persista en background antes de que el
 * user cierre la app, largo suficiente para coalescer toggles.
 */
const SYNC_DEBOUNCE_MS = 2000;

const RemotePreferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  updated_at: z.string(),
});

/**
 * Sync hibrido del theme preference:
 *
 * 1. **On login** (auth state → "authenticated"): GET `/api/me/preferences`.
 *    Si el server tiene `updated_at` > local `lastSyncAt`, aplicar el
 *    remote (otra device ganó). Sino, marcar local como synced (=
 *    confirmamos que ya está al día).
 *
 * 2. **On preference change** (`syncedToRemote: false`): debounce 2s y
 *    PUT al server. Si falla, dejamos `syncedToRemote: false` para que
 *    el próximo cambio o re-mount lo re-intente.
 *
 * Conflict resolution: **last-write-wins** vía `updated_at` server-set.
 * Acceptable para preferences UI (no es money-moving) y elimina la
 * necesidad de CRDTs / merge logic.
 *
 * Llamar UNA vez en `_layout.tsx > Shell`, después de `usePrivyAuthSync`.
 */
export function useThemePreferenceSync(): void {
  const preference = useThemeStore((s) => s.preference);
  const syncedToRemote = useThemeStore((s) => s.syncedToRemote);
  const markSynced = useThemeStore((s) => s.markSynced);
  const setFromRemote = useThemeStore((s) => s.setFromRemote);
  const isAuthenticated = useAppStore((s) => s.authState.status === "authenticated");
  const api = useApi();

  // ── 1. On-login pull ─────────────────────────────────────────────────────
  // Trigger: transición a authenticated. Solo dispara una vez por login
  // (effect deps son [isAuthenticated, api] — api es singleton).
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const remote = await api.get("/api/me/preferences", {
          schema: RemotePreferencesSchema,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const remoteSyncedAt = parseTimestamp(remote.updated_at);
        const localSyncedAt = useThemeStore.getState().lastSyncAt ?? 0;
        const localPreference = useThemeStore.getState().preference;

        // Last-write-wins. Si remote es estrictamente más nuevo y la
        // preferencia difiere, aplicar; sino, confirmar synced state.
        if (remoteSyncedAt > localSyncedAt && remote.theme !== localPreference) {
          log.debug("applying remote theme preference", {
            from: localPreference,
            to: remote.theme,
          });
          setFromRemote(remote.theme as ThemePreference, remoteSyncedAt);
        } else {
          markSynced();
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // ApiError 401 → token expirando, Privy lo refrescará y el próximo
        // mount re-intenta. Network → idem. Sin necesidad de Sentry capture
        // (no es bug, es expected en offline / cold-start).
        if (err instanceof ApiError) {
          log.debug("preferences fetch failed", { code: err.code, status: err.status });
        } else {
          log.warn("preferences fetch error", { err: String(err) });
        }
      }
    })();

    return () => controller.abort();
  }, [isAuthenticated, api, markSynced, setFromRemote]);

  // ── 2. On-change debounced push ──────────────────────────────────────────
  // Solo corre si autenticado + dirty. El timer se cancela en cleanup, así
  // que cambios rápidos (3 toggles en 1s) coalescen a un único PUT.
  useEffect(() => {
    if (!isAuthenticated || syncedToRemote) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await api.put(
            "/api/me/preferences",
            { theme: preference },
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          markSynced();
          log.debug("theme preference synced", { preference });
        } catch (err) {
          if (controller.signal.aborted) return;
          // Dejamos `syncedToRemote: false` → próximo trigger lo re-intenta.
          // 409 = profile aún no provisionado (edge fn `sync-profile`
          // todavía no creó la row). Esperable en primer login; el próximo
          // mount lo retry.
          if (err instanceof ApiError) {
            log.warn("theme sync put failed", { code: err.code, status: err.status });
          } else {
            log.warn("theme sync error", { err: String(err) });
          }
        }
      })();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isAuthenticated, syncedToRemote, preference, api, markSynced]);
}

function parseTimestamp(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}
