import { KYC_LIMITS_USD } from "@moneto/config";
import { createLogger } from "@moneto/utils";

const log = createLogger("compliance");

export type KycLevel = 0 | 1 | 2 | 3;

/**
 * Hooks downstream que se disparan cuando el KYC level de un user cambia.
 *
 * Sprint 1.04: stubs con logging — implementación real llega en sprints
 * que tienen el código de los rails:
 *
 * - **Cashouts** → Sprint 6 (Bold rails Colombia + multi-país).
 * - **Card limits** → Sprint 9 (Rain card issuance + auth limits).
 * - **AML screening** → Sprint 7 (Chainalysis address screening).
 *
 * Cada función es **idempotent** — pueden ser invocadas múltiples veces
 * con el mismo resultado (e.g., webhook duplicado).
 */
export async function unlockUserOperations(userId: string, newLevel: KycLevel): Promise<void> {
  log.info("kyc level upgraded — unlocking ops", {
    userId,
    newLevel,
    monthlyCapUsd: KYC_LIMITS_USD[newLevel].monthly,
  });

  if (newLevel >= 1) await enableCashouts(userId, newLevel);
  if (newLevel >= 2) await enableLargeCashouts(userId);
  if (newLevel >= 3) await enableUnlimitedCashouts(userId);
}

async function enableCashouts(userId: string, level: KycLevel): Promise<void> {
  // TODO Sprint 6: configurar Bold rail per user. Por ahora solo log
  // — el cap se enforce en cada send via `KYC_LIMITS_USD`.
  log.info("cashouts enabled", {
    userId,
    level,
    monthlyCapUsd: KYC_LIMITS_USD[level].monthly,
  });
}

async function enableLargeCashouts(userId: string): Promise<void> {
  // TODO Sprint 6: levantar travel-rule alert para cashouts >$1K (que
  // requieren reportar contraparte a regulador).
  log.info("large cashouts enabled (travel rule applies >$1K)", { userId });
}

async function enableUnlimitedCashouts(userId: string): Promise<void> {
  // TODO Sprint 6: manual review queue para cashouts >$50K. Sprint 9
  // los liga a notificaciones para compliance officer.
  log.info("unlimited cashouts enabled (manual review >$50K)", { userId });
}

/**
 * Notifica al compliance officer ante eventos críticos:
 * - KYC declined.
 * - AML hit (sanctions match).
 * - SAR trigger (suspicious activity).
 *
 * Sprint 7+ wirea Slack webhook + email. Por ahora log + Sentry tag.
 */
export async function alertComplianceOfficer(
  userId: string,
  reason: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  log.error("compliance alert", {
    userId,
    reason,
    // `context` debe estar pre-scrub-eado por el caller.
    context,
  });
  // TODO Sprint 7: Slack webhook + email a compliance@moneto.xyz.
  // TODO Sprint 7: Sentry capture con tag `compliance_alert: true`.
}

/**
 * Resuelve el cap mensual operativo (USD) según el nivel de KYC.
 * Usado en send/cashout handlers para validar pre-tx.
 *
 * @example
 *   const cap = monthlyCapForLevel(profile.kycLevel);
 *   if (amountUsd > cap) throw new HTTPException(403, { message: "kyc_required" });
 */
export function monthlyCapForLevel(level: KycLevel): number {
  return KYC_LIMITS_USD[level].monthly;
}

/**
 * True si la operación sube el monto operativo del mes y excede el cap.
 * `accumulatedUsd` es lo que ya gastó el user este mes (server tracking).
 */
export function exceedsCap(
  level: KycLevel,
  accumulatedUsdThisMonth: number,
  newAmountUsd: number,
): boolean {
  const cap = monthlyCapForLevel(level);
  if (cap === Infinity) return false;
  return accumulatedUsdThisMonth + newAmountUsd > cap;
}
