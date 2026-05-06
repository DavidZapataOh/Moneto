import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  type Connection,
  type PublicKey,
  type SignatureStatus,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { TransferError } from "./errors";

/**
 * SPL token transfer service. Sprint 4.05 — P2P send entre Moneto users.
 *
 * Cubre:
 * 1. **Native SOL** transfer via `SystemProgram.transfer` (sin ATA).
 * 2. **SPL** (USDC, USDG, COPm, BTC etc.) via `createTransferCheckedInstruction`.
 *    - Auto-deriva sender + recipient ATAs.
 *    - Si la recipient ATA no existe, prepend `createAssociatedTokenAccountInstruction`
 *      (sender paga el rent ~0.002 SOL).
 *    - Soporta Token-2022 detectando programOwner del mint.
 * 3. **Pre-flight simulate** antes de pedir signature al user (catch decimals,
 *    freeze, etc.).
 * 4. **Confirm con polling** 1s/60s timeout — same patrón que JupiterSwapService.
 *
 * Sprint 5+: Umbra confidential transfers para privacy real (este service
 * sigue usable para fallback non-confidential cuando shielding falla).
 */

const NATIVE_SOL_SENTINEL = "11111111111111111111111111111111";
const CONFIRM_POLL_INTERVAL_MS = 1_000;
const CONFIRM_DEFAULT_TIMEOUT_MS = 60_000;

export interface TransferParams {
  /** Pubkey del sender — Privy embedded wallet del user. */
  senderPubkey: PublicKey;
  /** Pubkey del recipient — resuelto via `/api/users/search` o paste manual. */
  recipientPubkey: PublicKey;
  /** Mint del SPL a transferir, o `NATIVE_SOL_SENTINEL` para SOL nativo. */
  mint: PublicKey;
  /** Decimals on-chain del mint. Usado por `createTransferCheckedInstruction`
   *  + para safety check vs lo que el caller piensa. */
  decimals: number;
  /** Amount RAW (units = 10^decimals * displayAmount). bigint para safety. */
  amount: bigint;
}

export type SignTransactionFn = (tx: VersionedTransaction) => Promise<VersionedTransaction>;

export interface ExecuteTransferOptions {
  /** Confirm timeout. Default 60s. */
  confirmTimeoutMs?: number;
}

export class SplTransferService {
  constructor(private readonly connection: Connection) {}

  /**
   * Build una `VersionedTransaction` lista para firmar. NO firma — el
   * caller la pasa al wallet.
   *
   * Detecta token program (Token vs Token-2022) leyendo el mint account.
   * Para SOL nativo (`NATIVE_SOL_SENTINEL`) devuelve un SystemProgram
   * transfer simple sin ATA logic.
   */
  async buildTransferTx(params: TransferParams): Promise<VersionedTransaction> {
    if (params.amount <= 0n) {
      throw new TransferError("INVALID_AMOUNT", "amount must be > 0");
    }
    if (params.senderPubkey.equals(params.recipientPubkey)) {
      throw new TransferError("SELF_SEND", "sender and recipient cannot match");
    }

    const isNative = params.mint.toBase58() === NATIVE_SOL_SENTINEL;
    const blockhash = await this.connection.getLatestBlockhash("confirmed");

    let instructions;
    if (isNative) {
      instructions = [
        SystemProgram.transfer({
          fromPubkey: params.senderPubkey,
          toPubkey: params.recipientPubkey,
          // SystemProgram acepta number (lamports). bigint > Number.MAX_SAFE_INTEGER
          // (>9e15 lamports = >9M SOL) defensivo throw.
          lamports: this.bigintToSafeNumber(params.amount, "lamports"),
        }),
      ];
    } else {
      // Resolver el program owner del mint (Token vs Token-2022).
      let programId = TOKEN_PROGRAM_ID;
      try {
        const mintAccount = await getMint(
          this.connection,
          params.mint,
          "confirmed",
          TOKEN_PROGRAM_ID,
        );
        // Si la mint info se leyó OK con TOKEN_PROGRAM_ID, asumimos legacy.
        // Defensa contra decimals mismatch — protección extra contra
        // wrong-decimals bug del caller.
        if (mintAccount.decimals !== params.decimals) {
          throw new TransferError("INVALID_AMOUNT", "decimals mismatch", {
            expected: params.decimals,
            onChain: mintAccount.decimals,
          });
        }
      } catch (err) {
        // Fallback Token-2022 — getMint(TOKEN_PROGRAM_ID) throw cuando el
        // mint pertenece a Token-2022.
        if (TransferError.is(err)) throw err;
        try {
          const mint2022 = await getMint(
            this.connection,
            params.mint,
            "confirmed",
            TOKEN_2022_PROGRAM_ID,
          );
          if (mint2022.decimals !== params.decimals) {
            throw new TransferError("INVALID_AMOUNT", "decimals mismatch (token-2022)", {
              expected: params.decimals,
              onChain: mint2022.decimals,
            });
          }
          programId = TOKEN_2022_PROGRAM_ID;
        } catch (inner) {
          if (TransferError.is(inner)) throw inner;
          throw new TransferError("ATA_DERIVATION_FAILED", "mint info fetch failed", {
            mint: params.mint.toBase58(),
          });
        }
      }

      const senderAta = getAssociatedTokenAddressSync(
        params.mint,
        params.senderPubkey,
        true,
        programId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const recipientAta = getAssociatedTokenAddressSync(
        params.mint,
        params.recipientPubkey,
        true,
        programId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Check si la recipient ATA existe. Si no, prepend create instruction
      // (sender paga el rent — convención P2P).
      const recipientAtaInfo = await this.connection.getAccountInfo(recipientAta, "confirmed");

      const builtInstructions = [];
      if (!recipientAtaInfo) {
        builtInstructions.push(
          createAssociatedTokenAccountInstruction(
            params.senderPubkey, // payer
            recipientAta,
            params.recipientPubkey,
            params.mint,
            programId,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      builtInstructions.push(
        createTransferCheckedInstruction(
          senderAta,
          params.mint,
          recipientAta,
          params.senderPubkey,
          params.amount,
          params.decimals,
          [],
          programId,
        ),
      );

      instructions = builtInstructions;
    }

    const message = new TransactionMessage({
      payerKey: params.senderPubkey,
      recentBlockhash: blockhash.blockhash,
      instructions,
    }).compileToV0Message();

    return new VersionedTransaction(message);
  }

  /**
   * Pre-flight simulation. Catch errors temprano sin gastar el slot del
   * user en sign + send.
   */
  async simulateTransfer(
    tx: VersionedTransaction,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const sim = await this.connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });
      if (sim.value.err) {
        return { ok: false, error: JSON.stringify(sim.value.err) };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `simulate_threw:${message}` };
    }
  }

  /**
   * Orquesta el flow end-to-end:
   * 1. Build tx (incluye ATA derive + create si necesario).
   * 2. Pre-flight simulate.
   * 3. Sign (delegated callback — Privy).
   * 4. Send raw + skip preflight (ya simulamos).
   * 5. Confirm polling.
   *
   * @throws `TransferError` con code apropiado para que el caller mappee
   *   a UI copy.
   */
  async executeTransfer(
    params: TransferParams,
    sign: SignTransactionFn,
    options: ExecuteTransferOptions = {},
  ): Promise<{ signature: string }> {
    let tx: VersionedTransaction;
    try {
      tx = await this.buildTransferTx(params);
    } catch (err) {
      if (TransferError.is(err)) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new TransferError("NETWORK_ERROR", message);
    }

    const sim = await this.simulateTransfer(tx);
    if (!sim.ok) {
      // Heurística: simulate "AccountNotFound" + sender ATA missing →
      // INSUFFICIENT_BALANCE (no token account = no balance). Otros
      // errors caen a SIMULATION_FAILED genérico.
      if (sim.error.includes("AccountNotFound") || sim.error.includes("insufficient")) {
        throw new TransferError("INSUFFICIENT_BALANCE", sim.error);
      }
      throw new TransferError("SIMULATION_FAILED", sim.error);
    }

    let signed: VersionedTransaction;
    try {
      signed = await sign(tx);
    } catch (err) {
      throw new TransferError("EXECUTION_FAILED", "user_sign_failed", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    let signature: string;
    try {
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new TransferError("EXECUTION_FAILED", "send_failed", { error: message });
    }

    const confirmation = await this.confirmTransaction(
      signature,
      options.confirmTimeoutMs ?? CONFIRM_DEFAULT_TIMEOUT_MS,
    );
    if (confirmation.err) {
      throw new TransferError("EXECUTION_FAILED", "confirmed_with_error", {
        signature,
        err: confirmation.err,
      });
    }

    return { signature };
  }

  private async confirmTransaction(
    signature: string,
    timeoutMs: number,
  ): Promise<{ err: SignatureStatus["err"] | null }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.connection
        .getSignatureStatus(signature, { searchTransactionHistory: true })
        .catch(() => null);
      const value = status?.value;
      const conf = value?.confirmationStatus;
      if (conf === "confirmed" || conf === "finalized") {
        return { err: value?.err ?? null };
      }
      await sleep(CONFIRM_POLL_INTERVAL_MS);
    }
    throw new TransferError("CONFIRMATION_TIMEOUT", `not confirmed within ${timeoutMs}ms`, {
      signature,
    });
  }

  private bigintToSafeNumber(value: bigint, label: string): number {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new TransferError("INVALID_AMOUNT", `${label} exceeds safe integer range`);
    }
    return Number(value);
  }
}

function sleep(ms: number): Promise<void> {
  const timer = (
    globalThis as unknown as {
      setTimeout: (cb: () => void, ms: number) => unknown;
    }
  ).setTimeout;
  return new Promise((resolve) => {
    timer(() => resolve(), ms);
  });
}
