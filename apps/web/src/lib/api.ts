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

const SERVER_API_URL = process.env["MONETO_API_URL"] ?? "https://api.moneto.xyz";

export async function fetchPublicPayProfile(handle: string): Promise<PublicPayProfile | null> {
  const url = `${SERVER_API_URL}/public/pay/${encodeURIComponent(handle)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Cache static-ish — el wallet de un user no cambia, pero invalidamos
      // si el handle cambia (Privy recovery flow). 5 min es razonable.
      next: { revalidate: 300 },
    });
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data = (await res.json()) as PublicPayProfile;
  // Validate minimal — el server response viene con shape estable, pero
  // un guard previene crashes si la API redeploy cambia algo.
  if (
    typeof data?.handle !== "string" ||
    typeof data?.country_code !== "string" ||
    typeof data?.wallet_address !== "string"
  ) {
    return null;
  }
  return data;
}
