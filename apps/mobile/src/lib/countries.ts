/**
 * Mapeo país → flag emoji + nombre en español. LATAM-first (target market
 * Moneto). Resto se agrega cuando expandamos beyond LATAM.
 *
 * Si el `code` no está en el mapping, devolvemos `{ flag: '🌐', name: code }`
 * — fallback funcional sin breaking del UI.
 */

export interface CountryInfo {
  /** Emoji flag (regional indicator symbols). */
  flag: string;
  /** Nombre en español. */
  name: string;
}

const COUNTRIES: Record<string, CountryInfo> = {
  // LATAM core
  CO: { flag: "🇨🇴", name: "Colombia" },
  MX: { flag: "🇲🇽", name: "México" },
  BR: { flag: "🇧🇷", name: "Brasil" },
  AR: { flag: "🇦🇷", name: "Argentina" },
  CL: { flag: "🇨🇱", name: "Chile" },
  PE: { flag: "🇵🇪", name: "Perú" },
  EC: { flag: "🇪🇨", name: "Ecuador" },
  UY: { flag: "🇺🇾", name: "Uruguay" },
  PY: { flag: "🇵🇾", name: "Paraguay" },
  BO: { flag: "🇧🇴", name: "Bolivia" },
  VE: { flag: "🇻🇪", name: "Venezuela" },
  CR: { flag: "🇨🇷", name: "Costa Rica" },
  PA: { flag: "🇵🇦", name: "Panamá" },
  GT: { flag: "🇬🇹", name: "Guatemala" },
  HN: { flag: "🇭🇳", name: "Honduras" },
  SV: { flag: "🇸🇻", name: "El Salvador" },
  NI: { flag: "🇳🇮", name: "Nicaragua" },
  DO: { flag: "🇩🇴", name: "República Dominicana" },
  PR: { flag: "🇵🇷", name: "Puerto Rico" },
  CU: { flag: "🇨🇺", name: "Cuba" },
  // Mercados secundarios
  US: { flag: "🇺🇸", name: "Estados Unidos" },
  ES: { flag: "🇪🇸", name: "España" },
  PT: { flag: "🇵🇹", name: "Portugal" },
};

/**
 * Resuelve country info para un ISO 3166-1 alpha-2 code (case-insensitive).
 * Fallback a `{ flag: '🌐', name: code }` para countries que aún no
 * mapeamos — permite render sin crash.
 */
export function getCountryInfo(code: string | null | undefined): CountryInfo {
  if (!code) return { flag: "🌐", name: "—" };
  const upper = code.toUpperCase();
  return COUNTRIES[upper] ?? { flag: "🌐", name: upper };
}
