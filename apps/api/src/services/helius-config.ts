import { createLogger } from "@moneto/utils";

const log = createLogger("helius.config");

/**
 * Helius webhook config service. El Helius dashboard (o la API) define
 * un webhook con `accountAddresses: string[]` — la lista de wallets
 * que disparan eventos al endpoint `POST /webhooks/helius/incoming`.
 *
 * Cuando un Moneto user nuevo se autentica y bindea su wallet (vía
 * `POST /api/me/push-tokens`), automáticamente lo agregamos a esta
 * lista para que sus transferencias entrantes disparen el flow del
 * Sprint 4.01.
 *
 * Doc: https://docs.helius.dev/webhooks-and-websockets/api-reference
 *
 * **Idempotency**: Helius dedupea addresses internamente al PUT —
 * agregar la misma address dos veces no duplica el listening. Aún
 * así, leemos primero (`GET`) y solo PUT-eamos si la lista cambió,
 * para minimizar quota uso de Helius.
 *
 * **Failure handling**: este service NO debe bloquear el flow del user
 * (push token register). El caller debe usar `ctx.waitUntil()` o
 * fire-and-forget con catch silent. Si Helius falla, el user recibe
 * push notifications con delay (próximo backup poll del Sprint 8) o
 * cuando el ops team lo agregue manualmente.
 */

const HELIUS_API_BASE = "https://api.helius.xyz/v0";

export interface HeliusConfigEnv {
  /** API key de Helius — server-side only. */
  HELIUS_API_KEY?: string;
  /** ID del webhook configurado en Helius dashboard. */
  HELIUS_WEBHOOK_ID?: string;
}

interface HeliusWebhookConfig {
  webhookID: string;
  webhookURL: string;
  accountAddresses: string[];
  transactionTypes?: string[];
  webhookType?: "raw" | "enhanced";
  authHeader?: string;
}

/**
 * GET la config completa del webhook. Útil para reads idempotentes
 * (saber si una address ya está antes de PUT).
 */
export async function getWebhookConfig(env: HeliusConfigEnv): Promise<HeliusWebhookConfig | null> {
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) {
    log.debug("helius config not provisioned — skipping");
    return null;
  }

  const url = `${HELIUS_API_BASE}/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    log.warn("helius getWebhook network error", { err: String(err) });
    return null;
  }
  if (!res.ok) {
    log.warn("helius getWebhook non-2xx", { status: res.status });
    return null;
  }

  try {
    return (await res.json()) as HeliusWebhookConfig;
  } catch {
    log.warn("helius getWebhook invalid json");
    return null;
  }
}

/**
 * Agrega una `accountAddress` al webhook. Idempotent — si la address
 * ya está, retorna `{ added: false, total: N }` sin hacer PUT.
 *
 * Performance: 1 GET + 0-1 PUT. Latencia típica ~150-300ms p50. El
 * caller debe usar `ctx.waitUntil()` para no bloquear la response al
 * cliente.
 */
export async function addAddressToWebhook(
  address: string,
  env: HeliusConfigEnv,
): Promise<{ added: boolean; total: number } | null> {
  const config = await getWebhookConfig(env);
  if (!config) return null;

  if (config.accountAddresses.includes(address)) {
    return { added: false, total: config.accountAddresses.length };
  }

  const next = [...config.accountAddresses, address];
  const ok = await putAccountAddresses(next, env);
  if (!ok) return null;

  log.info("address added to helius webhook", {
    addressPrefix: address.slice(0, 8),
    totalCount: next.length,
  });
  return { added: true, total: next.length };
}

/**
 * Quita una address del webhook. Útil para soft-delete (user fully
 * uninstalled + push tokens invalidated). Sprint 4.01 no la llama
 * todavía — leave para Sprint 4.10 cleanup flow.
 */
export async function removeAddressFromWebhook(
  address: string,
  env: HeliusConfigEnv,
): Promise<{ removed: boolean; total: number } | null> {
  const config = await getWebhookConfig(env);
  if (!config) return null;

  if (!config.accountAddresses.includes(address)) {
    return { removed: false, total: config.accountAddresses.length };
  }

  const next = config.accountAddresses.filter((a) => a !== address);
  const ok = await putAccountAddresses(next, env);
  if (!ok) return null;

  log.info("address removed from helius webhook", {
    addressPrefix: address.slice(0, 8),
    totalCount: next.length,
  });
  return { removed: true, total: next.length };
}

async function putAccountAddresses(addresses: string[], env: HeliusConfigEnv): Promise<boolean> {
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) return false;

  const url = `${HELIUS_API_BASE}/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountAddresses: addresses }),
    });
  } catch (err) {
    log.error("helius putWebhook network error", { err: String(err) });
    return false;
  }

  if (!res.ok) {
    log.error("helius putWebhook non-2xx", { status: res.status });
    return false;
  }
  return true;
}
