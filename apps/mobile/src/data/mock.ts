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
  | "credit"
  | "qr_pay"
  | "swap";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // USD equivalent, negative = outgoing
  currency: "USD";
  description: string;
  counterpartyName?: string;
  counterpartyHandle?: string;
  timestamp: number;
  isPrivate: boolean;
  status: "completed" | "pending" | "failed";
  assetUsed?: AssetId; // qué asset se usó para esta tx
}

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: "CO" | "MX" | "BR" | "AR";
  avatar?: string;
}

// ─── Asset model ──────────────────────────────────────────────

export type AssetId =
  | "usd"
  | "cop"
  | "mxn"
  | "brl"
  | "ars"
  | "eur"
  | "sol"
  | "btc"
  | "eth";

export type AssetCategory = "stable_usd" | "stable_local" | "stable_eur" | "volatile";

export interface Asset {
  id: AssetId;
  symbol: string; // "USD", "COP", "BTC"
  name: string; // "Dólares estables", "Peso colombiano", "Bitcoin"
  shortName: string; // "USD", "COP", "BTC"
  category: AssetCategory;
  icon: "usd" | "cop" | "mxn" | "brl" | "ars" | "eur" | "sol" | "btc" | "eth";
  balance: number; // en unidades nativas
  balanceUsd: number; // USD equivalent al spot price actual
  spotPriceUsd: number; // precio unitario en USD
  apy?: number; // si rinde
  isEarning: boolean; // flag: está en vault rindiendo
  change24h?: number; // % change 24h (para volátiles)
  isPinned?: boolean; // pinned al asset strip
}

export const mockUser: User = {
  id: "u_maria_01",
  name: "María Jiménez",
  handle: "@mariaj",
  email: "maria@example.com",
  country: "CO",
};

// ─── Assets de María ──────────────────────────────────────────

export const mockAssets: Asset[] = [
  {
    id: "usd",
    symbol: "USD",
    name: "Dólar",
    shortName: "USD",
    category: "stable_usd",
    icon: "usd",
    balance: 8240.32, // unificado: USDG + USDC + PYUSD
    balanceUsd: 8240.32,
    spotPriceUsd: 1,
    apy: 0.062,
    isEarning: true,
    isPinned: true, // USD siempre primero
  },
  {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    shortName: "SOL",
    category: "volatile",
    icon: "sol",
    balance: 15.2,
    balanceUsd: 2128.0,
    spotPriceUsd: 140,
    change24h: 0.018,
    isEarning: false,
  },
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    shortName: "BTC",
    category: "volatile",
    icon: "btc",
    balance: 0.042,
    balanceUsd: 1512.0,
    spotPriceUsd: 36000,
    change24h: 0.032,
    isEarning: false,
  },
  {
    id: "cop",
    symbol: "COP",
    name: "Peso colombiano",
    shortName: "COP",
    category: "stable_local",
    icon: "cop",
    balance: 1680000, // COP
    balanceUsd: 420.0,
    spotPriceUsd: 0.00025,
    apy: 0.051,
    isEarning: true,
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    shortName: "ETH",
    category: "volatile",
    icon: "eth",
    balance: 0.04,
    balanceUsd: 130.0,
    spotPriceUsd: 3250,
    change24h: -0.008,
    isEarning: false,
  },
];

// Helpers derivados
export const totalPatrimonioUsd = mockAssets.reduce((sum, a) => sum + a.balanceUsd, 0);
export const totalEarningUsd = mockAssets
  .filter((a) => a.isEarning)
  .reduce((sum, a) => sum + a.balanceUsd, 0);

// APY ponderado = sum(asset.apy × asset.balanceUsd) / totalEarningUsd
export const weightedApy =
  mockAssets
    .filter((a) => a.isEarning && a.apy)
    .reduce((sum, a) => sum + (a.apy ?? 0) * a.balanceUsd, 0) / totalEarningUsd;

// ─── Balance summary ───────────────────────────────────────────

export const mockBalance = {
  totalUsd: totalPatrimonioUsd, // equivalente USD de TODO
  availableUsd: totalPatrimonioUsd,
  shieldedUsd: totalPatrimonioUsd, // todo shielded via Umbra
  yieldApy: weightedApy,
  yieldAccrued24h: 2.11,
  yieldAccruedMonth: 64.23,
  change24hUsd: 23.4,
  change24hPct: 0.023,
};

// ─── Contacts ─────────────────────────────────────────────────

export const mockContacts: User[] = [
  { id: "c1", name: "Juan Restrepo", handle: "@juanrr", email: "", country: "CO" },
  { id: "c2", name: "Ana Morales", handle: "@anamrls", email: "", country: "CO" },
  { id: "c3", name: "Carlos Gómez", handle: "@cgomez", email: "", country: "MX" },
  { id: "c4", name: "Sofía Ortiz", handle: "@sofo", email: "", country: "AR" },
  { id: "c5", name: "Luis Pérez", handle: "@luisp", email: "", country: "CO" },
];

// ─── Transacciones ────────────────────────────────────────────

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
    description: "Te envió",
    counterpartyName: "Juan Restrepo",
    counterpartyHandle: "@juanrr",
    timestamp: now - 12 * min,
    isPrivate: true,
    status: "completed",
    assetUsed: "usd",
  },
  {
    id: "t2",
    type: "qr_pay",
    amount: -12.5,
    currency: "USD",
    description: "Juan Valdez · Bogotá",
    timestamp: now - 2 * hr,
    isPrivate: true,
    status: "completed",
    assetUsed: "cop",
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
    assetUsed: "usd",
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
    assetUsed: "usd",
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
    assetUsed: "usd",
  },
  {
    id: "t6",
    type: "swap",
    amount: 500,
    currency: "USD",
    description: "Convertido a COP",
    timestamp: now - 1.5 * day,
    isPrivate: true,
    status: "completed",
    assetUsed: "cop",
  },
  {
    id: "t7",
    type: "cashout",
    amount: -500,
    currency: "USD",
    description: "Retiro a Bancolombia",
    timestamp: now - 2 * day,
    isPrivate: true,
    status: "completed",
    assetUsed: "usd",
  },
  {
    id: "t8",
    type: "p2p_out",
    amount: -85,
    currency: "USD",
    description: "Pago",
    counterpartyName: "Ana Morales",
    counterpartyHandle: "@anamrls",
    timestamp: now - 3 * day,
    isPrivate: true,
    status: "completed",
    assetUsed: "usd",
  },
];

// ─── Yield history ─────────────────────────────────────────────

export const mockYieldHistory = Array.from({ length: 30 }, (_, i) => {
  const base = 12200 + i * 7.2;
  const noise = Math.sin(i * 0.8) * 3;
  return base + noise;
});

// ─── Card ──────────────────────────────────────────────────────

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

// ─── Priority orden (editable por el usuario) ──────────────────

export const mockAssetPriority: AssetId[] = [
  "usd", // stables USD primero (alta liquidez + yield)
  "cop", // local stable si está (para evitar conversion en pagos locales)
  "sol", // nativo Solana (fees bajos)
  "btc", // volátil, último recurso
  "eth", // volátil wrapped
];
