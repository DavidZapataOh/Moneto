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

interface AppState {
  // Auth
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  user: User;

  // UI state
  balanceHidden: boolean;

  // Data
  balance: typeof mockBalance;
  transactions: Transaction[];
  contacts: User[];
  card: typeof mockCard;
  viewingKeys: typeof mockViewingKeys;

  // Actions
  login: () => void;
  logout: () => void;
  completeOnboarding: () => void;
  toggleBalanceVisibility: () => void;
  sendP2P: (to: User, amount: number, note?: string) => void;
  simulateIncomingPayroll: (amount: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  user: mockUser,
  balanceHidden: false,
  balance: mockBalance,
  transactions: mockTransactions,
  contacts: mockContacts,
  card: mockCard,
  viewingKeys: mockViewingKeys,

  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
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
      balance: { ...s.balance, totalUsd: s.balance.totalUsd - Math.abs(amount), availableUsd: s.balance.availableUsd - Math.abs(amount) },
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
      balance: { ...s.balance, totalUsd: s.balance.totalUsd + Math.abs(amount), availableUsd: s.balance.availableUsd + Math.abs(amount) },
    }));
  },
}));
