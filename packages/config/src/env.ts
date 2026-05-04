import { z } from "zod";

/**
 * Environment schema shared between mobile (EXPO_PUBLIC_*) and api.
 *
 * Mobile-only values must use the `EXPO_PUBLIC_` prefix at the call site;
 * the names below are the resolved (un-prefixed) values used by code.
 */
export const PublicEnvSchema = z.object({
  ENV: z.enum(["development", "staging", "production"]),
  API_URL: z.string().url(),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_CLIENT_ID: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]),
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/**
 * Server-only env (Cloudflare Workers / Edge functions).
 * Never expose these to the mobile bundle.
 */
export const ServerEnvSchema = PublicEnvSchema.extend({
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_VERIFICATION_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  HELIUS_API_KEY: z.string().min(1),
  HELIUS_WEBHOOK_SECRET: z.string().min(1).optional(),
  CHAINALYSIS_API_KEY: z.string().min(1).optional(),
  BOLD_API_KEY: z.string().min(1).optional(),
  RAIN_API_KEY: z.string().min(1).optional(),
  PERSONA_API_KEY: z.string().min(1).optional(),
  JWT_SIGNING_SECRET: z.string().min(32),
  AXIOM_TOKEN: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * Validate at boot. Fails loud if missing required vars.
 */
export function parsePublicEnv(input: unknown): PublicEnv {
  return PublicEnvSchema.parse(input);
}

export function parseServerEnv(input: unknown): ServerEnv {
  return ServerEnvSchema.parse(input);
}
