/**
 * Centralized logger for Moneto apps.
 *
 * Reasons we don't reach for raw `console.*`:
 *
 * 1. Telemetry — `setLogSink()` permite enchufar Sentry / Axiom / Datadog
 *    sin tocar callsites.
 * 2. Production hardening — en prod, `info` se silencia por defecto. `warn`
 *    y `error` siempre pasan (ESLint permite estos en componentes).
 * 3. Estructura — todos los logs llevan `level`, `scope`, `message`,
 *    `data?`. Searchable, filterable.
 *
 * No PII en logs (lo enforce review). Cero `console.log` (lo enforce ESLint).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown> | undefined;
  timestamp: string;
}

export type LogSink = (event: LogEvent) => void;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = "info";
let sink: LogSink = defaultSink;

function defaultSink(event: LogEvent) {
  const prefix = `[${event.scope}]`;
  switch (event.level) {
    case "debug":
    case "info":
      // eslint-disable-next-line no-console
      console.info(prefix, event.message, event.data ?? "");
      break;
    case "warn":
      console.warn(prefix, event.message, event.data ?? "");
      break;
    case "error":
      console.error(prefix, event.message, event.data ?? "");
      break;
  }
}

/**
 * Reemplaza el sink de logging (e.g., para enviar a Sentry/Axiom).
 *
 * @example
 *   setLogSink((e) => Sentry.captureMessage(e.message, { extra: e.data }));
 */
export function setLogSink(next: LogSink): void {
  sink = next;
}

/**
 * Ajusta el nivel mínimo emitido. Eventos por debajo se descartan.
 *
 * @example
 *   if (__DEV__) setMinLogLevel("debug");
 */
export function setMinLogLevel(level: LogLevel): void {
  minLevel = level;
}

function emit(level: LogLevel, scope: string, message: string, data?: Record<string, unknown>) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
  sink({ level, scope, message, data, timestamp: new Date().toISOString() });
}

/**
 * Crea un logger con scope fijo. Usar uno por module/feature.
 *
 * @example
 *   const log = createLogger("auth");
 *   log.info("user signed in", { userId });
 *   log.error("login failed", { reason: "wrong_password" });
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      emit("debug", scope, message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      emit("info", scope, message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      emit("warn", scope, message, data),
    error: (message: string, data?: Record<string, unknown>) =>
      emit("error", scope, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
