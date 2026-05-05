import {
  ASSETS_REGISTRY,
  rawToDisplay,
  type Asset,
  type AssetMeta,
  type SolanaNetwork,
} from "@moneto/types";
import { createLogger } from "@moneto/utils";

import type { PriceService } from "./price-service";

const log = createLogger("balance.service");

/**
 * Helius DAS env requirements. La API key vive en `HELIUS_API_KEY`
 * (server-side only — never exposed to mobile). Workers fetch directo
 * a `https://mainnet.helius-rpc.com/?api-key=...`.
 */
export interface BalanceServiceEnv {
  HELIUS_API_KEY?: string;
}

/**
 * Subset del response shape de Helius DAS `getAssetsByOwner`. Tipado
 * conservador: solo los fields que efectivamente leemos. Helius retorna
 * mucha más metadata que ignoramos — no tipamos lo que no usamos para
 * evitar drift cuando Helius extiende su API.
 */
interface HeliusFungibleAsset {
  /** El mint pubkey del token (base58). */
  id: string;
  token_info?: {
    /** Balance raw como string (puede exceder Number.MAX_SAFE_INTEGER). */
    balance?: string;
    decimals?: number;
  };
}

interface HeliusNativeBalance {
  /** Lamports — bigint as string. */
  lamports?: string | number;
}

interface HeliusGetAssetsByOwnerResult {
  items?: HeliusFungibleAsset[];
  nativeBalance?: HeliusNativeBalance;
}

interface HeliusJsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: string;
  result?: T;
  error?: { code: number; message: string };
}

/**
 * Aggregated balance response — el shape que el endpoint serializa
 * + lo que el mobile consume. `balance` es bigint; el caller lo
 * convierte a string para el JSON wire.
 */
export interface BalanceSummary {
  assets: Asset[];
  /** Suma USD de todos los assets. */
  totalUsd: number;
  /** Cambio 24h ABSOLUTO en USD (solo volátiles aportan). */
  change24hUsd: number;
  /** Cambio 24h en porcentaje sobre el total. Decimal. */
  change24hPct: number;
  /** APY ponderado por balance USD (decimal). */
  weightedApy: number;
  /** Timestamp epoch ms del fetch. */
  fetchedAt: number;
}

/**
 * BalanceService — fetch balances on-chain de un user via Helius DAS,
 * aggrega underlying mints por AssetId, calcula USD equivalent y APY
 * ponderado.
 *
 * **Compartmentalization**: este servicio recibe la **pubkey** ya
 * resuelta (vía `getPrivyUserSolanaPubkey`). NUNCA persiste pubkeys.
 *
 * **Performance**: 1 RPC call a Helius por user (DAS aggregator) en
 * vez de N getTokenAccountsByOwner separados. Native SOL viene en
 * el mismo response (`showNativeBalance: true`).
 *
 * **Logging**: tag por user + duration ms + count assets. NUNCA log
 * balance amounts — privacy invariant.
 */
export class BalanceService {
  constructor(
    private readonly env: BalanceServiceEnv,
    private readonly priceService: PriceService,
  ) {}

  async getBalancesForUser(userPubkey: string, network: SolanaNetwork): Promise<BalanceSummary> {
    const start = Date.now();

    if (!this.env.HELIUS_API_KEY) {
      throw new Error("HELIUS_API_KEY missing — BalanceService misconfigured");
    }

    const result = await this.fetchHeliusAssets(userPubkey, network);
    const tokenItems = result.items ?? [];
    const nativeLamports = this.parseLamports(result.nativeBalance);

    const enabledAssets = Object.values(ASSETS_REGISTRY).filter((meta) =>
      meta.enabledOn.includes(network),
    );

    const assets: Asset[] = [];

    for (const meta of enabledAssets) {
      const balance = this.aggregateBalance(meta, tokenItems, nativeLamports);
      const spotPriceUsd = (await this.priceService.getSpotUsd(meta.id)) ?? 0;
      const change24h =
        meta.category === "volatile"
          ? ((await this.priceService.get24hChange(meta.id)) ?? undefined)
          : undefined;

      const balanceDisplay = rawToDisplay(balance, meta.id);
      const balanceUsd = balanceDisplay * spotPriceUsd;
      const apy = meta.defaultApy;
      const isEarning = Boolean(meta.apySource) && balance > 0n;

      assets.push({
        id: meta.id,
        symbol: meta.symbol,
        name: meta.name,
        category: meta.category,
        balance,
        balanceUsd,
        spotPriceUsd,
        // exactOptionalPropertyTypes: omitir si undefined.
        ...(apy !== undefined ? { apy } : {}),
        isEarning,
        ...(change24h !== undefined ? { change24h } : {}),
        ...(meta.pinnedInUI !== undefined ? { isPinned: meta.pinnedInUI } : {}),
      });
    }

    const totalUsd = assets.reduce((sum, a) => sum + a.balanceUsd, 0);
    const change24hUsd = assets
      .filter((a) => a.category === "volatile")
      .reduce((sum, a) => sum + a.balanceUsd * (a.change24h ?? 0), 0);
    const weightedApy =
      totalUsd > 0
        ? assets
            .filter((a) => a.isEarning)
            .reduce((sum, a) => sum + a.balanceUsd * (a.apy ?? 0), 0) / totalUsd
        : 0;
    const change24hPct = totalUsd > 0 ? change24hUsd / totalUsd : 0;

    const summary: BalanceSummary = {
      assets,
      totalUsd,
      change24hUsd,
      change24hPct,
      weightedApy,
      fetchedAt: Date.now(),
    };

    log.info("balance fetched", {
      assetsCount: assets.length,
      durationMs: Date.now() - start,
      // NO loggear amounts — privacy.
    });

    return summary;
  }

  /**
   * Llamada raw a Helius DAS `getAssetsByOwner` con
   * `displayOptions.showFungible + showNativeBalance`. JSON-RPC 2.0.
   */
  private async fetchHeliusAssets(
    ownerAddress: string,
    network: SolanaNetwork,
  ): Promise<HeliusGetAssetsByOwnerResult> {
    const host =
      network === "mainnet-beta"
        ? "https://mainnet.helius-rpc.com"
        : "https://devnet.helius-rpc.com";

    const url = `${host}/?api-key=${this.env.HELIUS_API_KEY}`;
    const body = {
      jsonrpc: "2.0" as const,
      id: "moneto-balance",
      method: "getAssetsByOwner",
      params: {
        ownerAddress,
        page: 1,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true,
        },
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      log.error("helius network error", { err: String(err) });
      throw new Error("helius_network_error");
    }

    if (!res.ok) {
      log.error("helius non-2xx", { status: res.status });
      throw new Error(`helius_status_${res.status}`);
    }

    const json = (await res.json()) as HeliusJsonRpcResponse<HeliusGetAssetsByOwnerResult>;
    if (json.error) {
      log.error("helius rpc error", { code: json.error.code, message: json.error.message });
      throw new Error(`helius_rpc_${json.error.code}`);
    }

    return json.result ?? {};
  }

  /**
   * Agrega los balances de los underlying mints de un AssetId. Native
   * SOL es caso especial (viene en `nativeBalance`, no en `items`).
   */
  private aggregateBalance(
    meta: AssetMeta,
    tokenItems: HeliusFungibleAsset[],
    nativeLamports: bigint,
  ): bigint {
    if (meta.id === "sol") {
      return nativeLamports;
    }

    let total = 0n;
    for (const underlying of meta.underlyingMints) {
      const account = tokenItems.find((it) => it.id === underlying.mint && it.token_info?.balance);
      const raw = account?.token_info?.balance;
      if (typeof raw === "string" && raw.length > 0) {
        try {
          total += BigInt(raw);
        } catch {
          log.warn("invalid balance string from helius", { mint: underlying.mint });
        }
      }
    }
    return total;
  }

  /** Parsea lamports tolerando string | number | undefined. */
  private parseLamports(native: HeliusNativeBalance | undefined): bigint {
    if (!native) return 0n;
    const raw = native.lamports;
    if (typeof raw === "number") return BigInt(Math.floor(raw));
    if (typeof raw === "string" && raw.length > 0) {
      try {
        return BigInt(raw);
      } catch {
        return 0n;
      }
    }
    return 0n;
  }
}

/**
 * Factory. Mantiene la dependencia `PriceService` opcional para que
 * `routes/me.ts` reuse un singleton de price service (Sprint 3.03 +).
 */
export function createBalanceService(
  env: BalanceServiceEnv,
  priceService: PriceService,
): BalanceService {
  return new BalanceService(env, priceService);
}
