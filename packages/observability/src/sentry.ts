/**
 * Sentry config factories — un helper per platform que retorna el `init`
 * options object con scrubber + sample rates apropiados al env.
 *
 * El `Sentry.init()` actual lo llama el app con su SDK específico
 * (`@sentry/react-native` o `@sentry/cloudflare`) — este package no
 * importa esos SDKs (peer dep optional) para que cada app pague el costo
 * de bundle solo de lo que usa.
 *
 * @example
 *   // apps/mobile/app/_layout.tsx
 *   import * as Sentry from "@sentry/react-native";
 *   import { sentryMobileConfig } from "@moneto/observability";
 *
 *   Sentry.init(sentryMobileConfig({
 *     dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
 *     env: process.env.EXPO_PUBLIC_ENV as Environment,
 *     release: `moneto-mobile@${pkg.version}`,
 *   }));
 */

import { scrubSentryEvent } from "./scrub";

import type { Environment } from "@moneto/config";

export interface SentryMobileConfigInput {
  dsn: string | undefined;
  env: Environment;
  /** App version + build (e.g. `moneto-mobile@0.1.0+42`). */
  release?: string;
  /** Runtime version / dist tag. */
  dist?: string;
}

/**
 * Defaults sane para mobile. Si `dsn` es falsy, retorna `{ enabled: false }`
 * — el SDK queda no-op (cero overhead).
 */
export function sentryMobileConfig(input: SentryMobileConfigInput) {
  if (!input.dsn) {
    return {
      enabled: false,
      dsn: undefined,
      environment: input.env,
    };
  }

  return {
    enabled: true,
    dsn: input.dsn,
    environment: input.env,
    release: input.release,
    dist: input.dist,

    // Sample rates per env. Production: 10% de transactions para no quemar quota.
    // Pre-production: 100% para captar todo en dev/QA.
    tracesSampleRate: input.env === "production" ? 0.1 : 1.0,
    profilesSampleRate: input.env === "production" ? 0.1 : 1.0,

    // Privacy — scrub PII/financial antes de enviar.
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryEvent,

    // Auto-instrumentation que SÍ queremos.
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
    enableNative: true,
    enableNativeCrashHandling: true,

    // Auto-instrumentation que NO queremos (data sensible).
    enableAutoPerformanceTracing: input.env !== "production",
    attachScreenshot: false, // privacy — screenshots pueden capturar montos
    attachViewHierarchy: false,
  };
}

export interface SentryWorkersConfigInput {
  dsn: string | undefined;
  env: Environment;
  release?: string;
}

/**
 * Defaults para Cloudflare Workers (`@sentry/cloudflare`).
 * Si `dsn` es falsy, retorna `{ enabled: false }`.
 */
export function sentryWorkersConfig(input: SentryWorkersConfigInput) {
  if (!input.dsn) {
    return {
      enabled: false,
      dsn: undefined,
      environment: input.env,
    };
  }

  return {
    enabled: true,
    dsn: input.dsn,
    environment: input.env,
    release: input.release,

    // Workers tienen menor overhead — sample 10% en prod, 100% pre-prod.
    tracesSampleRate: input.env === "production" ? 0.1 : 1.0,

    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryEvent,

    // No incluir headers raw — request-scoped middleware los agrega
    // selectivamente con scrub aplicado.
    sendDefaultPii: false,
  };
}
