import { createLogger } from "@moneto/utils";
// eslint-disable-next-line import/no-named-as-default -- expo-constants exports `Constants` as default + named
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { type ApiClient } from "@/lib/api";

const log = createLogger("push.client");

/**
 * Push notifications setup — Sprint 4.01.
 *
 * Flow:
 * 1. Mobile request permissions (iOS + Android 13+).
 * 2. Si granted → fetch Expo push token via `getExpoPushTokenAsync`.
 * 3. POST `/api/me/push-tokens` con `{ token, platform }`. El server
 *    también bindea wallet → user_id en `wallet_index` para que el
 *    Helius webhook pueda routear transferencias.
 *
 * **Failure modes**:
 * - Permission denied → no-op silent. El user puede habilitar manualmente
 *   en settings; sprint 4.05 (notification preferences) le deja toggle.
 * - Simulator → `Device.isDevice === false` → skip (Expo no emite
 *   tokens en simulators).
 * - Network error en el POST → log, no throw. Próximo mount re-intenta.
 *
 * **Idempotency**: el server `POST /api/me/push-tokens` es upsert por
 * token. Multiple calls con el mismo token = no-op semánticamente.
 */

/**
 * Configuración global del handler de notificaciones recibidas mientras
 * la app está foregrounded. Llamar UNA vez al boot (en `bootObservability`
 * o `_layout.tsx`).
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      // SDK 54+ split de banner+list para iOS — true en ambos da el
      // comportamiento "default" pre-split.
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Pide permisos + registra el token en backend. Idempotent — safe de
 * llamar en cada login.
 *
 * @returns el token registrado, o null si no fue posible (permiso
 *   denegado, simulator, network error).
 */
export async function registerForPushNotifications(api: ApiClient): Promise<string | null> {
  if (!Device.isDevice) {
    log.debug("not a physical device — skipping push registration");
    return null;
  }

  // 1. Request permission. iOS pide UNA vez por install; Android <13 no
  // requiere prompt; Android 13+ requiere permission via POST_NOTIFICATIONS.
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

  // 2. Android: setup channel ANTES de getExpoPushTokenAsync. Sin canal,
  // las notifs llegan pero sin sound/vibration en algunos OEMs.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Notificaciones",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 240, 120, 240],
      // Color de luz LED en Pixels — terracota (brand).
      lightColor: "#B5452B",
      sound: "default",
    });
  }

  // 3. Get the Expo push token. `projectId` requerido en SDK 49+ — viene
  // de `app.config` o `Constants.expoConfig.extra.eas.projectId`.
  const projectId =
    Constants.expoConfig?.extra?.["eas"]?.["projectId"] ?? Constants.easConfig?.projectId ?? null;
  if (!projectId) {
    log.warn("missing EAS projectId — cannot fetch push token");
    return null;
  }

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = tokenData.data;
  } catch (err) {
    log.warn("getExpoPushTokenAsync failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // 4. POST al backend. El server resuelve el wallet via Privy admin y
  // bindea wallet_index. Si retorna 409 `wallet_not_ready`, el wallet
  // todavía está creándose (race con createOnLogin) — el next mount
  // re-intenta.
  try {
    await api.post("/api/me/push-tokens", {
      token,
      platform: Platform.OS === "web" ? "web" : Platform.OS,
    });
    log.debug("push token registered", {
      tokenPrefix: token.slice(0, 18),
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
 * killed-state). Llamar desde un componente top-level mounted post-auth
 * — el callback recibe los `data` que el server envió.
 *
 * Setea up listener + retorna cleanup function.
 */
export function addNotificationResponseListener(
  handler: (data: Record<string, string>) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const raw = response.notification.request.content.data;
    // `data` viene tipado como `Record<string, unknown>` por la lib —
    // refinamos a string-only entries (lo que nuestro server envía).
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      if (typeof value === "string") data[key] = value;
    }
    handler(data);
  });
  return () => subscription.remove();
}
