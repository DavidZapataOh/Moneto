import { create } from "zustand";

import {
  mockBalance,
  mockTransactions,
  mockUser,
  mockCard,
  mockViewingKeys,
  mockContacts,
  type Transaction,
  type User,
} from "@data/mock";

/**
 * Discriminated union para el estado de auth. Una sola fuente de verdad —
 * `usePrivyAuthSync` es el único writer (vía `setAuthState`), todo lo
 * demás del codebase lee.
 *
 * - `loading`     — Privy aún inicializando (cold start, fetching JWKS, etc).
 * - `unauthenticated` — Sin sesión activa.
 * - `authenticated` — Privy user + Solana wallet ready.
 * - `refreshing`  — Token expiró, refresh en curso (transparente para el user).
 * - `expired`     — Refresh falló, requiere re-auth manual.
 * - `error`       — Falla irrecuperable (network, Privy down, etc).
 */
export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; userId: string; walletAddress: string }
  | { status: "refreshing" }
  | { status: "expired" }
  | { status: "error"; error: string };

/**
 * Subset del Profile de Supabase que el mobile usa. Mantenido aparte del
 * `Database["profiles"]["Row"]` completo para evitar import cross-package
 * en el store y limitar la superficie a lo que la UI realmente necesita.
 *
 * Sprint 1.05+ wirea fetch real desde Supabase via `useProfile()` hook.
 * Hasta entonces, default es `kyc_level: 0, kyc_status: "none"` — coincide
 * con el row freshly creado por el edge fn `sync-profile`.
 */
export interface ProfileSlice {
  kycLevel: 0 | 1 | 2 | 3;
  kycStatus: "none" | "pending" | "approved" | "rejected";
  countryCode: string | null;
  handle: string | null;
}

const DEFAULT_PROFILE: ProfileSlice = {
  kycLevel: 0,
  kycStatus: "none",
  countryCode: null,
  handle: null,
};

interface AppState {
  // Auth — discriminated state model
  authState: AuthState;

  // Backward-compat derivado de authState. Sprints viejos lo leen vía
  // `isAuthenticated` directamente; nuevos código debería usar
  // `authState.status === "authenticated"`.
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  user: User;

  // Profile — slice del Supabase profile (Sprint 1.05 wirea fetch real).
  profile: ProfileSlice;

  // UI state
  balanceHidden: boolean;

  // Data (mock until Sprint 2+ data layer)
  balance: typeof mockBalance;
  transactions: Transaction[];
  contacts: User[];
  card: typeof mockCard;
  viewingKeys: typeof mockViewingKeys;

  // Auth actions
  setAuthState: (next: AuthState) => void;
  /** Backward-compat shim — usar `setAuthState` en código nuevo. */
  login: () => void;
  /**
   * Limpia el auth state. Llamar después de Privy logout — pero el cleanup
   * canónico end-to-end es `performLogoutCleanup` en `@/lib/auth`, que
   * además resetea AsyncStorage, observability, singletons, etc. Este
   * action solo toca el store en memoria.
   */
  logout: () => void;
  /**
   * Reset hard de TODO el state in-memory de la app a sus defaults.
   * **Preserva** `hasCompletedOnboarding` (el user ya vio el intro y no
   * tiene sentido re-mostrárselo en el próximo login del mismo device).
   *
   * Único caller esperado: `performLogoutCleanup` en `@/lib/auth`.
   */
  reset: () => void;
  completeOnboarding: () => void;

  // Profile actions
  /**
   * Update parcial del profile (cualquier subset de fields). Llamar
   * después de fetch desde Supabase o después de KYC webhook propaga
   * via realtime (Sprint 5+).
   */
  setProfile: (patch: Partial<ProfileSlice>) => void;

  // UI actions
  toggleBalanceVisibility: () => void;

  // Mock data actions (Sprint 2+ los reemplaza con calls reales)
  sendP2P: (to: User, amount: number, note?: string) => void;
  simulateIncomingPayroll: (amount: number) => void;
}

/**
 * Defaults que aplican a un user "frío" (post-logout o pre-login).
 * Mock data se mantiene como placeholder UI hasta Sprint 2+ — el reset
 * vuelve a estos defaults exactamente, NO conserva nada del user previo.
 */
const INITIAL_STATE: Pick<
  AppState,
  | "authState"
  | "isAuthenticated"
  | "user"
  | "profile"
  | "balanceHidden"
  | "balance"
  | "transactions"
  | "contacts"
  | "card"
  | "viewingKeys"
> = {
  authState: { status: "unauthenticated" },
  isAuthenticated: false,
  user: mockUser,
  profile: DEFAULT_PROFILE,
  balanceHidden: false,
  balance: mockBalance,
  transactions: mockTransactions,
  contacts: mockContacts,
  card: mockCard,
  viewingKeys: mockViewingKeys,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...INITIAL_STATE,
  // Override del INITIAL_STATE — al primer mount, queremos `loading`
  // (mostramos splash hasta que Privy responda) en lugar de `unauthenticated`
  // (que dispararía render del onboarding antes de tiempo).
  authState: { status: "loading" },
  hasCompletedOnboarding: false,

  setAuthState: (next) =>
    set({
      authState: next,
      isAuthenticated: next.status === "authenticated",
    }),

  login: () =>
    set({
      // Shim — solo para código legacy que aún no migró. Al usar Privy real,
      // `setAuthState({ status: "authenticated", ... })` es el canónico.
      authState: { status: "authenticated", userId: "mock", walletAddress: "mock" },
      isAuthenticated: true,
    }),

  logout: () =>
    set({
      authState: { status: "unauthenticated" },
      isAuthenticated: false,
      profile: DEFAULT_PROFILE,
    }),

  reset: () =>
    set({
      ...INITIAL_STATE,
      // `hasCompletedOnboarding` es per-device, no per-session — el user
      // ya vió el intro, mostrárselo otra vez después de un logout es UX
      // pésimo. Lee del estado actual para preservarlo.
      hasCompletedOnboarding: get().hasCompletedOnboarding,
    }),

  completeOnboarding: () => set({ hasCompletedOnboarding: true }),

  setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

  toggleBalanceVisibility: () => set((s) => ({ balanceHidden: !s.balanceHidden })),

  sendP2P: (to, amount, note) => {
    const newTx: Transaction = {
      id: `t_${Date.now()}`,
      type: "p2p_out",
      amount: -Math.abs(amount),
      currency: "USD",
      description: note ?? "Pago · privado",
      counterpartyName: to.name,
      counterpartyHandle: to.handle,
      timestamp: Date.now(),
      isPrivate: true,
      status: "completed",
    };
    set((s) => ({
      transactions: [newTx, ...s.transactions],
      balance: {
        ...s.balance,
        totalUsd: s.balance.totalUsd - Math.abs(amount),
        availableUsd: s.balance.availableUsd - Math.abs(amount),
      },
    }));
  },

  simulateIncomingPayroll: (amount) => {
    const newTx: Transaction = {
      id: `t_${Date.now()}`,
      type: "payroll",
      amount: Math.abs(amount),
      currency: "USD",
      description: "Nómina · Acme Inc.",
      counterpartyName: "Acme Inc.",
      timestamp: Date.now(),
      isPrivate: true,
      status: "completed",
    };
    set((s) => ({
      transactions: [newTx, ...s.transactions],
      balance: {
        ...s.balance,
        totalUsd: s.balance.totalUsd + Math.abs(amount),
        availableUsd: s.balance.availableUsd + Math.abs(amount),
      },
    }));
  },
}));
