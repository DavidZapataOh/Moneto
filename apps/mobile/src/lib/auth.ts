import { createLogger } from "@moneto/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { useAppStore } from "@stores/useAppStore";
import { useThemeStore } from "@stores/useThemeStore";

import { resetApiClient } from "./api";
import { resetUser } from "./observability";
import { queryClient } from "./query-client";
import { resetSupabaseClient } from "./supabase";

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

// ───────────────────────────────────────────────────────────────────────────
// Logout cleanup
// ───────────────────────────────────────────────────────────────────────────
//
// Threat model: device sharing. User A logout → user B login en mismo device
// → cero residuo de A visible (balance, viewing keys, profile, theme cache,
// in-memory caches). Cualquier breach acá es un privacy bug serio.
//
// Filosofía:
// - Cada stage es independiente y try/catch'd. Una falla NO aborta el resto;
//   un cleanup parcial es preferible a quedar logueado.
// - El navigation a /(onboarding) es responsabilidad del CALLER (hook o
//   sync), porque depende del expo-router context que solo existe en runtime
//   React. Esta función pura es testeable sin mocking de router.

/**
 * Prefijo de toda key que escribimos a AsyncStorage. El logout borra todas
 * las keys con este prefijo — defensivo contra stores futuros que olvidemos
 * añadir a la lista explícita.
 */
const STORAGE_PREFIX = "moneto.";

/**
 * Keys que el logout NO debe borrar. `moneto.onboarding` (futuro) tracker
 * del intro completado vive per-device, no per-session.
 *
 * Hoy sólo `moneto.theme` califica — pero su contenido sí se reescribe a
 * defaults via `useThemeStore.setState`. La key se preserva para que persist
 * versioning siga funcionando en el próximo mount.
 */
const STORAGE_PRESERVE: ReadonlySet<string> = new Set<string>([]);

/**
 * Resultado estructurado del cleanup. El caller (`useLogout`) decide qué
 * hacer con `partialFailure: true` (logueamos pero no bloqueamos navigation).
 */
export interface LogoutResult {
  /** True si TODOS los stages corrieron sin throw. */
  ok: boolean;
  /** Stage donde falló (si aplicable). */
  failedAt: LogoutStage | null;
  /** Tiempo total del cleanup en ms — gate de performance del plan: <1s. */
  durationMs: number;
  /** Stages que corrieron OK — útil para logs/Sentry breadcrumb. */
  completedStages: LogoutStage[];
}

export type LogoutStage = "privy" | "stores" | "asyncstorage" | "singletons" | "analytics";

interface LogoutDeps {
  /**
   * Función que llama a `usePrivy().logout` desde el componente que sabe
   * del PrivyProvider. El logout pure no puede usar el hook directo.
   */
  privyLogout: () => Promise<void>;
}

/**
 * Cleanup end-to-end del estado de sesión. Pure function — sin React,
 * sin router, sin hooks. El caller hace navigation post-cleanup.
 *
 * **Orden de stages** (importante por dependencias):
 *
 * 1. **privy** — revoca el server-side token. Si falla (token expirado),
 *    seguimos: el cleanup local sigue siendo correcto.
 * 2. **stores** — Zustand reset. Después de esto, cualquier component que
 *    re-render leerá defaults (no datos del user previo).
 * 3. **asyncstorage** — borra todas las keys `moneto.*` excepto las
 *    explícitamente preservadas. Defensivo contra stores futuros.
 * 4. **singletons** — invalida los caches in-memory de api + supabase
 *    clients (token cacheado, client instance, JWKS, etc).
 * 5. **analytics** — `posthog.reset()` + `Sentry.setUser(null)`. Crítico
 *    para evitar que events post-logout se atribuyan al user previo.
 *
 * Nunca throw — siempre retorna `LogoutResult` describiendo qué pasó.
 */
export async function performLogoutCleanup(deps: LogoutDeps): Promise<LogoutResult> {
  const start = Date.now();
  const completed: LogoutStage[] = [];
  let failedAt: LogoutStage | null = null;

  // Breadcrumb temprano — si el cleanup crash-ea, el siguiente Sentry
  // event mostrará que estábamos en logout.
  Sentry.addBreadcrumb({
    category: "auth",
    type: "default",
    level: "info",
    message: "logout started",
  });

  // ── Stage 1: Privy ────────────────────────────────────────────────────
  try {
    await deps.privyLogout();
    completed.push("privy");
  } catch (err) {
    // Token expirado es el caso típico. Privy dispara error pero el server
    // ya no tiene sesión válida → continúa local.
    log.warn("privy logout failed (continuing cleanup)", { err: String(err) });
    failedAt ??= "privy";
  }

  // ── Stage 2: Zustand stores ───────────────────────────────────────────
  try {
    useAppStore.getState().reset();
    useThemeStore.setState({
      preference: "system",
      syncedToRemote: false,
      lastSyncAt: null,
    });
    completed.push("stores");
  } catch (err) {
    log.error("store reset failed", { err: String(err) });
    failedAt ??= "stores";
  }

  // ── Stage 3: AsyncStorage ─────────────────────────────────────────────
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(
      (k) => k.startsWith(STORAGE_PREFIX) && !STORAGE_PRESERVE.has(k),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
    completed.push("asyncstorage");
  } catch (err) {
    log.error("asyncstorage clear failed", { err: String(err) });
    failedAt ??= "asyncstorage";
  }

  // ── Stage 4: Singletons (api + supabase clients, token caches,
  //              React Query cache) ────────────────────────────────────
  // Crítico: invalidar React Query queries cancela in-flight fetches y
  // borra balance/txs/etc del cache. Si no, el siguiente user
  // (device sharing) podría ver un flash del balance previo antes del
  // refetch.
  try {
    resetApiClient();
    resetSupabaseClient();
    queryClient.cancelQueries();
    queryClient.clear();
    completed.push("singletons");
  } catch (err) {
    log.error("singleton reset failed", { err: String(err) });
    failedAt ??= "singletons";
  }

  // ── Stage 5: Analytics ────────────────────────────────────────────────
  try {
    resetUser();
    completed.push("analytics");
  } catch (err) {
    log.warn("analytics reset failed", { err: String(err) });
    failedAt ??= "analytics";
  }

  const durationMs = Date.now() - start;
  const ok = failedAt === null;

  log.info("logout cleanup complete", {
    ok,
    failedAt,
    durationMs,
    completedCount: completed.length,
  });

  Sentry.addBreadcrumb({
    category: "auth",
    type: "default",
    level: ok ? "info" : "warning",
    message: "logout finished",
    data: { ok, failedAt, durationMs },
  });

  // Si hubo falla en algún stage no-trivial (no Privy), reportamos a Sentry
  // como warning — Privy expired es ruido conocido, lo otro merece atención.
  if (failedAt !== null && failedAt !== "privy") {
    Sentry.captureMessage(`logout partial failure at ${failedAt}`, {
      level: "warning",
      tags: { logout_failed_stage: failedAt },
    });
  }

  return { ok, failedAt, durationMs, completedStages: completed };
}
