import { createLogger } from "@moneto/utils";
import { usePrivy, useEmbeddedSolanaWallet, type User } from "@privy-io/expo";
import { useEffect, useRef } from "react";

import { useAppStore, type AuthState } from "@stores/useAppStore";

const log = createLogger("auth.sync");

/**
 * Lee el estado de Privy + extrae el primer Solana embedded wallet, y
 * lo proyecta al `authState` de Zustand. **Único writer** del campo
 * — el resto del código solo lee.
 *
 * Idempotent: corre en cada render pero solo `setAuthState` cuando hay
 * cambio real (deep diff barato vía discriminator + ids).
 *
 * Llamar UNA vez en el árbol (típicamente desde `_layout.tsx Shell`),
 * después de `<PrivyProvider>`.
 */
export function usePrivyAuthSync(): void {
  const { user, isReady, error } = usePrivy();
  const wallets = useEmbeddedSolanaWallet();
  const setAuthState = useAppStore((s) => s.setAuthState);
  const lastWritten = useRef<string>("");

  useEffect(() => {
    const next = computeAuthState({
      isReady,
      error,
      user,
      walletAddress: extractFirstSolanaAddress(wallets),
    });

    // Cheap diff: status + (userId|error si aplica) — evita renders
    // si Privy emite isReady varias veces sin cambio de auth real.
    const fingerprint = fingerprintAuthState(next);
    if (fingerprint === lastWritten.current) return;

    lastWritten.current = fingerprint;
    log.debug("auth state transition", { status: next.status });
    setAuthState(next);
  }, [isReady, error, user, wallets, setAuthState]);
}

interface ComputeInput {
  isReady: boolean;
  error: Error | null;
  user: User | null;
  walletAddress: string | null;
}

function computeAuthState(input: ComputeInput): AuthState {
  if (input.error) {
    return { status: "error", error: input.error.message };
  }
  if (!input.isReady) {
    return { status: "loading" };
  }
  if (!input.user) {
    return { status: "unauthenticated" };
  }
  if (!input.walletAddress) {
    // User autenticado pero wallet aún se está creando (1-3s típico
    // post-OAuth con `createOnLogin: "users-without-wallets"`). Seguimos
    // en `loading` desde el punto de vista del store — evita render
    // de pantallas authenticated antes de tener wallet.
    return { status: "loading" };
  }
  return {
    status: "authenticated",
    userId: input.user.id,
    walletAddress: input.walletAddress,
  };
}

/**
 * Privy expone wallets via el hook `useEmbeddedSolanaWallet()`. Su shape
 * varía según estado (`not-created` | `creating` | `connected` | etc).
 * Solo retornamos la address cuando el wallet está `connected`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape de Privy varía por estado, validamos via duck typing
function extractFirstSolanaAddress(wallets: any): string | null {
  if (!wallets || wallets.status !== "connected") return null;
  const list = wallets.wallets;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!first || typeof first.address !== "string") return null;
  return first.address;
}

function fingerprintAuthState(s: AuthState): string {
  switch (s.status) {
    case "authenticated":
      return `${s.status}:${s.userId}:${s.walletAddress}`;
    case "error":
      return `${s.status}:${s.error}`;
    default:
      return s.status;
  }
}
