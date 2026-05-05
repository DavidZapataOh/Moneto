import QRCode from "qrcode";

/**
 * Server-side QR rendering. Devuelve SVG string ready para inyectar via
 * `dangerouslySetInnerHTML`. Usado por la page para el initial paint
 * (no-JS friendly) — el client component re-renderea cuando user edita
 * amount/memo.
 *
 * @param data — string a encodear (Solana Pay URI).
 * @returns SVG string `<svg>...</svg>` o null si la generación falla
 *   (input demasiado largo para el ECC level, etc.).
 */
export async function renderQrSvg(data: string): Promise<string | null> {
  try {
    return await QRCode.toString(data, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 1,
      width: 280,
      color: {
        dark: "#1A1610", // ink-900
        light: "#FBF6E9", // cream-50
      },
    });
  } catch {
    return null;
  }
}
