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

type ProfileRow = {
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
};

type ProfileInsert = {
  id: string;
  handle: string;
  name?: string | null;
  country_code: string;
  phone_ciphertext?: string | null;
  avatar_url?: string | null;
  kyc_level?: KycLevel;
  kyc_status?: KycStatus;
};

type ProfileUpdate = Partial<ProfileInsert>;

type UserPreferencesRow = {
  user_id: string;
  theme: ThemePreference;
  language: LanguagePreference;
  notifications_push: boolean;
  notifications_email: boolean;
  balance_hidden: boolean;
  default_asset: string;
  /** Sprint 3.07 — orden en que el payment router consume assets. */
  asset_priority_order: string[];
  /** Sprint 3.07 — assets que el user oculta de la UI (no afecta on-chain). */
  hidden_assets: string[];
  /** Sprint 3.07 — pre-selección en Send. */
  default_send_asset: string;
  updated_at: Timestamptz;
};

type UserPreferencesInsert = {
  user_id: string;
  theme?: ThemePreference;
  language?: LanguagePreference;
  notifications_push?: boolean;
  notifications_email?: boolean;
  balance_hidden?: boolean;
  default_asset?: string;
  asset_priority_order?: string[];
  hidden_assets?: string[];
  default_send_asset?: string;
};

type UserPreferencesUpdate = Partial<UserPreferencesInsert>;

type GuardianNotificationRow = {
  id: string;
  recipient_user_id: string;
  notification_type: GuardianNotificationType;
  squads_multisig_pubkey: string;
  status: GuardianNotificationStatus;
  expires_at: Timestamptz;
  created_at: Timestamptz;
};

type GuardianNotificationInsert = {
  id?: string;
  recipient_user_id: string;
  notification_type: GuardianNotificationType;
  squads_multisig_pubkey: string;
  status?: GuardianNotificationStatus;
  expires_at: Timestamptz;
};

type GuardianNotificationUpdate = {
  status?: GuardianNotificationStatus;
};

type ViewingKeyRow = {
  id: string;
  user_id: string;
  label_ciphertext: string; // bytea → base64
  scope: ViewingKeyScope;
  expires_at: Timestamptz | null;
  revoked_at: Timestamptz | null;
  created_at: Timestamptz;
};

type ViewingKeyInsert = {
  id?: string;
  user_id: string;
  label_ciphertext: string;
  scope: ViewingKeyScope;
  expires_at?: Timestamptz | null;
  revoked_at?: Timestamptz | null;
};

type ViewingKeyUpdate = {
  label_ciphertext?: string;
  scope?: ViewingKeyScope;
  expires_at?: Timestamptz | null;
  revoked_at?: Timestamptz | null;
};

export type KycEventType =
  | "inquiry.completed"
  | "inquiry.failed"
  | "inquiry.expired"
  | "report.run-completed"
  | "verification.created";

type KycAuditLogRow = {
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
};

type KycAuditLogInsert = {
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
};

type EarlyAccessRequestRow = {
  user_id: string;
  /** Slug `namespace:variant` (e.g., `bridge:btc`, `bridge:eth`). */
  feature: string;
  metadata: Json;
  first_requested_at: Timestamptz;
  last_requested_at: Timestamptz;
};

type EarlyAccessRequestInsert = {
  user_id: string;
  feature: string;
  metadata?: Json;
};

type EarlyAccessRequestUpdate = {
  metadata?: Json;
};

// ─── Database type (Supabase-compatible) ──────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      user_preferences: {
        Row: UserPreferencesRow;
        Insert: UserPreferencesInsert;
        Update: UserPreferencesUpdate;
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_notifications: {
        Row: GuardianNotificationRow;
        Insert: GuardianNotificationInsert;
        Update: GuardianNotificationUpdate;
        Relationships: [
          {
            foreignKeyName: "guardian_notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      viewing_keys: {
        Row: ViewingKeyRow;
        Insert: ViewingKeyInsert;
        Update: ViewingKeyUpdate;
        Relationships: [
          {
            foreignKeyName: "viewing_keys_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      kyc_audit_log: {
        Row: KycAuditLogRow;
        Insert: KycAuditLogInsert;
        Update: never; // append-only
        Relationships: [
          {
            foreignKeyName: "kyc_audit_log_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      early_access_requests: {
        Row: EarlyAccessRequestRow;
        Insert: EarlyAccessRequestInsert;
        Update: EarlyAccessRequestUpdate;
        Relationships: [
          {
            foreignKeyName: "early_access_requests_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
export type EarlyAccessRequest = Database["public"]["Tables"]["early_access_requests"]["Row"];
