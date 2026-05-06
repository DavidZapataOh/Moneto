import { createLogger } from "@moneto/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
// eslint-disable-next-line import/no-named-as-default -- expo-constants exports `Constants` as default + named
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { type ApiClient } from "@/lib/api";

const log = createLogger("push.client");

/**
 * Push notifications setup — Sprint 4.01 + 4.04.
 *
 * Sprint 4.01 cubrió: permission flow, single channel, POST de token al
 * backend, foreground handler.
 *
 * Sprint 4.04 agrega:
 * - **3 Android channels** (default / compliance / marketing) con
 *   importance + vibration + bypassDnD apropiado per category.
 * - **Token rotation**: AsyncStorage tracking de `tokenRegisteredAt`
 *   force-refresh si > 30 días.
 * - **app_version**: enviamos el semver actual al backend para roll-out
 *   condicional de features.
 * - **Silent flag**: el foreground handler honra `data.silent === "true"`
 *   suprimiendo banner/sound (útil para compliance pings durante un
 *   user flow activo).
 *
 * **Failure modes (4.01)**:
 * - Permission denied → no-op silent.
 * - Simulator → skip (Expo no emite tokens en simulators).
 * - Network error → log, no throw. Próximo mount re-intenta.
 */

// Keys con prefix `moneto.` — coincide con `STORAGE_PREFIX` en `lib/auth.ts`
// para que el logout cleanup los borre automáticamente.
const TOKEN_REGISTERED_AT_KEY = "moneto.push.tokenRegisteredAt";
const TOKEN_VALUE_KEY = "moneto.push.tokenValue";
const TOKEN_ROTATION_DAYS = 30;

export type PushChannelId = "default" | "compliance" | "marketing";

/**
 * Configuración global del handler de notificaciones recibidas mientras
 * la app está foregrounded. Llamar UNA vez al boot.
 *
 * Sprint 4.04: honra `data.silent === "true"` para suprimir banner+sound.
 * Útil cuando el server emite un compliance ping pasivo durante un swap
 * activo del user — la notification queda en el list/lockscreen pero no
 * interrumpe.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      const isSilent = data?.["silent"] === "true" || data?.["silent"] === true;
      return {
        shouldShowAlert: !isSilent,
        shouldPlaySound: !isSilent,
        shouldSetBadge: true,
        shouldShowBanner: !isSilent,
        // Lista (Notification Center) sigue mostrando — el silent solo
        // suprime el banner activo y sonido, el user puede revisar después.
        shouldShowList: true,
      };
    },
  });
}

/**
 * Setup de los 3 channels Android. Idempotent — `setNotificationChannelAsync`
 * sobreescribe la config si el channel ya existe (no error). Llamado
 * dentro de `registerForPushNotifications` ANTES del `getExpoPushTokenAsync`.
 *
 * Channels (match al backend `PushChannelId`):
 * - `default` — incoming transfers, p2p, swap. HIGH importance, vibration.
 * - `compliance` — recovery requests, fraud alerts. MAX importance + bypass DnD.
 * - `marketing` — novedades, promos. LOW importance, no vibration.
 */
async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Notificaciones",
    description: "Movimientos en tu cuenta y confirmaciones de pago.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 240, 120, 240],
    lightColor: "#B5452B",
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("compliance", {
    name: "Alertas de seguridad",
    description: "Solicitudes de recuperación, alertas de fraude. No las silencies.",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: "#A8311A",
    sound: "default",
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync("marketing", {
    name: "Novedades",
    description: "Anuncios de nuevas funciones y promociones.",
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
    lightColor: "#7A6D54",
  });
}

export interface RegisterOptions {
  /** Si true, ignora cache de last-registered y fuerza un POST nuevo. */
  forceRefresh?: boolean;
}

/**
 * Pide permisos + registra el token en backend. Idempotent — safe de
 * llamar en cada login.
 *
 * Sprint 4.04: si el token cacheado tiene >30 días, force-refresh
 * (Expo rota tokens ocasionalmente; un re-register garantiza delivery).
 *
 * @returns el token registrado, o null si no fue posible.
 */
export async function registerForPushNotifications(
  api: ApiClient,
  options: RegisterOptions = {},
): Promise<string | null> {
  if (!Device.isDevice) {
    log.debug("not a physical device — skipping push registration");
    return null;
  }

  // 1. Request permission.
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    log.info("push permission denied");
    return null;
  }

  // 2. Setup Android channels — debe correr antes del token fetch para
  // que tokens nuevos asocien con channels válidos en algunos OEMs.
  await setupAndroidChannels();

  // 3. Get the Expo push token.
  const projectId =
    Constants.expoConfig?.extra?.["eas"]?.["projectId"] ?? Constants.easConfig?.projectId ?? null;
  if (!projectId) {
    log.warn("missing EAS projectId — cannot fetch push token");
    return null;
  }

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    token = tokenData.data;
  } catch (err) {
    log.warn("getExpoPushTokenAsync failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // 4. Token rotation gate — si tenemos cache reciente del MISMO token
  // y no force-refresh, skip el POST. Reduce ruido en cada cold start.
  if (!options.forceRefresh) {
    const fresh = await isTokenCacheFresh(token);
    if (fresh) {
      log.debug("push token cache fresh — skipping re-register");
      return token;
    }
  }

  // 5. POST al backend con `app_version` para roll-out condicional.
  const appVersion = Constants.expoConfig?.version;
  try {
    await api.post("/api/me/push-tokens", {
      token,
      platform: Platform.OS === "web" ? "web" : Platform.OS,
      ...(appVersion ? { app_version: appVersion } : {}),
    });
    await markTokenRegistered(token);
    log.debug("push token registered", {
      tokenPrefix: token.slice(0, 18),
      appVersion,
    });
    return token;
  } catch (err) {
    log.warn("push token registration failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Listener para taps en notificaciones recibidas (background o
 * killed-state). Llamar desde un componente top-level mounted post-auth.
 */
export function addNotificationResponseListener(
  handler: (data: Record<string, string>) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const raw = response.notification.request.content.data;
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      if (typeof value === "string") data[key] = value;
    }
    handler(data);
  });
  return () => subscription.remove();
}

/**
 * Estado del permission para que la UI pueda mostrar prompts/banners.
 * Sprint 4.04 — usado por `PushPermissionBanner`.
 */
export async function getPushPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

// ── Internal: token rotation cache ──────────────────────────────────────

async function isTokenCacheFresh(token: string): Promise<boolean> {
  try {
    const [cachedToken, registeredAt] = await Promise.all([
      AsyncStorage.getItem(TOKEN_VALUE_KEY),
      AsyncStorage.getItem(TOKEN_REGISTERED_AT_KEY),
    ]);
    // eslint-disable-next-line security/detect-possible-timing-attacks -- comparación local de Expo push token (no secret), no remote attacker surface.
    if (cachedToken !== token) return false;
    if (!registeredAt) return false;
    const ageMs = Date.now() - Number(registeredAt);
    if (!Number.isFinite(ageMs)) return false;
    return ageMs < TOKEN_ROTATION_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

async function markTokenRegistered(token: string): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_VALUE_KEY, token),
      AsyncStorage.setItem(TOKEN_REGISTERED_AT_KEY, String(Date.now())),
    ]);
  } catch (err) {
    // Cache write failure es non-fatal — el next mount lo retry.
    log.debug("token cache write failed", { err: String(err) });
  }
}

/**
 * Limpia el cache local del token. Llamar desde `performLogoutCleanup`
 * para asegurar que el próximo login force-registre con un token fresco.
 */
export async function clearPushTokenCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_VALUE_KEY, TOKEN_REGISTERED_AT_KEY]);
  } catch {
    // Best-effort.
  }
}
