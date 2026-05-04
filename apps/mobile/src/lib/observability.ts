import { EnvironmentSchema, type Environment } from "@moneto/config";
import { sentryMobileConfig } from "@moneto/observability";
import { createLogger, setMinLogLevel } from "@moneto/utils";
import * as Sentry from "@sentry/react-native";
// eslint-disable-next-line import/no-named-as-default -- expo-constants exports both `default` y named `Constants`.
import Constants from "expo-constants";
// eslint-disable-next-line import/no-named-as-default -- posthog-react-native exports both `default` y named `PostHog` (library convention).
import PostHog from "posthog-react-native";

const log = createLogger("mobile.boot");

let booted = false;
let posthog: PostHog | null = null;

/**
 * Resuelve el environment del bundle. Falls back a `development` si la
 * var no está set (e.g., dev sin `.env.local`).
 */
function resolveEnv(): Environment {
  // Bracket access requerido por `noPropertyAccessFromIndexSignature` —
  // process.env tiene index signature, no properties.
  const raw = process.env["EXPO_PUBLIC_ENV"];
  const result = EnvironmentSchema.safeParse(raw);
  return result.success ? result.data : "development";
}

/**
 * Inicializa Sentry + PostHog + logger min-level una sola vez por app
 * launch. Idempotent — llamadas repetidas son no-op.
 *
 * Cada SDK se inicializa SOLO si su token público está set:
 * - `EXPO_PUBLIC_SENTRY_DSN` → Sentry
 * - `EXPO_PUBLIC_POSTHOG_KEY` → PostHog
 *
 * Sin tokens, los SDKs quedan no-op (cero overhead, cero crash).
 */
export function bootObservability(): void {
  if (booted) return;
  booted = true;

  const env = resolveEnv();

  setMinLogLevel(env === "production" ? "warn" : "debug");

  // ── Sentry ────────────────────────────────────────────────────────────
  const sentryDsn = process.env["EXPO_PUBLIC_SENTRY_DSN"];
  const release = `moneto-mobile@${Constants.expoConfig?.version ?? "0.0.0"}`;
  const dist = Constants.expoConfig?.runtimeVersion as string | undefined;

  const sentryOpts = sentryMobileConfig({
    dsn: sentryDsn,
    env,
    release,
    ...(dist ? { dist } : {}),
  });

  if (sentryOpts.enabled) {
    // Cast: nuestro `beforeSend` está tipado como `<T>(event: T) => T` (genérico
    // cross-SDK, definido en @moneto/observability sin importar los SDKs).
    // Sentry RN espera (event: ErrorEvent, hint) => ErrorEvent | null. La
    // implementación es funcionalmente equivalente — el scrubber preserva
    // shape y nunca retorna null.
    Sentry.init(sentryOpts as unknown as Sentry.ReactNativeOptions);
    log.info("sentry initialized", { env, release });
  }

  // ── PostHog ───────────────────────────────────────────────────────────
  const posthogKey = process.env["EXPO_PUBLIC_POSTHOG_KEY"];
  const posthogHost = process.env["EXPO_PUBLIC_POSTHOG_HOST"] ?? "https://us.posthog.com";

  if (posthogKey) {
    posthog = new PostHog(posthogKey, {
      host: posthogHost,
      enableSessionReplay: env === "production",
      captureAppLifecycleEvents: true,
      flushInterval: 30,
      flushAt: 20,
    });
    log.info("posthog initialized", { env, host: posthogHost });
  }
}

/** Acceso al client de PostHog ya bootstrap-eado. `null` si no hay key. */
export function getPostHog(): PostHog | null {
  return posthog;
}

interface IdentifyInput {
  privyDid: string;
  country?: string;
  kycLevel?: 0 | 1 | 2 | 3;
  appVersion?: string;
}

/**
 * Identificación de user — llamar después de que el user complete auth.
 * Privy DID es pseudónimo (sin email/handle/wallet) → safe para tracking.
 *
 * @example
 *   identifyUser({ privyDid: user.id, country: profile.country, kycLevel: 1 });
 */
export function identifyUser(input: IdentifyInput): void {
  if (posthog) {
    // Construir props omitiendo `undefined` — `exactOptionalPropertyTypes`
    // del lado de PostHog rechaza props con valor undefined explícito.
    const props: Record<string, string | number> = {};
    if (input.country) props["country"] = input.country;
    if (input.kycLevel !== undefined) props["kyc_level"] = input.kycLevel;
    const version = input.appVersion ?? Constants.expoConfig?.version;
    if (version) props["app_version"] = version;

    posthog.identify(input.privyDid, props);
  }

  Sentry.setUser({ id: input.privyDid });
  Sentry.setTag("kyc_level", String(input.kycLevel ?? 0));
  if (input.country) {
    Sentry.setTag("country", input.country);
  }
}

/** Reset del user state — llamar al logout. */
export function resetUser(): void {
  posthog?.reset();
  Sentry.setUser(null);
}

/**
 * Re-export del Events namespace para llamadas type-safe desde la app.
 *
 * @example
 *   import { Events, capture, getPostHog } from "@/lib/observability";
 *   const ph = getPostHog();
 *   if (ph) capture(ph, Events.send_completed, { ... });
 */
export { Events, capture, bucketAmountUsd } from "@moneto/observability";
