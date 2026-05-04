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
