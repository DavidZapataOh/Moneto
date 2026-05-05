/**
 * Webhook authentication helpers — Sprint 4.01 (Helius incoming) y
 * downstream (Persona KYC, Bridge, etc.).
 *
 * Helius soporta dos formas de auth en webhooks:
 * 1. **Authorization header simple** — un secret fijo. Usado en Sprint 4.01
 *    porque el Helius dashboard hoy solo expone esta opción.
 * 2. **HMAC-SHA256 sobre body** — más seguro (cubre tampering), pero
 *    requiere setup manual del receiving endpoint que valida el header.
 *    Lo dejamos implementado para cuando expandamos a Persona / Stripe.
 *
 * Usamos `crypto.subtle` (Web Crypto) en Cloudflare Workers — no Node `crypto`.
 */

/**
 * Constant-time comparison para evitar timing attacks. Standard
 * library no expone un built-in, así que rolleamos uno mínimo.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Auth simple por header — Helius default. Compara el `Authorization`
 * header recibido contra el secret esperado, constant-time.
 *
 * @returns true si el header matchea, false sino. NO throw — el caller
 *   decide si responder 401.
 */
export function verifyHeaderAuth(headerValue: string | undefined, secret: string): boolean {
  if (!headerValue || !secret) return false;
  return constantTimeEqual(headerValue, secret);
}

/**
 * Verifica HMAC-SHA256(body, secret) contra el header recibido.
 *
 * Convención: el sender computa `hex(hmac_sha256(body, secret))` y lo
 * pone en el `X-Signature` header (o similar). Acá replicamos el cómputo
 * y constant-time-comparamos.
 *
 * @param body  Raw body como string (NO parseado — el sender firma bytes).
 * @param signatureHeader Hex-encoded HMAC del sender.
 * @param secret Shared secret (solo conocido entre sender + receiver).
 */
export async function verifyHmacSignature(
  body: string,
  signatureHeader: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computedHex = Array.from(new Uint8Array(sigBytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

  // Helius firma con `sha256=<hex>` prefix en algunos endpoints.
  const normalizedHeader = signatureHeader.replace(/^sha256=/, "").toLowerCase();
  return constantTimeEqual(computedHex, normalizedHeader);
}
