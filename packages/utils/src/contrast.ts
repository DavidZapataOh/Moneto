/**
 * WCAG 2.1 contrast ratio utilities. Pure functions, no platform deps.
 *
 * Source: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * Uso típico: validar combinaciones del theme en CI ANTES de mergear
 * cambios de palette. Una ratio < 4.5 (texto normal) o < 3 (texto large/
 * 18pt+ bold) es bug de accessibility hard.
 *
 * @example
 *   contrast("#FBF7EF", "#14100B"); // 17.8 — clear AAA pass
 *   meetsWCAGAA("#6D655A", "#FBF7EF"); // false — gris too light en cream
 */

/**
 * Parsea un color hex (#RGB / #RRGGBB / #RRGGBBAA) a sus tres componentes
 * lineales 0-1. Lanza si el formato no es reconocible — preferimos
 * fallar rápido en CI vs ratio incorrecta silenciosa.
 *
 * Soporta sRGB pero NO `rgb()`/`rgba()` por ahora — el design system
 * de Moneto usa hex exclusivamente.
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.trim().replace(/^#/, "");
  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    const c0 = cleaned[0]!;
    const c1 = cleaned[1]!;
    const c2 = cleaned[2]!;
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else if (cleaned.length === 6 || cleaned.length === 8) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return { r: r / 255, g: g / 255, b: b / 255 };
}

/**
 * Convierte un canal sRGB lineal en su valor relativo de luminancia
 * (gamma correction). WCAG 2.1 §1.4.3 spec.
 */
function relativeChannel(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Luminancia relativa de un color sRGB (rango 0..1, donde 0 es black,
 * 1 es white). Usada como base de la ratio de contraste.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * relativeChannel(r) + 0.7152 * relativeChannel(g) + 0.0722 * relativeChannel(b);
}

/**
 * Contrast ratio entre dos colores sRGB. Retorna número 1..21
 * (1 = idéntico, 21 = max para black/white). 4.5 = AA, 7 = AAA.
 *
 * @example
 *   contrast("#FFFFFF", "#000000"); // 21
 *   contrast("#FBF7EF", "#14100B"); // ~17.8
 */
export function contrast(fg: string, bg: string): number {
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface WCAGOptions {
  /**
   * True para texto large (≥18pt regular o ≥14pt bold). Cambia el
   * umbral AA de 4.5 a 3.0, AAA de 7.0 a 4.5.
   */
  largeText?: boolean;
}

/** WCAG AA — `4.5:1` para texto normal, `3:1` para large. */
export function meetsWCAGAA(fg: string, bg: string, opts: WCAGOptions = {}): boolean {
  const ratio = contrast(fg, bg);
  return opts.largeText ? ratio >= 3 : ratio >= 4.5;
}

/** WCAG AAA — `7:1` para texto normal, `4.5:1` para large. Aspirational. */
export function meetsWCAGAAA(fg: string, bg: string, opts: WCAGOptions = {}): boolean {
  const ratio = contrast(fg, bg);
  return opts.largeText ? ratio >= 4.5 : ratio >= 7;
}
