/**
 * Device detection from User-Agent — server-side. Sirve para reorderar
 * CTAs en la pay landing: mobile prioriza "Abrir en wallet" (deep link
 * directo), desktop prioriza el QR (que el user escanea con su phone).
 *
 * Heurística simple (no exacta — UA spoofing existe, pero acceptable
 * para CTA priority). NO usamos para feature gating ni security.
 */

export type DeviceClass = "mobile" | "desktop";

/**
 * Pattern fragmentos comunes en mobile UAs. Conservative — si no
 * matchea ninguno, asumimos desktop. El cost de mal-clasificar mobile
 * como desktop es solo "QR primero, button segundo" — UX still works.
 */
const MOBILE_PATTERNS = [
  /android/i,
  /iphone/i,
  /ipad/i, // iPads se renderean como mobile UX por la touch surface
  /ipod/i,
  /windows phone/i,
  /opera mini/i,
  /mobile/i,
];

export function detectDevice(userAgent: string | null | undefined): DeviceClass {
  if (!userAgent) return "desktop";
  for (const pattern of MOBILE_PATTERNS) {
    if (pattern.test(userAgent)) return "mobile";
  }
  return "desktop";
}
