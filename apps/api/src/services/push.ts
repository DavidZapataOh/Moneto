import { createLogger } from "@moneto/utils";
import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@moneto/db";

const log = createLogger("push");

/**
 * Expo Push API client. Doc:
 * https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * Workers no tiene SDK oficial — usamos `fetch` directo. La API soporta
 * batching hasta 100 mensajes por request.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Sound default — iOS lo necesita explicit para el banner-with-sound. */
  sound?: "default";
  /** Channel Android — debe matchear el setup mobile-side (Sprint 4.01). */
  channelId?: string;
  /** TTL en segundos. Para incoming_transfer un short TTL evita stale notifs. */
  ttl?: number;
  /** Priority mobile — high = wake up el device. */
  priority?: "default" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

export interface SendPushInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushService {
  sendToUser(input: SendPushInput): Promise<{ delivered: number }>;
}

/**
 * Crea un PushService que mira `push_tokens` de Supabase (filtrando
 * tokens invalidados) y dispatcha a Expo. Failures por token específico
 * (DeviceNotRegistered, etc.) marcan ese token como `invalidated_at`
 * para no re-intentar.
 */
export function createPushService(supabase: SupabaseClient<Database>): PushService {
  return {
    async sendToUser({ userId, title, body, data }: SendPushInput) {
      // 1. Lookup tokens activos del user.
      const { data: tokens, error } = await supabase
        .from("push_tokens")
        .select("token, platform")
        .eq("user_id", userId)
        .is("invalidated_at", null);

      if (error) {
        log.error("push token lookup failed", { code: error.code });
        return { delivered: 0 };
      }
      if (!tokens || tokens.length === 0) {
        log.debug("no active push tokens for user", { userId });
        return { delivered: 0 };
      }

      // 2. Build Expo messages.
      const messages: ExpoPushMessage[] = tokens.map((t) => ({
        to: t.token,
        title,
        body,
        sound: "default",
        priority: "high",
        ttl: 3600, // 1h — incoming transfer es time-sensitive pero no real-time-critical.
        ...(data ? { data } : {}),
        ...(t.platform === "android" ? { channelId: "default" } : {}),
      }));

      // 3. POST batch a Expo. Si Expo rechaza el body entero (5xx),
      // logueamos y retornamos 0 — no hay nada que reintentar inline.
      let res: Response;
      try {
        res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });
      } catch (err) {
        log.warn("expo push fetch failed", { err: String(err) });
        return { delivered: 0 };
      }

      if (!res.ok) {
        log.warn("expo push non-2xx", { status: res.status });
        return { delivered: 0 };
      }

      let parsed: ExpoPushResponse;
      try {
        parsed = (await res.json()) as ExpoPushResponse;
      } catch {
        log.warn("expo push response not json");
        return { delivered: 0 };
      }

      // 4. Process tickets — invalidate tokens que Expo rechazó.
      let delivered = 0;
      const invalidate: string[] = [];
      parsed.data.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          delivered += 1;
        } else if (ticket.status === "error") {
          const errorCode = ticket.details?.error;
          // `DeviceNotRegistered` = uninstall / token rotated. El resto
          // (MessageTooBig, MessageRateExceeded) los retry-amos en una
          // próxima llamada — no invalidamos.
          if (errorCode === "DeviceNotRegistered") {
            const t = messages[idx]?.to;
            if (t) invalidate.push(t);
          }
          log.warn("push ticket error", { errorCode, message: ticket.message });
        }
      });

      if (invalidate.length > 0) {
        const { error: invErr } = await supabase
          .from("push_tokens")
          .update({ invalidated_at: new Date().toISOString() })
          .in("token", invalidate);
        if (invErr) {
          log.warn("invalidation update failed", { code: invErr.code });
        }
      }

      return { delivered };
    },
  };
}
