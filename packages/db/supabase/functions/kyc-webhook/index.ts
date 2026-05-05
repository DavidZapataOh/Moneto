// Edge function — kyc-webhook
//
// Recibe webhooks de Persona después de que un user completa una inquiry
// (KYC). Verifica la firma HMAC, extrae el resultado, actualiza
// `profiles.kyc_level` + `kyc_status`, e inserta una row append-only en
// `kyc_audit_log` (compliance trail 7 años).
//
// Idempotency: `kyc_audit_log.persona_event_id` tiene UNIQUE constraint —
// webhook duplicado de Persona NO reaplica el cambio (Postgres rechaza el
// insert con código 23505 → respondemos 200 OK para que Persona no
// reintente forever).
//
// Persona signature format: `t=<timestamp>,v1=<hmac_sha256(timestamp.body)>`.
// Verificación constant-time para evitar timing attacks.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PERSONA_WEBHOOK_SECRET = Deno.env.get("PERSONA_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Tolerance del timestamp del webhook — rechaza eventos >5 min de viejos
// para mitigar replay attacks (atacker captura un webhook legítimo y lo
// reenvía después).
const SIGNATURE_TOLERANCE_SECONDS = 300;

if (!PERSONA_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error(
    "[kyc-webhook] missing env: PERSONA_WEBHOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  );
}

interface PersonaEvent {
  data: {
    id: string;
    type: string;
    attributes: {
      "created-at": string;
      payload: {
        data: {
          id: string;
          type: string;
          attributes: {
            "reference-id": string | null;
            status: string;
            fields: Record<string, unknown>;
          };
        };
      };
    };
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Verifica la firma HMAC del webhook usando WebCrypto (constant-time vía
 * subtle.verify). Persona format: `t=<ts>,v1=<sig>`. El payload firmado
 * es `<timestamp>.<body>`.
 */
async function verifyPersonaSignature(
  payloadBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!signatureHeader) return { ok: false, reason: "no_signature" };

  // Parse `t=...,v1=...` (puede haber múltiples v1 si Persona rotó key,
  // probamos cada uno).
  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value ?? null;
    if (key === "v1") signatures.push(value ?? "");
  }

  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: "malformed_signature" };
  }

  // Replay protection — rechaza eventos viejos.
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_range" };
  }

  // Compute expected HMAC.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  const signedPayload = `${timestamp}.${payloadBody}`;
  const signedBytes = encoder.encode(signedPayload);

  // Verify each candidate signature constant-time.
  for (const sig of signatures) {
    const sigBytes = hexToBytes(sig);
    if (!sigBytes) continue;
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, signedBytes);
    if (valid) return { ok: true };
  }

  return { ok: false, reason: "signature_mismatch" };
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Mapea el resultado de Persona a nuestro `kyc_status` enum.
 *
 * Persona statuses: `created`, `pending`, `completed`, `expired`, `failed`,
 * `approved`, `declined`, `needs_review`.
 *
 * Nuestros statuses: `none`, `pending`, `approved`, `rejected`.
 */
function mapPersonaStatusToKyc(personaStatus: string): "pending" | "approved" | "rejected" {
  const normalized = personaStatus.toLowerCase();
  if (normalized === "approved" || normalized === "completed") return "approved";
  if (normalized === "declined" || normalized === "failed" || normalized === "expired") {
    return "rejected";
  }
  return "pending";
}

/**
 * Determina el nuevo KYC level según el template de Persona usado.
 *
 * Mapping (config en Persona dashboard):
 * - Template `itmpl_kyc_l1_*` → level 1.
 * - Template `itmpl_kyc_l2_*` → level 2.
 * - Template `itmpl_kyc_l3_*` → level 3 (manual review).
 *
 * Si el template no matchea o el status no es approved, mantiene el level
 * anterior (que el caller resuelve via prev_level).
 */
function determineNewLevel(
  templateId: string | undefined,
  personaStatus: string,
  prevLevel: number,
): 0 | 1 | 2 | 3 {
  if (mapPersonaStatusToKyc(personaStatus) !== "approved") {
    return prevLevel as 0 | 1 | 2 | 3;
  }
  if (!templateId) return prevLevel as 0 | 1 | 2 | 3;
  if (templateId.includes("kyc_l1") || templateId.endsWith("_l1")) return 1;
  if (templateId.includes("kyc_l2") || templateId.endsWith("_l2")) return 2;
  if (templateId.includes("kyc_l3") || templateId.endsWith("_l3")) return 3;
  return prevLevel as 0 | 1 | 2 | 3;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
    });
  }
  if (!PERSONA_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return jsonResponse({ error: "fn_misconfigured" }, 500);
  }

  // 1. Read raw body — necesario para firma + parse JSON después.
  const rawBody = await req.text();

  // 2. Verify signature.
  const signatureHeader = req.headers.get("Persona-Signature");
  const verifyResult = await verifyPersonaSignature(
    rawBody,
    signatureHeader,
    PERSONA_WEBHOOK_SECRET,
  );
  if (!verifyResult.ok) {
    console.warn("[kyc-webhook] signature invalid:", verifyResult.reason);
    return jsonResponse({ error: "invalid_signature", reason: verifyResult.reason }, 401);
  }

  // 3. Parse event.
  let event: PersonaEvent;
  try {
    event = JSON.parse(rawBody) as PersonaEvent;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const eventType = event.data?.type ?? "unknown";
  const eventId = event.data?.id;
  if (!eventId) {
    return jsonResponse({ error: "missing_event_id" }, 400);
  }

  // 4. Solo procesamos events de inquiry o report. Otros (verification.created,
  //    inquiry.started, etc.) acknowledge sin update.
  const PROCESSED_TYPES = new Set([
    "inquiry.completed",
    "inquiry.failed",
    "inquiry.expired",
    "report.run-completed",
  ]);
  if (!PROCESSED_TYPES.has(eventType)) {
    return jsonResponse({ ok: true, ignored: true, type: eventType }, 200);
  }

  const inquiryAttrs = event.data.attributes?.payload?.data?.attributes;
  const inquiryId = event.data.attributes?.payload?.data?.id ?? "unknown";
  const userId = inquiryAttrs?.["reference-id"];
  const personaStatus = inquiryAttrs?.status ?? "pending";

  if (!userId || !userId.startsWith("did:privy:")) {
    console.warn("[kyc-webhook] reference-id missing or not Privy DID:", userId);
    // 200 OK para que Persona no reintente — el problema es nuestro (config
    // del template sin reference-id) o un test event.
    return jsonResponse({ ok: true, skipped: "no_reference_id" }, 200);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 5. Read current profile state para comparar prev/new.
  const { data: profile, error: readErr } = await admin
    .from("profiles")
    .select("kyc_level, kyc_status")
    .eq("id", userId)
    .single();

  if (readErr) {
    console.error("[kyc-webhook] profile read failed:", readErr.message);
    return jsonResponse({ error: "profile_not_found" }, 404);
  }

  const prevLevel = (profile?.kyc_level ?? 0) as number;
  const prevStatus = (profile?.kyc_status ?? "none") as string;

  // 6. Determine new state.
  // Template ID viene en `event.data.attributes.payload.data.attributes.fields["inquiry-template-id"]`
  // o similar — schema exact varía por versión Persona. Duck typing.
  const templateId =
    (inquiryAttrs?.fields?.["inquiry-template-id"] as string | undefined) ??
    (inquiryAttrs?.fields?.["template-id"] as string | undefined);

  const newStatus = mapPersonaStatusToKyc(personaStatus);
  const newLevel = determineNewLevel(templateId, personaStatus, prevLevel);

  // 7. Insert audit log row — UNIQUE en persona_event_id ⇒ idempotency.
  const { error: auditErr } = await admin.from("kyc_audit_log").insert({
    user_id: userId,
    inquiry_id: inquiryId,
    persona_event_id: eventId,
    event_type: eventType,
    prev_level: prevLevel,
    prev_status: prevStatus,
    new_level: newLevel,
    new_status: newStatus,
    raw_event: event as unknown as Record<string, unknown>,
  });

  if (auditErr) {
    if (auditErr.code === "23505") {
      // Duplicate event — Persona reintentando un webhook ya procesado.
      // Respondemos 200 para que pare. Cero side effects extras.
      return jsonResponse({ ok: true, idempotent: true, event_id: eventId }, 200);
    }
    console.error("[kyc-webhook] audit insert failed:", auditErr.message);
    return jsonResponse({ error: "audit_insert_failed" }, 500);
  }

  // 8. Update profiles solo si hay cambio real (evita writes inútiles
  //    al table principal).
  if (newLevel !== prevLevel || newStatus !== prevStatus) {
    const { error: updErr } = await admin
      .from("profiles")
      .update({ kyc_level: newLevel, kyc_status: newStatus })
      .eq("id", userId);

    if (updErr) {
      console.error("[kyc-webhook] profile update failed:", updErr.message);
      // Audit log ya commiteado — no rollback. Próximo webhook reintenta.
      return jsonResponse({ error: "profile_update_failed" }, 500);
    }
  }

  return jsonResponse(
    {
      ok: true,
      user_id: userId,
      prev: { level: prevLevel, status: prevStatus },
      next: { level: newLevel, status: newStatus },
    },
    200,
  );
});
