import { TransferError, type TransferErrorCode } from "@moneto/solana/transfer";
import { displayToRaw, getAsset, getMint, type AssetId } from "@moneto/types";
import { createLogger } from "@moneto/utils";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";

import { capture, Events, getPostHog, bucketAmountUsd } from "@/lib/observability";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@stores/useAppStore";

import { useSolanaServices } from "./useSolanaServices";

const log = createLogger("send.p2p");

export interface SendP2PInput {
  /** Asset id (registry). Mapeamos al primary mint vía `getMint(id)`. */
  asset: AssetId;
  /** Pubkey base58 del recipient (resuelto via `useUserSearch`). */
  recipientAddress: string;
  /** Display amount (decimal-adjusted, lo que el user vio). */
  displayAmount: number;
  /** Memo opcional — Sprint 4.05 NO se mete on-chain todavía. Se preserva
   *  en el evento PostHog para analytics anonymized + Sprint 5 hook con
   *  Umbra para shielded memo. */
  memo?: string;
  /** USD-equivalent del send para el bucket de PostHog. */
  amountUsd?: number;
}

export interface SendP2PResult {
  signature: string;
  asset: AssetId;
  recipientAddress: string;
}

/**
 * Mutation P2P send (Sprint 4.05).
 *
 * Flow:
 * 1. Resolve sender pubkey + recipient pubkey + mint del asset.
 * 2. Construye `TransferParams` (raw amount via `displayToRaw`).
 * 3. Llama `SplTransferService.executeTransfer` con sign callback Privy.
 * 4. Invalida balance + txs onSuccess. Emite `send_completed` con
 *    bucketed amount + asset.
 *
 * **Error mapping**: `TransferError.code` → matrix de UI copy en el
 * caller (ConfirmStep). Los errores de wallet (sign cancelled,
 * provider unavailable) se reportan como `EXECUTION_FAILED`.
 */
export function useSendP2P(): UseMutationResult<SendP2PResult, Error, SendP2PInput> {
  const { transfer } = useSolanaServices();
  const queryClient = useQueryClient();
  const wallets = useEmbeddedSolanaWallet();
  const walletAddress = useAppStore((s) =>
    s.authState.status === "authenticated" ? s.authState.walletAddress : null,
  );

  const sign = useCallback(
    async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      const provider = await resolvePrivySolanaProvider(wallets);
      if (!provider) {
        throw new TransferError("EXECUTION_FAILED", "wallet_provider_unavailable");
      }
      const result = await provider.request({
        method: "signTransaction",
        params: { transaction: tx },
      });
      const signed = (result as { signedTransaction?: VersionedTransaction | Transaction })
        .signedTransaction;
      if (!signed) {
        throw new TransferError("EXECUTION_FAILED", "sign_returned_no_transaction");
      }
      return signed as VersionedTransaction;
    },
    [wallets],
  );

  return useMutation<SendP2PResult, Error, SendP2PInput>({
    mutationFn: async ({ asset, recipientAddress, displayAmount }) => {
      if (!walletAddress) {
        throw new TransferError("EXECUTION_FAILED", "wallet_not_ready");
      }
      const senderPubkey = new PublicKey(walletAddress);

      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(recipientAddress);
      } catch {
        throw new TransferError("INVALID_RECIPIENT", "invalid base58 pubkey");
      }
      if (senderPubkey.equals(recipientPubkey)) {
        throw new TransferError("SELF_SEND", "cannot send to self");
      }

      const meta = getAsset(asset);
      const mint = new PublicKey(getMint(asset));
      const amountRaw = displayToRaw(displayAmount, asset);
      if (amountRaw <= 0n) {
        throw new TransferError("INVALID_AMOUNT", "amount must be > 0");
      }

      // PostHog `send_initiated` — pre-execution funnel input.
      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.send_initiated, { type: "p2p" });
      }

      const { signature } = await transfer.executeTransfer(
        {
          senderPubkey,
          recipientPubkey,
          mint,
          decimals: meta.decimals,
          amount: amountRaw,
        },
        sign,
      );
      return { signature, asset, recipientAddress };
    },
    onSuccess: ({ signature, asset }, variables) => {
      log.info("p2p send completed", {
        signature: signature.slice(0, 12),
        asset,
      });

      const ph = getPostHog();
      if (ph) {
        const meta = getAsset(asset);
        capture(ph, Events.send_completed, {
          type: "p2p",
          currency: meta.symbol,
          fee_pct: 0, // P2P interno = gratis
          amount_bucket: bucketAmountUsd(variables.amountUsd ?? variables.displayAmount),
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.balance() });
      queryClient.invalidateQueries({ queryKey: queryKeys.txs() });
    },
    onError: (error, variables) => {
      const code: TransferErrorCode = TransferError.is(error) ? error.code : "EXECUTION_FAILED";
      log.warn("p2p send failed", { code, message: error.message });

      const ph = getPostHog();
      if (ph) {
        capture(ph, Events.send_failed, { type: "p2p", reason: code });
      }
      // Sentry tag context — el caller también puede surface UI alert.
      void variables;
    },
    retry: false,
  });
}

// ── Privy wallet provider duck-typing (mirror de useExecuteSwap) ──────

interface PrivySolanaWalletShape {
  status: string;
  wallets?: Array<{ getProvider?: () => Promise<PrivySolanaProvider> }>;
}

interface PrivySolanaProvider {
  request: (req: {
    method: "signTransaction";
    params: { transaction: VersionedTransaction };
  }) => Promise<{ signedTransaction: VersionedTransaction }>;
}

async function resolvePrivySolanaProvider(wallets: unknown): Promise<PrivySolanaProvider | null> {
  const w = wallets as PrivySolanaWalletShape | null;
  if (!w || w.status !== "connected") return null;
  const list = w.wallets;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!first || typeof first.getProvider !== "function") return null;
  try {
    return await first.getProvider();
  } catch (err) {
    log.warn("getProvider threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
