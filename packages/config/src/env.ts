import { z } from "zod";

/**
 * Environment names enforced en todo el codebase.
 *
 * Mantener este enum como fuente de verdad — workflows, wrangler envs,
 * EAS channels, Sentry environments y Supabase projects deben matchear.
 */
export const EnvironmentSchema = z.enum(["development", "staging", "production"]);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const SOLANA_NETWORKS = ["devnet", "mainnet-beta"] as const;
export const SolanaNetworkSchema = z.enum(SOLANA_NETWORKS);
export type SolanaNetwork = z.infer<typeof SolanaNetworkSchema>;

/**
 * Public env — embebido en bundles de cliente (mobile + web).
 *
 * Mobile usa prefijo `EXPO_PUBLIC_`, web usa `NEXT_PUBLIC_`. Los nombres
 * abajo son los resolved (sin prefijo) — cada app hace el mapping al cargar.
 *
 * REGLA: cualquier cosa aquí es REVERSE-ENGINEERABLE en el bundle. Solo
 * IDs/keys públicas (Privy app ID, Supabase anon key, RPC URL, Sentry DSN).
 */
export const PublicEnvSchema = z.object({
  ENV: EnvironmentSchema,
  API_URL: z.string().url(),

  // Privy
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_CLIENT_ID: z.string().min(1).optional(),

  // Supabase (anon key, public)
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Solana
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: SolanaNetworkSchema,

  // Observability (públicas — DSN/key únicas pero no secretas)
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/**
 * Server-only env (Cloudflare Workers / Next.js server / cron jobs).
 *
 * NUNCA expuesto al cliente. Validado al boot del worker — si falta uno
 * required, el worker falla loud antes de servir requests.
 */
export const ServerEnvSchema = PublicEnvSchema.extend({
  // Privy server-side
  PRIVY_APP_SECRET: z.string().min(1),
  // Ed25519 public key (formato PEM) — obtenida del Privy dashboard en
  // Configuration → App settings → Verification Key. Usada por
  // `@privy-io/node` para verificar las firmas ES256 de los JWTs.
  PRIVY_VERIFICATION_KEY: z.string().min(1),

  // Supabase admin (bypass RLS)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Solana indexing
  HELIUS_API_KEY: z.string().min(1),
  HELIUS_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Compliance
  CHAINALYSIS_API_KEY: z.string().min(1).optional(),
  PERSONA_API_KEY: z.string().min(1).optional(),

  // Partners (Sprint 6+)
  BOLD_API_KEY: z.string().min(1).optional(),
  RAIN_API_KEY: z.string().min(1).optional(),
  JUPITER_API_KEY: z.string().min(1).optional(),

  // Auth
  JWT_SIGNING_SECRET: z.string().min(32, "JWT_SIGNING_SECRET must be ≥32 chars"),

  // Observability
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  AXIOM_TOKEN: z.string().min(1).optional(),

  // Notifications
  RESEND_API_KEY: z.string().min(1).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * Valida public env al boot del cliente. Falla loud si falta required.
 *
 * @example
 *   const env = parsePublicEnv({
 *     ENV: process.env.EXPO_PUBLIC_ENV,
 *     API_URL: process.env.EXPO_PUBLIC_API_URL,
 *     // ...
 *   });
 */
export function parsePublicEnv(input: unknown): PublicEnv {
  return PublicEnvSchema.parse(input);
}

/**
 * Valida server env al boot del worker. Llamar UNA vez en el handler
 * principal — los errores de Zod ya incluyen el path del campo faltante.
 *
 * @example
 *   app.use("*", async (c, next) => {
 *     const env = parseServerEnv(c.env);
 *     c.set("env", env);
 *     await next();
 *   });
 */
export function parseServerEnv(input: unknown): ServerEnv {
  return ServerEnvSchema.parse(input);
}

// ─── Environment helpers ──────────────────────────────────────────────────

/** True si el environment es production. */
export const isProduction = (env: Environment): boolean => env === "production";

/** True si el environment NO es production (dev o staging). */
export const isPreProduction = (env: Environment): boolean => env !== "production";

/** True si el environment es development local. */
export const isDevelopment = (env: Environment): boolean => env === "development";

/** True si el environment es staging. */
export const isStaging = (env: Environment): boolean => env === "staging";

/**
 * Solana cluster correspondiente al environment.
 * Mainnet SOLO en production — dev/staging usan devnet siempre.
 */
export const solanaNetworkFor = (env: Environment): SolanaNetwork =>
  env === "production" ? "mainnet-beta" : "devnet";
