/**
 * RLS smoke tests — verifica que las policies hacen lo que prometen.
 *
 * Diseño: corre contra un Supabase project linked (local con
 * `supabase start`, o staging). Requiere 2 JWTs de prueba (UserA, UserB)
 * + el anon key. CI Sprint 8 los inyecta como secrets.
 *
 * Por qué este file existe en Sprint 1.02 si no corre todavía:
 * - Es el contrato testeable de "RLS hace X". Cuando CI lo ejecute,
 *   regresiones en migrations futuras se atrapan automático.
 * - Founder puede correrlo manual local con `supabase start` + 2 users
 *   creados en Auth dashboard.
 *
 * Local-only run:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=... \
 *   USER_A_TOKEN=... \
 *   USER_B_TOKEN=... \
 *   USER_A_ID=did:privy:... \
 *   USER_B_ID=did:privy:... \
 *   pnpm --filter @moneto/db test
 */

// NOTE: vitest no está instalado en `@moneto/db` aún (Sprint 8 ramps up
// test infra). Este file describe los tests pero no se compila a runtime
// hasta entonces. Mantener como spec viva.

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const beforeAll: (fn: () => Promise<void> | void) => void;
declare const expect: (value: unknown) => {
  toBeNull: () => void;
  toEqual: (expected: unknown) => void;
  toBe: (expected: unknown) => void;
  toContain: (substring: string) => void;
  not: { toBeNull: () => void };
};

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
const ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? "";
const USER_A_TOKEN = process.env["USER_A_TOKEN"] ?? "";
const USER_B_TOKEN = process.env["USER_B_TOKEN"] ?? "";
const USER_A_ID = process.env["USER_A_ID"] ?? "";
const USER_B_ID = process.env["USER_B_ID"] ?? "";

function clientWithToken(token: string) {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers ?? {});
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
}

describe("RLS — profiles", () => {
  let clientA: ReturnType<typeof clientWithToken>;
  let clientB: ReturnType<typeof clientWithToken>;

  beforeAll(() => {
    if (!SUPABASE_URL || !ANON_KEY || !USER_A_TOKEN || !USER_B_TOKEN) {
      throw new Error(
        "RLS tests require SUPABASE_URL, SUPABASE_ANON_KEY, USER_A_TOKEN, USER_B_TOKEN env vars",
      );
    }
    clientA = clientWithToken(USER_A_TOKEN);
    clientB = clientWithToken(USER_B_TOKEN);
  });

  it("user A can read own profile", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .select("id, kyc_level")
      .eq("id", USER_A_ID)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(USER_A_ID);
  });

  it("user A cannot see user B profile (RLS filters silently)", async () => {
    const { data } = await clientA.from("profiles").select("id").eq("id", USER_B_ID);
    expect(data).toEqual([]);
  });

  it("user A cannot insert profile for user B (RLS blocks)", async () => {
    const { error } = await clientA.from("profiles").insert({
      id: USER_B_ID,
      handle: `hacker_${Date.now()}`,
      country_code: "CO",
    });
    expect(error).not.toBeNull();
    // Postgres permission_denied — code "42501" o RLS-specific.
    expect(error?.message ?? "").toContain("row");
  });

  it("user A cannot update user B profile", async () => {
    const { error } = await clientA.from("profiles").update({ kyc_level: 3 }).eq("id", USER_B_ID);
    // RLS update no falla con error si no matchea — solo retorna 0 rows.
    // Verificamos que el row de B no cambió leyendo desde clientB.
    expect(error).toBeNull();
    const { data } = await clientB
      .from("profiles")
      .select("kyc_level")
      .eq("id", USER_B_ID)
      .single();
    // El kyc_level NO debería ser 3 (a menos que B lo haya seteado legítimo).
    if (data?.kyc_level === 3) {
      throw new Error("RLS BREAK: user A wrote to user B profile");
    }
  });

  it("profiles table does NOT have wallet_address column", async () => {
    // Si esto falla con datos, la migration agregó wallet_address — break
    // de compartmentalization. Si falla con error de "column does not
    // exist" → bien.
    const { error } = await clientA
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("profiles" as any)
      .select("wallet_address")
      .limit(1);
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain("column");
  });
});

describe("RLS — viewing_keys", () => {
  let clientA: ReturnType<typeof clientWithToken>;

  beforeAll(() => {
    clientA = clientWithToken(USER_A_TOKEN);
  });

  it("user A sees only their own keys", async () => {
    const { data } = await clientA.from("viewing_keys").select("user_id");
    for (const row of data ?? []) {
      expect(row.user_id).toBe(USER_A_ID);
    }
  });
});

describe("RLS — guardian_notifications", () => {
  let clientA: ReturnType<typeof clientWithToken>;

  beforeAll(() => {
    clientA = clientWithToken(USER_A_TOKEN);
  });

  it("user cannot insert (only service_role)", async () => {
    const { error } = await clientA.from("guardian_notifications").insert({
      recipient_user_id: USER_A_ID,
      notification_type: "guardian_invite",
      squads_multisig_pubkey: "fake_pubkey",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });
});
