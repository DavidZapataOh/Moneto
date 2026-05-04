/**
 * @moneto/observability — error tracking, structured logs, product analytics.
 *
 * Cero accounts wiring aquí — solo factories + scrubbers + taxonomy.
 * Las apps llaman estos helpers con su SDK específico (`@sentry/react-native`,
 * `@sentry/cloudflare`, `@axiomhq/js`, `posthog-react-native`).
 *
 * Privacy guarantee: TODO lo que pasa por estos helpers se scrub-ea
 * automáticamente. Si una key sensible se filtra a un log/breadcrumb/event,
 * el value se reemplaza por `[scrubbed]` antes de salir del proceso.
 *
 * Ver `docs/observability/conventions.md` para reglas de "qué loggear".
 */

// Scrubbing — el corazón del package.
export { scrubString, scrubObject, scrubSentryEvent, SCRUB_KEY_SETS } from "./scrub";

// Sentry config factories.
export {
  sentryMobileConfig,
  sentryWorkersConfig,
  type SentryMobileConfigInput,
  type SentryWorkersConfigInput,
} from "./sentry";

// Axiom log sink (plugea al logger de @moneto/utils).
export { axiomSink, flushAxiom, type AxiomLikeClient, type AxiomSinkOptions } from "./axiom";

// PostHog event taxonomy + helpers.
export {
  Events,
  AmountBuckets,
  bucketAmountUsd,
  capture,
  type EventName,
  type EventProps,
  type AmountBucket,
} from "./events";
