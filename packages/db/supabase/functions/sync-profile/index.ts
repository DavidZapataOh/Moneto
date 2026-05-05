// Edge function — sync-profile
//
// Recibe un Privy JWT en el Authorization header, lo verifica contra el
// JWKS de Privy (jose), y upsert-ea el row de `profiles` para ese DID
// usando service-role (bypass RLS).
//
// Runtime: Deno (Supabase Edge Functions). NO node, NO npm — todos los
// imports son URL-based.
//
// Wire en el frontend: ver `apps/mobile/src/lib/profile.ts > syncProfileToSupabase`.
//
// IMPORTANT — compartmentalization:
// - El body request NO contiene wallet_address (mobile no lo manda).
// - El JWT de Privy SÍ tiene `wallet` claim, pero acá NO lo extraemos
//   ni lo guardamos. Solo usamos `sub` (= Privy DID).
// - Phone va opcional, encriptado server-side via vault.encrypt_phone.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.6.3";

const PRIVY_APP_ID = Deno.env.get("PRIVY_APP_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!PRIVY_APP_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("[sync-profile] missing env: PRIVY_APP_ID/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
}

// JWKS endpoint público de Privy. jose cachea internamente.
const JWKS = PRIVY_APP_ID
  ? createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`))
  : null;

interface SyncProfileBody {
  handle?: unknown;
  country_code?: unknown;
  name?: unknown;
  phone?: unknown;
}

interface ValidatedBody {
  handle: string;
  country_code: string;
  name: string | null;
  phone: string | null;
}

function badRequest(reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

function unauthorized(reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function validateBody(body: SyncProfileBody): ValidatedBody | { error: string } {
  if (typeof body.handle !== "string" || body.handle.length < 3 || body.handle.length > 32) {
    return { error: "handle: required string 3-32 chars" };
  }
  if (typeof body.country_code !== "string" || !/^[A-Z]{2}$/.test(body.country_code)) {
    return { error: "country_code: required ISO 3166-1 alpha-2" };
  }
  const name =
    body.name === undefined || body.name === null ? null : String(body.name).slice(0, 120);
  const phone = body.phone === undefined || body.phone === null ? null : String(body.phone);
  if (phone !== null && (phone.length < 6 || phone.length > 20)) {
    return { error: "phone: invalid length" };
  }
  return {
    handle: body.handle.toLowerCase(),
    country_code: body.country_code,
    name,
    phone,
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
    });
  }
  if (!JWKS || !PRIVY_APP_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "fn_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Extract + verify JWT.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("missing_bearer");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return unauthorized("empty_token");

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "privy.io",
      audience: PRIVY_APP_ID,
    });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) {
      return unauthorized("invalid_subject");
    }
    userId = payload.sub;
  } catch (err) {
    console.warn("[sync-profile] jwt verify failed:", String(err));
    return unauthorized("invalid_token");
  }

  // 2. Parse + validate body.
  let body: SyncProfileBody;
  try {
    body = (await req.json()) as SyncProfileBody;
  } catch {
    return badRequest("invalid_json");
  }
  const validated = validateBody(body);
  if ("error" in validated) {
    return badRequest(validated.error);
  }

  // 3. Connect with service role (bypasses RLS for write).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4. Encrypt phone if provided. encrypt_phone is SECURITY DEFINER.
  let phoneCiphertext: string | null = null;
  if (validated.phone) {
    const { data, error } = await admin.rpc("encrypt_phone" as any, {
      phone_plain: validated.phone,
    });
    if (error) {
      console.error("[sync-profile] encrypt_phone failed:", error.message);
      return new Response(JSON.stringify({ error: "encryption_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    phoneCiphertext = (data as unknown as string) ?? null;
  }

  // 5. Upsert profile. Si existe (login repeated), no overwrite handle/name
  //    si el row ya tiene esos campos populated — solo updated_at via trigger.
  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: userId,
      handle: validated.handle,
      country_code: validated.country_code,
      name: validated.name,
      phone_ciphertext: phoneCiphertext,
      // ⚠️ NO wallet_address. Validado en code review (CODEOWNERS).
    },
    { onConflict: "id", ignoreDuplicates: false },
  );

  if (upsertError) {
    console.error("[sync-profile] upsert failed:", upsertError.message);
    // Handle-conflict (unique) → 409 con mensaje user-friendly.
    if (upsertError.code === "23505") {
      return new Response(JSON.stringify({ error: "handle_taken" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "upsert_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. Initialize default preferences (idempotent).
  const { error: prefError } = await admin
    .from("user_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (prefError) {
    // No bloquear — preferencias se pueden crear lazy en otro flow.
    console.warn("[sync-profile] preferences init failed (non-fatal):", prefError.message);
  }

  return new Response(JSON.stringify({ ok: true, user_id: userId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
