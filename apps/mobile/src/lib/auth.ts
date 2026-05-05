import { createLogger } from "@moneto/utils";
import * as Sentry from "@sentry/react-native";
import * as LocalAuthentication from "expo-local-authentication";

const log = createLogger("auth");

/**
 * Auth method enum — matches el discriminator en Privy hooks.
 *
 * Mantener consistente con `Events.auth_method_selected` props
 * (`@moneto/observability/events`).
 */
export type AuthMethod = "passkey" | "apple" | "google";

/**
 * Mapeo de errores Privy/network/biometry → mensajes user-facing en español
 * + acción sugerida. Usar desde `auth.tsx` en el `onError` handler.
 *
 * Documentado en `plans/sprint-1-auth-wallet/01-privy-integration.md`
 * sección "Error handling matrix".
 */
export interface AuthErrorMapped {
  /** Mensaje user-facing (español, listo para Alert/Toast). */
  message: string;
  /** Si `true`, mostrar botón "Reintentar". Si `false`, solo "OK". */
  retryable: boolean;
  /** Opcional — auto-seleccionar método alterno (e.g., biometry → apple). */
  fallbackMethod?: AuthMethod;
  /** Tag para Sentry — discrimina el bucket del error. */
  errorCode: string;
}

export function mapAuthError(error: unknown, attemptedMethod: AuthMethod): AuthErrorMapped {
  const errMsg = error instanceof Error ? error.message : String(error);
  const lower = errMsg.toLowerCase();

  // Network — sin internet o DNS fail.
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    lower.includes("offline")
  ) {
    return {
      message: "Sin conexión. Verificá tu internet e intentá de nuevo.",
      retryable: true,
      errorCode: "network",
    };
  }

  // Privy service down (typical 5xx mensajes)
  if (lower.includes("server error") || lower.includes("500") || lower.includes("503")) {
    return {
      message: "El servicio está temporalmente no disponible. Intentá en unos segundos.",
      retryable: true,
      errorCode: "privy_down",
    };
  }

  // OAuth cancelled — el user dio "cancel" en el browser/sheet de OAuth.
  // No es un error real. UI debe NO mostrar alert, solo reset loading state.
  if (lower.includes("cancel") || lower.includes("dismiss") || lower.includes("user_cancel")) {
    return {
      message: "",
      retryable: false,
      errorCode: "user_cancelled",
    };
  }

  // Biometry — no hay hardware, o el user falló la autenticación.
  if (
    attemptedMethod === "passkey" &&
    (lower.includes("biometric") ||
      lower.includes("face id") ||
      lower.includes("touch id") ||
      lower.includes("passkey"))
  ) {
    if (lower.includes("not available") || lower.includes("no hardware")) {
      return {
        message: "Tu dispositivo no soporta biometría. Usá Apple o Google.",
        retryable: false,
        fallbackMethod: "apple",
        errorCode: "biometry_unavailable",
      };
    }
    return {
      message: "Autenticación falló. Intentá de nuevo.",
      retryable: true,
      errorCode: "biometry_failed",
    };
  }

  // Wallet creation timeout — Privy creó user pero el wallet Solana tarda.
  if (lower.includes("wallet") && lower.includes("timeout")) {
    return {
      message: "Tu cuenta se está terminando de configurar. Intentá en unos segundos.",
      retryable: true,
      errorCode: "wallet_timeout",
    };
  }

  // Default — error inesperado.
  return {
    message: "No pudimos completar el inicio. Intentá de nuevo.",
    retryable: true,
    errorCode: "unknown",
  };
}

/**
 * Reporta el error a Sentry con tags consistentes. Llamar SIEMPRE además
 * del UI feedback para que el equipo vea el incidente.
 *
 * Filtra el caso `user_cancelled` (no es un error real).
 */
export function reportAuthError(
  error: unknown,
  attemptedMethod: AuthMethod,
  mode: "signup" | "login",
): AuthErrorMapped {
  const mapped = mapAuthError(error, attemptedMethod);

  // No spam Sentry con cancelaciones de user — son flujo válido.
  if (mapped.errorCode === "user_cancelled") {
    log.info("auth cancelled by user", { method: attemptedMethod, mode });
    return mapped;
  }

  log.warn("auth failed", { method: attemptedMethod, mode, code: mapped.errorCode });

  Sentry.captureException(error, {
    tags: {
      auth_method: attemptedMethod,
      auth_mode: mode,
      auth_error_code: mapped.errorCode,
    },
  });

  return mapped;
}

/**
 * Verifica que el dispositivo tenga hardware de biometría + un método
 * enrolled. Llamar ANTES de intentar passkey login para fail-fast.
 *
 * @returns `true` si se puede usar passkey/biometry, `false` si no.
 */
export async function isBiometryAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (err) {
    log.warn("biometry probe failed", { err: String(err) });
    return false;
  }
}

/**
 * Polling helper para esperar que Privy cree el embedded Solana wallet
 * post-OAuth. La creation tarda 1-3s típico; usamos 10s timeout.
 *
 * Privy expone los wallets en `user.linked_accounts` — buscamos un
 * wallet con `chain_type === "solana"`.
 *
 * @param getWallet función que retorna el wallet actual (read del Privy state)
 * @returns address del wallet, o `null` si timeout
 */
export async function waitForSolanaWallet(
  getWallet: () => string | null,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const addr = getWallet();
    if (addr) return addr;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  log.warn("wallet creation timeout", { timeoutMs });
  return null;
}
