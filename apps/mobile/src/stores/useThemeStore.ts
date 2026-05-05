import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  /**
   * `false` cuando el local difiere del remote (o nunca se sincronizó).
   * `useThemePreferenceSync` consume este flag para debounce el PUT.
   */
  syncedToRemote: boolean;
  /**
   * Epoch ms del último sync exitoso (PUT ack o pull aplicado). `null`
   * antes del primer sync. Usado para conflict-resolution last-write-wins
   * comparando contra `user_preferences.updated_at` del server.
   */
  lastSyncAt: number | null;
  /** Cambio originado en el device — marca dirty para próximo sync. */
  setPreference: (p: ThemePreference) => void;
  /** Llamar después de un PUT ack del server, sin tocar la preferencia. */
  markSynced: () => void;
  /**
   * Aplicar preferencia recibida del server (durante el on-login pull).
   * Marca synced y guarda el `syncedAt` del server para futuras comparaciones.
   */
  setFromRemote: (p: ThemePreference, syncedAt: number) => void;
}

// Persistimos solo la preferencia + flags de sync. Default `"system"` →
// respeta el OS hasta que el user elige manualmente.
//
// Storage version 2 → migra desde v1 (que solo tenía `preference`) seteando
// `syncedToRemote: false` para forzar un push inicial al server cuando el
// user haga login.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      syncedToRemote: false,
      lastSyncAt: null,
      setPreference: (p) => set({ preference: p, syncedToRemote: false }),
      markSynced: () => set({ syncedToRemote: true, lastSyncAt: Date.now() }),
      setFromRemote: (p, syncedAt) =>
        set({ preference: p, syncedToRemote: true, lastSyncAt: syncedAt }),
    }),
    {
      name: "moneto.theme",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted, fromVersion) => {
        const prev = (persisted ?? {}) as { preference?: ThemePreference };
        if (fromVersion < 2) {
          return {
            preference: prev.preference ?? "system",
            syncedToRemote: false,
            lastSyncAt: null,
          } as ThemeState;
        }
        return persisted as ThemeState;
      },
      partialize: (state) => ({
        preference: state.preference,
        syncedToRemote: state.syncedToRemote,
        lastSyncAt: state.lastSyncAt,
      }),
    },
  ),
);
