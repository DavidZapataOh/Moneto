/**
 * Axiom log sink — plugea el logger de `@moneto/utils` a Axiom.
 *
 * `@axiomhq/js` es peer-dep optional. Si la app lo tiene instalado,
 * importa el client + lo pasa aquí. Si no, el sink falla silently
 * (logs van a console solo).
 *
 * @example
 *   import { Axiom } from "@axiomhq/js";
 *   import { setLogSink } from "@moneto/utils";
 *   import { axiomSink } from "@moneto/observability";
 *
 *   const client = new Axiom({ token: env.AXIOM_TOKEN });
 *   setLogSink(axiomSink(client, { dataset: "moneto-api", env: env.ENVIRONMENT }));
 */

import { scrubObject } from "./scrub";

import type { LogSink, LogEvent } from "@moneto/utils";

/**
 * Shape mínima del client Axiom que necesitamos (subset de `@axiomhq/js`).
 * Definido localmente para no requerir el import.
 */
export interface AxiomLikeClient {
  ingest(dataset: string, events: Array<Record<string, unknown>>): unknown;
  // `flush()` opcional — útil en Workers para forzar send antes de
  // que el isolate termine (Workers tiene execution time cap).
  flush?(): Promise<void>;
}

export interface AxiomSinkOptions {
  /** Nombre del dataset en Axiom (e.g. `"moneto-api"`). */
  dataset: string;
  /** Environment tag — adjuntado a cada event. */
  env?: string;
  /** Versión del servicio (release). */
  release?: string;
  /**
   * Si `true`, también escribe al console como fallback. Default `true`
   * en development, `false` en production (Axiom es la única fuente de verdad).
   */
  alsoConsole?: boolean;
}

/**
 * Construye un `LogSink` del logger de `@moneto/utils` que envía a Axiom.
 *
 * Cada event pasa por `scrubObject` antes de ingresar — incluso si el
 * caller olvida scrub a nivel de feature, el sink ya garantiza que no
 * leakean financial/PII a través del log pipeline.
 */
export function axiomSink(client: AxiomLikeClient, options: AxiomSinkOptions): LogSink {
  const alsoConsole = options.alsoConsole ?? false;

  return (event: LogEvent) => {
    const scrubbed = scrubObject({
      _time: event.timestamp,
      level: event.level,
      scope: event.scope,
      message: event.message,
      env: options.env,
      release: options.release,
      ...event.data,
    });

    try {
      client.ingest(options.dataset, [scrubbed as Record<string, unknown>]);
    } catch (err) {
      // Axiom failure no debe romper el request. Log al console como
      // último recurso para no perder visibility.
      console.warn("[axiomSink] ingest failed:", err);
    }

    if (alsoConsole) {
      const prefix = `[${event.scope}]`;
      switch (event.level) {
        case "debug":
        case "info":
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
  };
}

/**
 * Helper para forzar flush del client Axiom — llamar antes de que el
 * Worker termine su execution para garantizar que los logs salieron.
 *
 * @example
 *   ctx.waitUntil(flushAxiom(client));
 */
export async function flushAxiom(client: AxiomLikeClient): Promise<void> {
  if (typeof client.flush === "function") {
    await client.flush();
  }
}
