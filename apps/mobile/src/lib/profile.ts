import { createLogger } from "@moneto/utils";
import { type PrivyUser } from "@privy-io/expo";

const log = createLogger("profile");

const SUPABASE_URL = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";

export interface SyncProfileInput {
  /** Privy user — para extraer email/name fallback. */
  user: PrivyUser;
  /** Token JWT de Privy del user actual (Bearer). */
  token: string;
  /** Country ISO 3166-1 alpha-2 (ej "CO"). Detected separately. */
  countryCode: string;
  /** Optional handle override (default: derived from email/random). */
  handle?: string;
  /** Optional phone E.164 (será encriptado server-side). */
  phone?: string;
}

export type SyncProfileResult =
  | { ok: true; userId: string }
  | { ok: false; error: SyncProfileErrorCode; status: number };

export type SyncProfileErrorCode =
  | "missing_token"
  | "supabase_url_missing"
  | "network"
  | "unauthorized"
  | "handle_taken"
  | "validation"
  | "server"
  | "unknown";

/**
 * Llama al edge function `sync-profile` con el JWT de Privy + datos de
 * profile. Idempotent — repetir el call con los mismos datos no falla.
 *
 * Llamado típicamente desde `auth.tsx > handleSuccess` después de que
 * `usePrivyAuthSync` reporta authState = `authenticated`.
 *
 * @example
 *   const token = await getAccessToken();
 *   const result = await syncProfileToSupabase({
 *     user, token, countryCode: "CO",
 *   });
 *   if (!result.ok && result.error === "handle_taken") {
 *     // prompt user to pick a different handle
 *   }
 */
export async function syncProfileToSupabase(input: SyncProfileInput): Promise<SyncProfileResult> {
  if (!input.token) {
    return { ok: false, error: "missing_token", status: 0 };
  }
  if (!SUPABASE_URL) {
    log.warn("EXPO_PUBLIC_SUPABASE_URL not set — skipping profile sync");
    return { ok: false, error: "supabase_url_missing", status: 0 };
  }

  const handle = input.handle ?? deriveHandle(input.user);
  const name = extractDisplayName(input.user);

  const url = `${SUPABASE_URL}/functions/v1/sync-profile`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        country_code: input.countryCode,
        ...(name ? { name } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      }),
    });
  } catch (err) {
    log.warn("sync-profile network error", { err: String(err) });
    return { ok: false, error: "network", status: 0 };
  }

  if (response.ok) {
    const data = (await response.json()) as { ok: boolean; user_id: string };
    log.info("profile synced", { userId: data.user_id });
    return { ok: true, userId: data.user_id };
  }

  const code = mapHttpStatus(response.status);
  log.warn("sync-profile failed", { status: response.status, code });
  return { ok: false, error: code, status: response.status };
}

function mapHttpStatus(status: number): SyncProfileErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 409) return "handle_taken";
  if (status === 400) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * Extrae un handle por defecto del Privy user.
 * Preferencias en orden:
 * 1. Email local-part (`maria@...` → `maria`).
 * 2. OAuth username (Apple/Google).
 * 3. Random fallback (`user_<6-char>`).
 *
 * El user puede cambiar el handle más tarde en settings (Sprint 2+).
 */
function deriveHandle(user: PrivyUser): string {
  const email = findEmail(user);
  if (email) {
    const local = email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (local && local.length >= 3) return local.slice(0, 32);
  }

  const oauth = findOAuthUsername(user);
  if (oauth) {
    const cleaned = oauth.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleaned.length >= 3) return cleaned.slice(0, 32);
  }

  // Random fallback — short to keep URLs / mentions tidy.
  const rand = Math.random().toString(36).slice(2, 8);
  return `user_${rand}`;
}

/**
 * Extrae un display name del Privy user (Apple/Google name claim).
 * Retorna null si no hay (no fallback to email — eso es PII separada).
 */
function extractDisplayName(user: PrivyUser): string | null {
  // PrivyUser tiene linked_accounts variando por SDK version. Duck typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape varía
  const accounts = (user as any).linked_accounts as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(accounts)) return null;
  for (const acc of accounts) {
    const type = acc["type"];
    if (type === "google_oauth" || type === "apple_oauth") {
      const name = acc["name"];
      if (typeof name === "string" && name.length > 0) return name.slice(0, 120);
    }
  }
  return null;
}

function findEmail(user: PrivyUser): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (user as any).linked_accounts as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(accounts)) return null;
  for (const acc of accounts) {
    if (acc["type"] === "email" && typeof acc["address"] === "string") {
      return acc["address"];
    }
    if (
      (acc["type"] === "google_oauth" || acc["type"] === "apple_oauth") &&
      typeof acc["email"] === "string"
    ) {
      return acc["email"];
    }
  }
  return null;
}

function findOAuthUsername(user: PrivyUser): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (user as any).linked_accounts as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(accounts)) return null;
  for (const acc of accounts) {
    const type = acc["type"];
    if (type === "google_oauth" || type === "apple_oauth") {
      const username = acc["username"] ?? acc["subject"];
      if (typeof username === "string") return username;
    }
  }
  return null;
}
