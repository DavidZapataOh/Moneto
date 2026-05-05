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

interface AppState {
  // Auth — discriminated state model
  authState: AuthState;

  // Backward-compat derivado de authState. Sprints viejos lo leen vía
  // `isAuthenticated` directamente; nuevos código debería usar
  // `authState.status === "authenticated"`.
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  user: User;

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
  /** Limpia el auth state. Llamar después de Privy logout. */
  logout: () => void;
  completeOnboarding: () => void;

  // UI actions
  toggleBalanceVisibility: () => void;

  // Mock data actions (Sprint 2+ los reemplaza con calls reales)
  sendP2P: (to: User, amount: number, note?: string) => void;
  simulateIncomingPayroll: (amount: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  authState: { status: "loading" },
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  user: mockUser,
  balanceHidden: false,
  balance: mockBalance,
  transactions: mockTransactions,
  contacts: mockContacts,
  card: mockCard,
  viewingKeys: mockViewingKeys,

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
    }),

  completeOnboarding: () => set({ hasCompletedOnboarding: true }),

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
