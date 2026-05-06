import { MAINNET_MINTS, getAssetIdByMint } from "@moneto/types";
import { createLogger } from "@moneto/utils";

const log = createLogger("tx.history");

/**
 * Tx History Service — Sprint 4.07.
 *
 * Strategy: usar Helius Enhanced Transactions API (`/v0/addresses/:address
 * /transactions`) en lugar de `getSignaturesForAddress + getParsedTransactions`
 * directo al RPC. Razones:
 * - **Pre-parsed**: Helius normaliza tokenTransfers + nativeTransfers,
 *   nos ahorra el pattern-matching de instructions raw.
 * - **Fewer RPC calls**: 1 endpoint vs N+1 (signatures + parse per sig).
 * - **Pagination consistente**: cursor-based (`before=signature`) que
 *   matchea exactamente el plan.
 *
 * **Sprint 5+** Umbra integration:
 * - Para txs Confidential Balance, el `tokenTransfers.tokenAmount` viene
 *   cifrado. Necesitamos viewing key del user (client-side decrypt).
 * - El service Sprint 4.07 NO decifra — pasa los amounts del Helius
 *   "as-is" para SPL transparente. Sprint 5 wirea el step de decrypt
 *   en el client antes del render.
 *
 * **Privacy**: el server NO loguea amounts/counterparties en plain text.
 * Solo signatures + count + duration.
 */

const HELIUS_API_BASE = "https://api.helius.xyz/v0";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Jupiter v6 program ID — usado para classify swaps. Si una tx incluye
 * el program en `instructions`, la marcamos como `swap`.
 */
// eslint-disable-next-line no-secrets/no-secrets -- on-chain program pubkey, public por diseño
const JUPITER_V6_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

export type DecryptedTxType =
  | "p2p_in"
  | "p2p_out"
  | "payroll"
  | "swap"
  | "cashout"
  | "card"
  | "yield"
  | "unknown";

export type DecryptedTxStatus = "completed" | "pending" | "failed";

export interface DecryptedTx {
  /** Solana transaction signature — único per tx, usado como key + cursor. */
  id: string;
  type: DecryptedTxType;
  /** Display amount con signo (negative = outgoing). USD-equivalent
   *  pendiente Sprint 5 con price service integration. Sprint 4.07
   *  retorna native units convertidos via decimals del registry. */
  amount: number;
  /** Symbol del asset (USD, COP, BTC, etc.) o "SOL" para nativo. */
  currency: string;
  description: string;
  counterpartyName: string | null;
  counterpartyHandle: string | null;
  /** Epoch ms. */
  timestamp: number;
  status: DecryptedTxStatus;
  /** AssetId del registry, null si mint desconocido. */
  assetUsed: string | null;
  /** True si la tx aún no es decrypt-able (Sprint 5 confidential). */
  isPrivate: boolean;
}

export interface FetchPageParams {
  /** Pubkey base58 del user (resolved server-side via Privy admin). */
  address: string;
  /** Cursor: signature del último item de la página anterior. */
  before?: string;
  /** Cap 50, default 20. */
  limit?: number;
}

export interface FetchPageResult {
  items: DecryptedTx[];
  /** null cuando no hay más páginas. */
  nextCursor: string | null;
}

export interface TxHistoryEnv {
  HELIUS_API_KEY?: string;
}

/**
 * Helius Enhanced Transactions response shape (subset). Documentación:
 * https://docs.helius.dev/api-reference/enhanced-transactions-api/parsed-transaction-history
 */
interface HeliusTokenTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  tokenAmount?: number;
  mint?: string;
}

interface HeliusNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number; // lamports
}

interface HeliusInstruction {
  programId?: string;
}

interface HeliusEvent {
  signature: string;
  timestamp: number;
  slot?: number;
  type?: string;
  source?: string;
  fee?: number;
  feePayer?: string;
  description?: string;
  transactionError?: { error?: string } | null;
  tokenTransfers?: HeliusTokenTransfer[];
  nativeTransfers?: HeliusNativeTransfer[];
  instructions?: HeliusInstruction[];
}

export class TxHistoryService {
  constructor(private readonly env: TxHistoryEnv) {}

  /**
   * Fetch single tx detail por signature. Sprint 4.08.
   *
   * Strategy: usar Helius `parseTransactions` POST endpoint que acepta
   * un array de signatures. Retorna `null` cuando la tx no existe o no
   * involucra al user (post-classify filter).
   */
  async fetchByCSignature(signature: string, userAddress: string): Promise<DecryptedTx | null> {
    if (!this.env.HELIUS_API_KEY) {
      log.warn("helius api key missing — tx detail unavailable");
      return null;
    }

    const url = `${HELIUS_API_BASE}/transactions?api-key=${this.env.HELIUS_API_KEY}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: [signature] }),
      });
    } catch (err) {
      log.warn("helius tx detail fetch error", { err: String(err) });
      return null;
    }
    if (!res.ok) {
      log.warn("helius tx detail non-2xx", { status: res.status });
      return null;
    }
    let raw: HeliusEvent[];
    try {
      raw = (await res.json()) as HeliusEvent[];
    } catch {
      return null;
    }
    const evt = raw[0];
    if (!evt) return null;
    return classify(evt, userAddress);
  }

  async fetchPage(params: FetchPageParams): Promise<FetchPageResult> {
    if (!this.env.HELIUS_API_KEY) {
      log.warn("helius api key missing — tx history unavailable");
      return { items: [], nextCursor: null };
    }

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const url = new URL(`${HELIUS_API_BASE}/addresses/${params.address}/transactions`);
    url.searchParams.set("api-key", this.env.HELIUS_API_KEY);
    url.searchParams.set("limit", String(limit));
    if (params.before) url.searchParams.set("before", params.before);

    let res: Response;
    try {
      res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    } catch (err) {
      log.warn("helius tx history fetch error", { err: String(err) });
      return { items: [], nextCursor: null };
    }
    if (!res.ok) {
      log.warn("helius tx history non-2xx", { status: res.status });
      return { items: [], nextCursor: null };
    }

    let raw: HeliusEvent[];
    try {
      raw = (await res.json()) as HeliusEvent[];
    } catch {
      log.warn("helius tx history non-json");
      return { items: [], nextCursor: null };
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      return { items: [], nextCursor: null };
    }

    const items: DecryptedTx[] = [];
    for (const evt of raw) {
      const decrypted = classify(evt, params.address);
      if (decrypted) items.push(decrypted);
    }

    // Cursor = signature del último evento (no del último item filtrado),
    // así que el `before` del próximo request avanza incluso si todos los
    // items de la página fueron filtrados (e.g., todos unknown skip-eados).
    const lastSignature = raw[raw.length - 1]?.signature ?? null;
    const nextCursor = raw.length === limit ? lastSignature : null;

    log.info("tx history page fetched", {
      addressPrefix: params.address.slice(0, 8),
      requestedLimit: limit,
      rawCount: raw.length,
      filteredCount: items.length,
      hasMore: nextCursor !== null,
    });

    return { items, nextCursor };
  }
}

/**
 * Heurística de clasificación. Inspecciona tokenTransfers + nativeTransfers
 * + instructions para inferir el tipo. Sin viewing key, todos los amounts
 * son public (Sprint 5 con Umbra agrega decrypt para Confidential).
 *
 * Retorna `null` si no podemos clasificar (e.g., tx con error o sin
 * relevant transfers para nuestro user).
 */
function classify(evt: HeliusEvent, userAddress: string): DecryptedTx | null {
  // Skip failed txs — Sprint 8 puede surface "fallida" como item visible.
  if (evt.transactionError) return null;

  const sig = evt.signature;
  const ts = (evt.timestamp ?? 0) * 1000;
  const acceptedMints = new Set<string>(Object.values(MAINNET_MINTS));

  // Detect swap por instruction program presence.
  const isSwap = evt.instructions?.some((i) => i.programId === JUPITER_V6_PROGRAM_ID);

  // Find the transfer involving our user. Si hay multiple (multi-hop swap),
  // priorizamos el que tenga mint del registry.
  let primaryTransfer: HeliusTokenTransfer | null = null;
  for (const t of evt.tokenTransfers ?? []) {
    const involvesUser = t.fromUserAccount === userAddress || t.toUserAccount === userAddress;
    if (!involvesUser) continue;
    if (t.mint && acceptedMints.has(t.mint)) {
      primaryTransfer = t;
      break;
    }
    if (!primaryTransfer) primaryTransfer = t;
  }

  // Native SOL transfer fallback.
  let nativeAmount: number | null = null;
  let nativeIsOutgoing = false;
  if (!primaryTransfer) {
    for (const n of evt.nativeTransfers ?? []) {
      if (n.fromUserAccount === userAddress) {
        nativeAmount = -(n.amount ?? 0) / 1e9; // lamports → SOL
        nativeIsOutgoing = true;
        break;
      }
      if (n.toUserAccount === userAddress) {
        nativeAmount = (n.amount ?? 0) / 1e9;
        break;
      }
    }
  }

  if (!primaryTransfer && nativeAmount === null) return null;

  if (primaryTransfer) {
    const mint = primaryTransfer.mint ?? "";
    const assetId = getAssetIdByMint(mint);
    const isOutgoing = primaryTransfer.fromUserAccount === userAddress;
    const amountAbs = primaryTransfer.tokenAmount ?? 0;
    const amount = isOutgoing ? -amountAbs : amountAbs;

    let type: DecryptedTxType = isOutgoing ? "p2p_out" : "p2p_in";
    if (isSwap) type = "swap";

    // counterparty pubkey extraída pero NO retornada en plain text —
    // Sprint 4.07 deja `counterpartyName/Handle: null`. Sprint 5+ con
    // viewing key + reverse handle resolution wirea los nombres reales.
    const _counterparty =
      (isOutgoing ? primaryTransfer.toUserAccount : primaryTransfer.fromUserAccount) ?? null;
    void _counterparty;

    return {
      id: sig,
      type,
      amount,
      currency: assetId ? assetId.toUpperCase() : symbolFromMint(mint),
      description: descriptionFor(type, evt),
      counterpartyName: null,
      counterpartyHandle: null,
      timestamp: ts,
      status: "completed",
      assetUsed: assetId,
      isPrivate: false,
    };
  }

  // Native SOL.
  return {
    id: sig,
    type: nativeIsOutgoing ? "p2p_out" : "p2p_in",
    amount: nativeAmount ?? 0,
    currency: "SOL",
    description: descriptionFor(nativeIsOutgoing ? "p2p_out" : "p2p_in", evt),
    counterpartyName: null,
    counterpartyHandle: null,
    timestamp: ts,
    status: "completed",
    assetUsed: "sol",
    isPrivate: false,
  };
}

function descriptionFor(type: DecryptedTxType, evt: HeliusEvent): string {
  if (evt.description && evt.description.length < 80) return evt.description;
  switch (type) {
    case "p2p_in":
      return "Recibido";
    case "p2p_out":
      return "Enviado";
    case "swap":
      return "Conversión";
    case "cashout":
      return "Retiro";
    case "card":
      return "Pago con tarjeta";
    case "yield":
      return "Rendimiento";
    case "payroll":
      return "Pago recibido";
    default:
      return "Movimiento";
  }
}

function symbolFromMint(mint: string): string {
  // Fallback short — los mints conocidos ya pasaron por getAssetIdByMint.
  // Aquí cae mint random (token fan, etc.) — display los primeros 4 chars
  // del base58 como hint. Sprint 8 puede cache un mint→symbol map externo.
  return mint.slice(0, 4).toUpperCase();
}
