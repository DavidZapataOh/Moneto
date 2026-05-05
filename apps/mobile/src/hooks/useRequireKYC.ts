import { useRouter } from "expo-router";
import { useCallback } from "react";

import { useAppStore } from "@stores/useAppStore";

export type KycLevel = 0 | 1 | 2 | 3;

export interface RequireKycResult {
  /** True si el `profile.kycLevel` actual es ≥ `minLevel`. */
  isAllowed: boolean;
  /** Status crudo del profile (`none | pending | approved | rejected`). */
  kycStatus: "none" | "pending" | "approved" | "rejected";
  /** Level actual del user (puede ser 0 si nunca completó KYC). */
  currentLevel: KycLevel;
  /** Navega al modal `/kyc` con el `target_level` requerido. */
  requireUpgrade: () => void;
  /** True si hay un KYC en review (status pending). UI puede mostrar
   *  "verificación en progreso" en lugar de "comenzar verificación". */
  isPending: boolean;
}

/**
 * Hook para gating de operaciones que requieren un nivel mínimo de KYC.
 *
 * Limites operativos por level (alineados con `moneto-compliance-stance.md`):
 * - **0** — $200 lifetime (default post-signup, sin KYC).
 * - **1** — $2K/mes (documento + selfie verified).
 * - **2** — $10K/mes (+ comprobante domicilio + liveness).
 * - **3** — sin límite, manual review en >$50K (+ source of funds).
 *
 * @example
 *   function SendScreen() {
 *     const kyc = useRequireKYC(1);
 *
 *     const handleSend = () => {
 *       if (amountUsd > 200 && !kyc.isAllowed) {
 *         kyc.requireUpgrade(); // navega a /kyc?target_level=1
 *         return;
 *       }
 *       // proceed con send...
 *     };
 *   }
 */
export function useRequireKYC(minLevel: KycLevel): RequireKycResult {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);

  const requireUpgrade = useCallback(() => {
    router.push({
      pathname: "/(modals)/kyc",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- expo-router typed routes son strict, target_level es param custom
      params: { target_level: String(minLevel) },
    } as never);
  }, [router, minLevel]);

  return {
    isAllowed: profile.kycLevel >= minLevel,
    kycStatus: profile.kycStatus,
    currentLevel: profile.kycLevel,
    isPending: profile.kycStatus === "pending",
    requireUpgrade,
  };
}
