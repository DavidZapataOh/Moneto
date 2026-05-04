/**
 * PII / financial-data scrubber.
 *
 * Sentry, Axiom, PostHog y cualquier sink futuro pasan el payload por aquí
 * ANTES de mandarlo. Pure / sin side effects / testable.
 *
 * Filosofía: **lista de allow no lista de deny**. Cuando agregamos un campo
 * nuevo al payload tenemos que decidir conscientemente si va o no — el
 * default es scrub. Esto evita drift cuando un dev nuevo agrega
 * `transaction.amount` a un breadcrumb sin pensar.
 *
 * Reglas duras (NUNCA salen del device/server):
 * - Montos (`amount`, `balance`, `delta`, `value`, `usd`, etc.)
 * - Wallet addresses + transaction signatures de Solana
 * - Viewing keys, private keys, seed phrases
 * - JWT tokens, OAuth tokens, refresh tokens, API keys
 * - Email, phone, KYC docs, foto selfie URLs
 * - Counterparty info (`counterparty`, `recipient`, `to`, `from` cuando son humanos)
 *
 * Permitido:
 * - `userId` (Privy DID — pseudónimo, no PII directa)
 * - `country`, `kyc_level`, `app_version` — buckets analíticos
 * - `screen`, `route`, `tx_type`, `error_code` — categorical
 * - `duration_ms`, `count`, `index` — métricas no PII
 */

const FINANCIAL_KEYS = new Set([
  "amount",
  "amount_usd",
  "amount_local",
  "amounts",
  "balance",
  "balances",
  "available",
  "delta",
  "value",
  "usd",
  "cop",
  "mxn",
  "ars",
  "brl",
  "fee",
  "total",
  "subtotal",
  "yield",
  "apy",
  "interest",
  "principal",
]);

const PII_KEYS = new Set([
  "email",
  "phone",
  "phone_number",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "handle",
  "address",
  "ip",
  "ip_address",
  "user_agent",
  "ua",
  "country_code", // bucket OK si es analytics; en logs/breadcrumbs scrub
  "city",
  "zip",
  "postal_code",
  "dob",
  "birthdate",
  "ssn",
  "tax_id",
  "rut",
  "cedula",
  "selfie_url",
  "doc_url",
  "kyc_doc",
]);

const WALLET_KEYS = new Set([
  "wallet_address",
  "address", // overlap intencional con PII (dual meaning)
  "pubkey",
  "public_key",
  "private_key",
  "secret_key",
  "seed",
  "seed_phrase",
  "mnemonic",
  "viewing_key",
  "viewingKey",
  "spend_key",
  "scan_key",
  "signature",
  "tx_signature",
  "tx_hash",
  "transaction",
  "transaction_signature",
  "counterparty",
  "counterparty_address",
  "counterpartyAddress",
  "recipient",
  "recipient_address",
  "from_address",
  "to_address",
  "to",
  "from",
]);

const AUTH_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "jwt",
  "bearer",
  "authorization",
  "auth",
  "session",
  "session_token",
  "api_key",
  "apiKey",
  "secret",
  "password",
  "passphrase",
  "pin",
  "otp",
  "code",
]);

const SCRUB_KEYS = new Set([...FINANCIAL_KEYS, ...PII_KEYS, ...WALLET_KEYS, ...AUTH_KEYS]);

/**
 * Solana address — base58 32-44 chars (rangos típicos: 32 byte pubkeys
 * codifican a 43-44 chars, 64-byte signatures a 88 chars).
 */
const SOLANA_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,88}\b/g;

/** UUID v4. */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** Email. */
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** JWT (header.payload.signature). */
const JWT_RE = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;

/** Phone — E.164 (+57 300 123 4567 con/sin espacios). */
const PHONE_RE = /\+?\d[\d\s\-().]{8,}\d/g;

/** Reemplaza un value por placeholder según el key. */
function placeholderFor(key: string): string {
  const k = key.toLowerCase();
  if (FINANCIAL_KEYS.has(k)) return "[amount]";
  if (WALLET_KEYS.has(k)) return "[address]";
  if (AUTH_KEYS.has(k)) return "[secret]";
  if (PII_KEYS.has(k)) return "[pii]";
  return "[scrubbed]";
}

/**
 * Scrub un string libre — substring matches sobre patrones conocidos.
 *
 * Útil para mensajes de log, breadcrumbs, error messages, URLs.
 */
export function scrubString(input: string): string {
  if (!input) return input;
  return input
    .replace(EMAIL_RE, "[email]")
    .replace(JWT_RE, "[jwt]")
    .replace(SOLANA_ADDRESS_RE, "[address]")
    .replace(UUID_RE, "[uuid]")
    .replace(PHONE_RE, "[phone]");
}

/**
 * Scrub recursivo de un object/array — keys sensibles → placeholder,
 * strings → `scrubString`. Preserva shape (logs siguen siendo
 * queryable por keys) sin filtrar values.
 *
 * Cap de profundidad para evitar recursión infinita (referencias circulares).
 */
export function scrubObject<T = unknown>(
  input: T,
  options: { maxDepth?: number } = {},
  _depth = 0,
): T {
  const maxDepth = options.maxDepth ?? 8;
  if (_depth > maxDepth) return "[max-depth]" as unknown as T;
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    return scrubString(input) as unknown as T;
  }

  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => scrubObject(item, options, _depth + 1)) as unknown as T;
  }

  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SCRUB_KEYS.has(key.toLowerCase())) {
        out[key] = placeholderFor(key);
      } else {
        out[key] = scrubObject(value, options, _depth + 1);
      }
    }
    return out as unknown as T;
  }

  return input;
}

/**
 * Sentry `beforeSend` hook. Scrubs message, exception values, request
 * data, breadcrumbs, extra, contexts. Returns the modified event or
 * `null` para descartar (e.g., si el error es noise conocido).
 *
 * @example
 *   Sentry.init({ dsn, beforeSend: scrubSentryEvent });
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  return scrubObject(event);
}

/**
 * Re-export para tests / inspección — los sets son frozen para evitar mutación.
 */
export const SCRUB_KEY_SETS = Object.freeze({
  financial: FINANCIAL_KEYS,
  pii: PII_KEYS,
  wallet: WALLET_KEYS,
  auth: AUTH_KEYS,
  all: SCRUB_KEYS,
});
