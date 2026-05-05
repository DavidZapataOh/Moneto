import { JupiterSwapService } from "@moneto/solana/jupiter";
import { Connection } from "@solana/web3.js";
import { useMemo } from "react";

const SOLANA_RPC_URL = process.env["EXPO_PUBLIC_SOLANA_RPC_URL"] ?? "";

/**
 * Solana services context hook.
 *
 * Construye **una sola vez** (memo por module-scope) una `Connection`
 * + `JupiterSwapService`. Cualquier consumer (`useSwapQuote`,
 * `useExecuteSwap` Sprint 3.06) reusa los mismos singletons.
 *
 * **Por qué module-scope, no React context**: estos servicios son
 * stateless y no dependen del React tree (auth, user). Singletons
 * dedupean instancias entre re-renders y evitan recrear `Connection`
 * (~10ms de setup por instance).
 *
 * **RPC URL**: viene de `EXPO_PUBLIC_SOLANA_RPC_URL` (Helius RPC dedicated
 * para el mobile). Sprint 0/1 ya provisioned el key; el founder controla
 * un quota limit separado al server para que un leak del bundle no
 * afecte el server-side budget.
 *
 * Si `EXPO_PUBLIC_SOLANA_RPC_URL` no está set (config inválida), el
 * hook lanza `Error` al primer call — fail-fast preferible a swap
 * silently fail at execute time.
 */

let cachedConnection: Connection | null = null;
let cachedJupiter: JupiterSwapService | null = null;

interface SolanaServices {
  connection: Connection;
  jupiter: JupiterSwapService;
}

export function useSolanaServices(): SolanaServices {
  return useMemo(() => {
    if (!SOLANA_RPC_URL) {
      throw new Error("EXPO_PUBLIC_SOLANA_RPC_URL not set — Solana services unavailable");
    }

    if (!cachedConnection) {
      // commitment "confirmed" balance entre velocidad y seguridad —
      // sub-second confirmation, sin esperar finalized (~13s).
      // sendRawTransaction usa preflight separado, así que el commitment
      // default no afecta tx send.
      cachedConnection = new Connection(SOLANA_RPC_URL, {
        commitment: "confirmed",
        // No fast: skip para reducir overhead — fetcheamos getSignatureStatus
        // manual en JupiterSwapService.confirmTransaction.
      });
    }

    if (!cachedJupiter) {
      cachedJupiter = new JupiterSwapService({ connection: cachedConnection });
    }

    return { connection: cachedConnection, jupiter: cachedJupiter };
  }, []);
}
