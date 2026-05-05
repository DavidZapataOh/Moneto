/**
 * Server-side fetch helper for `apps/api`. Web landing es 100% server-
 * rendered para `/pay/[handle]` — no necesitamos cliente browser-side.
 *
 * Variables de entorno:
 * - `MONETO_API_URL` (server-only) — el origin del API para SSR fetches.
 *   Default `https://api.moneto.xyz` (production).
 * - `NEXT_PUBLIC_MONETO_API_URL` (cliente) — para reload del QR client-
 *   side. Si no está set, fallback al server var.
 */

export interface PublicPayProfile {
  handle: string;
  name: string | null;
  country_code: string;
  avatar_url: string | null;
  wallet_address: string;
}

/**
 * Discriminated union para distinguir los tres estados que el caller
 * (page.tsx) necesita renderear distinto:
 * - `ok`: profile resuelto con wallet, render normal.
 * - `not_found`: handle no existe — 404 page.
 * - `provisioning`: handle existe pero wallet aún no listo — Sprint 4.02
 *   "Cuenta inicializándose, refrescá en unos segundos".
 */
export type PublicPayResult =
  | { status: "ok"; profile: PublicPayProfile }
  | { status: "not_found" }
  | { status: "provisioning" };

const SERVER_API_URL = process.env["MONETO_API_URL"] ?? "https://api.moneto.xyz";

export async function fetchPublicPayProfile(handle: string): Promise<PublicPayResult> {
  const url = `${SERVER_API_URL}/public/pay/${encodeURIComponent(handle)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Cache static-ish — el wallet de un user no cambia, pero invalidamos
      // si el handle cambia (Privy recovery flow). 5 min es razonable.
      // NO cacheamos el `provisioning` state — un retry inmediato puede
      // resolver, ver `revalidate: 0` cuando llega 503.
      next: { revalidate: 300 },
    });
  } catch {
    // Network error — tratamos como provisioning para que el cliente
    // pueda mostrar "intentá de nuevo" en lugar de 404 confuso.
    return { status: "provisioning" };
  }

  if (res.status === 404) return { status: "not_found" };
  if (res.status === 503) return { status: "provisioning" };
  if (!res.ok) return { status: "not_found" };

  const data = (await res.json()) as PublicPayProfile;
  if (
    typeof data?.handle !== "string" ||
    typeof data?.country_code !== "string" ||
    typeof data?.wallet_address !== "string"
  ) {
    return { status: "not_found" };
  }
  return { status: "ok", profile: data };
}
