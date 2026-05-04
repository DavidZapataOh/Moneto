import { z } from "zod";

/**
 * KYC compliance levels per `moneto-compliance-stance.md` §3.1.
 */
export const KycLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type KycLevel = z.infer<typeof KycLevelSchema>;

export const KycStatusSchema = z.enum(["none", "pending", "approved", "rejected"]);
export type KycStatus = z.infer<typeof KycStatusSchema>;

export const ThemePreferenceSchema = z.enum(["system", "light", "dark"]);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const LanguageSchema = z.enum(["es", "en", "pt"]);
export type Language = z.infer<typeof LanguageSchema>;

/**
 * Profile data stored in Supabase.
 * Per compartmentalization stance, NEVER includes wallet_address.
 */
export const ProfileSchema = z.object({
  id: z.string(), // privy userId (did:privy:xxx)
  handle: z.string().min(2).max(40),
  name: z.string().nullable().optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  avatarUrl: z.string().url().nullable().optional(),
  kycLevel: KycLevelSchema.default(0),
  kycStatus: KycStatusSchema.default("none"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/**
 * UX preferences. Stored in `user_preferences` table.
 */
export const UserPreferencesSchema = z.object({
  userId: z.string(),
  theme: ThemePreferenceSchema.default("system"),
  language: LanguageSchema.default("es"),
  notificationsPush: z.boolean().default(true),
  notificationsEmail: z.boolean().default(false),
  balanceHidden: z.boolean().default(false),
  defaultAsset: z.string().default("usd"),
  updatedAt: z.string().datetime(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
