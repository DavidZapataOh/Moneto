/**
 * Hand-written Database schema type.
 *
 * Matches `supabase/migrations/*.sql`. Mantener sincronizado a mano hasta
 * que el founder tenga un Supabase project linked + corra
 * `pnpm --filter @moneto/db db:gen-types` (que genera `types.generated.ts`
 * y deprecates este file).
 *
 * Forma compatible con `@supabase/supabase-js > Database` generic, así el
 * client queda type-safe end-to-end.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** ISO 8601 timestamp string. */
export type Timestamptz = string;

export type KycLevel = 0 | 1 | 2 | 3;
export type KycStatus = "none" | "pending" | "approved" | "rejected";
export type ThemePreference = "system" | "light" | "dark";
export type LanguagePreference = "es" | "en" | "pt";
export type ViewingKeyScope = "txs_view" | "balance_view" | "full_read";
export type GuardianNotificationType =
  | "recovery_request"
  | "guardian_invite"
  | "recovery_approved"
  | "recovery_rejected";
export type GuardianNotificationStatus = "pending" | "acknowledged" | "expired";

// ─── Tables ────────────────────────────────────────────────────────────────
//
// IDs son `text` (no `uuid`) — Privy DIDs tienen formato `did:privy:xxx`,
// no son UUIDs válidos. Ver migration 0006_change_id_to_text.sql.

interface ProfileRow {
  id: string; // Privy DID — `did:privy:xxx`
  handle: string;
  name: string | null;
  country_code: string;
  phone_ciphertext: string | null; // bytea → base64 string at the wire
  avatar_url: string | null;
  kyc_level: KycLevel;
  kyc_status: KycStatus;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

interface ProfileInsert {
  id: string;
  handle: string;
  name?: string | null;
  country_code: string;
  phone_ciphertext?: string | null;
  avatar_url?: string | null;
  kyc_level?: KycLevel;
  kyc_status?: KycStatus;
}

type ProfileUpdate = Partial<ProfileInsert>;

interface UserPreferencesRow {
  user_id: string;
  theme: ThemePreference;
  language: LanguagePreference;
  notifications_push: boolean;
  notifications_email: boolean;
  balance_hidden: boolean;
  default_asset: string;
  updated_at: Timestamptz;
}

interface UserPreferencesInsert {
  user_id: string;
  theme?: ThemePreference;
  language?: LanguagePreference;
  notifications_push?: boolean;
  notifications_email?: boolean;
  balance_hidden?: boolean;
  default_asset?: string;
}

type UserPreferencesUpdate = Partial<UserPreferencesInsert>;

interface GuardianNotificationRow {
  id: string;
  recipient_user_id: string;
  notification_type: GuardianNotificationType;
  squads_multisig_pubkey: string;
  status: GuardianNotificationStatus;
  expires_at: Timestamptz;
  created_at: Timestamptz;
}

interface GuardianNotificationInsert {
  id?: string;
  recipient_user_id: string;
  notification_type: GuardianNotificationType;
  squads_multisig_pubkey: string;
  status?: GuardianNotificationStatus;
  expires_at: Timestamptz;
}

interface GuardianNotificationUpdate {
  status?: GuardianNotificationStatus;
}

interface ViewingKeyRow {
  id: string;
  user_id: string;
  label_ciphertext: string; // bytea → base64
  scope: ViewingKeyScope;
  expires_at: Timestamptz | null;
  revoked_at: Timestamptz | null;
  created_at: Timestamptz;
}

interface ViewingKeyInsert {
  id?: string;
  user_id: string;
  label_ciphertext: string;
  scope: ViewingKeyScope;
  expires_at?: Timestamptz | null;
  revoked_at?: Timestamptz | null;
}

interface ViewingKeyUpdate {
  label_ciphertext?: string;
  scope?: ViewingKeyScope;
  expires_at?: Timestamptz | null;
  revoked_at?: Timestamptz | null;
}

export type KycEventType =
  | "inquiry.completed"
  | "inquiry.failed"
  | "inquiry.expired"
  | "report.run-completed"
  | "verification.created";

interface KycAuditLogRow {
  id: string;
  user_id: string;
  inquiry_id: string;
  persona_event_id: string;
  event_type: KycEventType;
  prev_level: KycLevel | null;
  prev_status: KycStatus | null;
  new_level: KycLevel;
  new_status: KycStatus;
  raw_event: Json;
  created_at: Timestamptz;
}

interface KycAuditLogInsert {
  id?: string;
  user_id: string;
  inquiry_id: string;
  persona_event_id: string;
  event_type: KycEventType;
  prev_level?: KycLevel | null;
  prev_status?: KycStatus | null;
  new_level: KycLevel;
  new_status: KycStatus;
  raw_event: Json;
}

// ─── Database type (Supabase-compatible) ──────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      user_preferences: {
        Row: UserPreferencesRow;
        Insert: UserPreferencesInsert;
        Update: UserPreferencesUpdate;
      };
      guardian_notifications: {
        Row: GuardianNotificationRow;
        Insert: GuardianNotificationInsert;
        Update: GuardianNotificationUpdate;
      };
      viewing_keys: {
        Row: ViewingKeyRow;
        Insert: ViewingKeyInsert;
        Update: ViewingKeyUpdate;
      };
      kyc_audit_log: {
        Row: KycAuditLogRow;
        Insert: KycAuditLogInsert;
        Update: never; // append-only
      };
    };
    Views: Record<string, never>;
    Functions: {
      encrypt_phone: {
        Args: { phone_plain: string };
        Returns: string; // bytea base64
      };
      decrypt_phone: {
        Args: { phone_ct: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}

// ─── Convenience type aliases ────────────────────────────────────────────

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsertInput = Database["public"]["Tables"]["profiles"]["Insert"];
export type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];
export type GuardianNotification = Database["public"]["Tables"]["guardian_notifications"]["Row"];
export type ViewingKey = Database["public"]["Tables"]["viewing_keys"]["Row"];
export type KycAuditLog = Database["public"]["Tables"]["kyc_audit_log"]["Row"];
