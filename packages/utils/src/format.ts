/**
 * Formatters para amounts, dates, direcciones.
 */

export function formatUsd(amount: number, options?: { compact?: boolean; showSign?: boolean }) {
  const { compact = false, showSign = false } = options ?? {};
  const sign = showSign && amount > 0 ? "+" : "";
  if (compact && Math.abs(amount) >= 1000) {
    return `${sign}$${(amount / 1000).toFixed(1)}K`;
  }
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${sign}${amount < 0 ? "-" : ""}$${formatted}`;
}

export function formatCop(amount: number) {
  const formatted = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `$${formatted} COP`;
}

export function formatRelative(ts: number | Date) {
  const date = typeof ts === "number" ? new Date(ts) : ts;
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  if (hr < 24) return `${hr} h`;
  if (day < 7) return `${day} d`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatApy(apy: number) {
  return `${(apy * 100).toFixed(2)}%`;
}

/**
 * Saludo dinámico según hora local del dispositivo.
 * Usa Date() que respeta la timezone del device automáticamente.
 */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Humaniza un amount para que VoiceOver/TalkBack lo lea naturalmente
 * en español. `Intl.NumberFormat` por defecto pasa "$1,234.56" que el
 * screen reader interpreta como "uno coma dos tres cuatro punto cinco
 * seis" — desastre cognitivo.
 *
 * Esta función produce algo tipo:
 * - 1234.56 USD → "mil doscientos treinta y cuatro dólares con cincuenta y seis centavos"
 * - 25 USD → "veinticinco dólares"
 * - 0.5 USD → "cincuenta centavos"
 * - -100 USD → "menos cien dólares"
 *
 * Se usa SOLO en `accessibilityLabel`. No reemplaza el `formatUsd`
 * visible que sigue mostrando "$1,234.56" mono.
 *
 * @example
 *   <Text accessibilityLabel={formatAmountForA11y(balance, "USD")}>
 *     {formatUsd(balance)}
 *   </Text>
 */
export function formatAmountForA11y(amount: number, currency: "USD" | "COP" = "USD"): string {
  const sign = amount < 0 ? "menos " : "";
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);

  const currencyName = currency === "USD" ? "dólares" : "pesos";
  const subUnitName = currency === "USD" ? "centavos" : "centavos";

  if (whole === 0 && cents === 0) {
    return `cero ${currencyName}`;
  }

  const wholeWords = whole === 0 ? "" : numberToSpanishWords(whole);
  const wholeUnit =
    whole === 0
      ? ""
      : whole === 1
        ? `un ${currency === "USD" ? "dólar" : "peso"}`
        : `${wholeWords} ${currencyName}`;

  if (cents === 0) {
    return `${sign}${wholeUnit}`.trim();
  }

  const centsWords = numberToSpanishWords(cents);
  const centsUnit = `${centsWords} ${subUnitName}`;

  if (whole === 0) {
    return `${sign}${centsUnit}`.trim();
  }
  return `${sign}${wholeUnit} con ${centsUnit}`.trim();
}

/**
 * Convierte un entero positivo (0–999.999.999) a palabras en español.
 * Cubre el rango realista de un balance personal — no soportamos
 * billones (no aplica a un fintech retail).
 *
 * Implementación recursiva por triplets (millones, miles, unidades).
 * Reglas español: "veintiuno" no "veinte y uno", "ciento" antes de
 * número (no "cien"), "un mil" se omite ("mil quinientos" no "un mil
 * quinientos").
 */
function numberToSpanishWords(n: number): string {
  if (n === 0) return "cero";
  if (n < 0) return `menos ${numberToSpanishWords(-n)}`;
  if (n >= 1_000_000_000) {
    // Out of practical range para amounts de un user — return numeric fallback.
    return String(n);
  }

  const millions = Math.floor(n / 1_000_000);
  const remainderAfterMillions = n % 1_000_000;
  const thousands = Math.floor(remainderAfterMillions / 1_000);
  const units = remainderAfterMillions % 1_000;

  const parts: string[] = [];
  if (millions > 0) {
    if (millions === 1) parts.push("un millón");
    else parts.push(`${triplet(millions)} millones`);
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push("mil");
    else parts.push(`${triplet(thousands)} mil`);
  }
  if (units > 0) {
    parts.push(triplet(units));
  }
  return parts.join(" ").trim();
}

const UNITS_0_29 = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];

const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

/** 0..999 a palabras. */
function triplet(n: number): string {
  if (n < 30) return UNITS_0_29[n] ?? "";
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t] ?? "";
    return `${TENS[t]} y ${UNITS_0_29[u]}`;
  }
  // 100–999.
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (rem === 0) return HUNDREDS[h] ?? "";
  return `${HUNDREDS[h]} ${triplet(rem)}`;
}
