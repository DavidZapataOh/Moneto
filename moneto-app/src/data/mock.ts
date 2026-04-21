/**
 * Mock data para MVP del hackathon.
 * Se reemplaza con queries reales a backend/Solana post-MVP.
 */

export type TransactionType =
  | "payroll"
  | "p2p_in"
  | "p2p_out"
  | "card"
  | "cashout"
  | "yield"
  | "credit";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // negative = outgoing, positive = incoming
  currency: "USD";
  description: string;
  counterpartyName?: string;
  counterpartyHandle?: string;
  timestamp: number;
  isPrivate: boolean;
  status: "completed" | "pending" | "failed";
}

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: "CO" | "MX" | "BR" | "AR";
  avatar?: string;
}

export const mockUser: User = {
  id: "u_maria_01",
  name: "María Jiménez",
  handle: "@mariaj",
  email: "maria@example.com",
  country: "CO",
};

export const mockBalance = {
  totalUsd: 12430.5,
  availableUsd: 12430.5,
  shieldedUsd: 11230.5,
  yieldApy: 0.062, // 6.2% APY
  yieldAccrued24h: 2.11,
  yieldAccruedMonth: 64.23,
};

export const mockContacts: User[] = [
  { id: "c1", name: "Juan Restrepo", handle: "@juanrr", email: "", country: "CO" },
  { id: "c2", name: "Ana Morales", handle: "@anamrls", email: "", country: "CO" },
  { id: "c3", name: "Carlos Gómez", handle: "@cgomez", email: "", country: "MX" },
  { id: "c4", name: "Sofía Ortiz", handle: "@sofo", email: "", country: "AR" },
  { id: "c5", name: "Luis Pérez", handle: "@luisp", email: "", country: "CO" },
];

const now = Date.now();
const min = 60_000;
const hr = 60 * min;
const day = 24 * hr;

export const mockTransactions: Transaction[] = [
  {
    id: "t1",
    type: "p2p_in",
    amount: 200,
    currency: "USD",
    description: "Te envió · privado",
    counterpartyName: "Juan Restrepo",
    counterpartyHandle: "@juanrr",
    timestamp: now - 12 * min,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t2",
    type: "card",
    amount: -24.5,
    currency: "USD",
    description: "Carulla · Bogotá",
    timestamp: now - 2 * hr,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t3",
    type: "yield",
    amount: 2.11,
    currency: "USD",
    description: "Rendimiento 24h",
    timestamp: now - 4 * hr,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t4",
    type: "card",
    amount: -12,
    currency: "USD",
    description: "Uber · Bogotá",
    timestamp: now - 8 * hr,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t5",
    type: "payroll",
    amount: 3000,
    currency: "USD",
    description: "Nómina · Acme Inc.",
    counterpartyName: "Acme Inc.",
    timestamp: now - 1 * day,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t6",
    type: "cashout",
    amount: -500,
    currency: "USD",
    description: "Retiro a Bancolombia",
    timestamp: now - 2 * day,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t7",
    type: "p2p_out",
    amount: -85,
    currency: "USD",
    description: "Pago · privado",
    counterpartyName: "Ana Morales",
    counterpartyHandle: "@anamrls",
    timestamp: now - 3 * day,
    isPrivate: true,
    status: "completed",
  },
  {
    id: "t8",
    type: "card",
    amount: -45,
    currency: "USD",
    description: "El Éxito · Bogotá",
    timestamp: now - 4 * day,
    isPrivate: true,
    status: "completed",
  },
];

// Yield chart — últimos 30 días, creciente sutil
export const mockYieldHistory = Array.from({ length: 30 }, (_, i) => {
  const base = 12200 + i * 7.2;
  const noise = Math.sin(i * 0.8) * 3;
  return base + noise;
});

export const mockCard = {
  id: "card_01",
  last4: "4829",
  type: "virtual" as const,
  cardholderName: "MARIA JIMENEZ",
  network: "Visa",
  status: "active" as const,
  limitDailyUsd: 1000,
  spentTodayUsd: 36.5,
};

export const mockViewingKeys = [
  {
    id: "vk_01",
    label: "Contador · Tax 2026",
    scope: "Ene–Dic 2026 · montos agregados",
    sharedWith: "juancarlos@contador.co",
    expiresAt: now + 20 * day,
    createdAt: now - 10 * day,
  },
];
