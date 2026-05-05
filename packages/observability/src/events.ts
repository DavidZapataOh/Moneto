/**
 * PostHog event taxonomy — single source of truth.
 *
 * Reglas:
 * - **Naming**: `<noun>_<verb>` en snake_case. Ej: `send_initiated`, no
 *   `initiated_send` ni `sendInitiated`.
 * - **Tense pasado** para acciones completadas (`auth_succeeded`),
 *   presente para inicios (`send_initiated`), `_viewed` para impresiones.
 * - **Properties tipadas** abajo — el caller consigue autocomplete y
 *   typecheck en lugar de strings sueltos.
 * - **Cero PII** en properties — financial amounts en buckets, addresses
 *   nunca, country codes OK como bucket analítico.
 *
 * Cómo usar:
 *
 *   import { Events, type EventName } from "@moneto/observability/events";
 *
 *   posthog.capture(Events.send_completed, {
 *     type: "p2p",
 *     currency: "USD",
 *     fee_pct: 0.0075,
 *   });
 */

export const Events = {
  // ── Onboarding funnel ────────────────────────────────────────────────
  onboarding_welcome_viewed: "onboarding_welcome_viewed",
  onboarding_intro_slide_viewed: "onboarding_intro_slide_viewed",
  onboarding_intro_completed: "onboarding_intro_completed",
  auth_screen_viewed: "auth_screen_viewed",
  auth_method_selected: "auth_method_selected",
  auth_succeeded: "auth_succeeded",
  auth_failed: "auth_failed",
  onboarding_completed: "onboarding_completed",

  // ── Navigation ───────────────────────────────────────────────────────
  tab_switched: "tab_switched",

  // ── Core actions ─────────────────────────────────────────────────────
  balance_viewed: "balance_viewed",
  /** User tap en una de las 4 quick actions del dashboard de Saldo. */
  quick_action_tapped: "quick_action_tapped",
  /** Pull-to-refresh disparado en una pantalla. `screen` discrimina origen. */
  dashboard_refresh: "dashboard_refresh",
  /** User abrió el modal de gestionar prioridades de assets. */
  assets_priorities_opened: "assets_priorities_opened",
  /** User reordenó la prioridad de un asset (move up/down). */
  assets_priorities_changed: "assets_priorities_changed",
  send_initiated: "send_initiated",
  send_completed: "send_completed",
  send_failed: "send_failed",
  receive_link_shared: "receive_link_shared",
  receive_link_copied: "receive_link_copied",
  swap_initiated: "swap_initiated",
  swap_completed: "swap_completed",
  swap_high_slippage_warning_shown: "swap_high_slippage_warning_shown",
  card_spend: "card_spend",
  /** User toggled la card freeze (UI optimistic; Sprint 6 server-side propaga). */
  card_frozen: "card_frozen",
  /** User reveló el PAN completo (post-biometric). NUNCA logueamos el PAN. */
  card_pan_revealed: "card_pan_revealed",
  /** User toggled un setting de la card (online/physical/international). */
  card_setting_toggled: "card_setting_toggled",
  /** Screenshot detectado mientras PAN visible — auto-hide + alert. Privacy. */
  card_pan_screenshot_detected: "card_pan_screenshot_detected",

  // ── KYC + compliance ─────────────────────────────────────────────────
  kyc_started: "kyc_started",
  kyc_submitted: "kyc_submitted",
  kyc_completed: "kyc_completed",
  kyc_rejected: "kyc_rejected",
  sanctions_hit: "sanctions_hit",

  // ── Privacy + recovery ───────────────────────────────────────────────
  viewing_key_generated: "viewing_key_generated",
  viewing_key_revoked: "viewing_key_revoked",
  recovery_initiated: "recovery_initiated",
  recovery_completed: "recovery_completed",
  recovery_cancelled: "recovery_cancelled",

  // ── Errors / friction ────────────────────────────────────────────────
  error_displayed: "error_displayed",
  cashout_failed: "cashout_failed",
  feature_flag_evaluated: "feature_flag_evaluated",

  // ── App lifecycle ────────────────────────────────────────────────────
  app_opened: "app_opened",
  app_backgrounded: "app_backgrounded",
  push_notification_received: "push_notification_received",
  push_notification_opened: "push_notification_opened",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

/**
 * Property buckets — convertir valores raw (montos exactos, durations) en
 * categorical para no leakear PII a través de cardinality alta.
 */
export const AmountBuckets = {
  micro: "<10",
  small: "10-50",
  medium: "50-200",
  large: "200-1000",
  xlarge: ">1000",
} as const;

export type AmountBucket = (typeof AmountBuckets)[keyof typeof AmountBuckets];

/**
 * Convierte un monto USD en bucket — usar SIEMPRE en lugar de pasar
 * el amount raw a PostHog/Axiom.
 */
export function bucketAmountUsd(amount: number): AmountBucket {
  if (amount < 10) return AmountBuckets.micro;
  if (amount < 50) return AmountBuckets.small;
  if (amount < 200) return AmountBuckets.medium;
  if (amount < 1000) return AmountBuckets.large;
  return AmountBuckets.xlarge;
}

/**
 * Property typing — opcional pero recomendado: por evento, qué props
 * espera. PostHog no enforce esto, pero TS sí cuando usás el helper.
 *
 * Mantener corto — solo eventos donde la shape es estable.
 */
export interface EventProps {
  [Events.onboarding_intro_slide_viewed]: { slide_index: number };
  [Events.auth_screen_viewed]: { mode: "signup" | "login" };
  [Events.auth_method_selected]: { method: "passkey" | "apple" | "google" };
  [Events.auth_succeeded]: { method: string; duration_ms: number };
  [Events.auth_failed]: { method: string; reason: string };
  [Events.onboarding_completed]: { total_duration_ms: number };
  [Events.tab_switched]: {
    from: "saldo" | "tarjeta" | "activos" | "yo";
    to: "saldo" | "tarjeta" | "activos" | "yo";
  };
  [Events.balance_viewed]: { tab: "saldo" | "tarjeta" | "activos" | "yo" };
  [Events.quick_action_tapped]: { action: "receive" | "send" | "cashout" | "swap" };
  [Events.dashboard_refresh]: { screen: "saldo" | "activos" | "card" };
  [Events.assets_priorities_opened]: Record<string, never>;
  [Events.assets_priorities_changed]: {
    asset: "usd" | "cop" | "sol" | "btc";
    direction: -1 | 1;
  };
  [Events.send_initiated]: { type: "p2p" | "cashout" };
  [Events.send_completed]: {
    type: "p2p" | "cashout";
    currency: string;
    fee_pct: number;
    amount_bucket: AmountBucket;
  };
  [Events.send_failed]: { type: "p2p" | "cashout"; reason: string };
  [Events.receive_link_shared]: { channel: "whatsapp" | "email" | "copy" | "qr" };
  [Events.swap_completed]: {
    from_asset: string;
    to_asset: string;
    slippage_bps: number;
    amount_bucket: AmountBucket;
  };
  [Events.card_spend]: { merchant_category: string; amount_bucket: AmountBucket };
  [Events.card_frozen]: { frozen: boolean };
  [Events.card_pan_revealed]: { method: "biometric" | "fallback" };
  [Events.card_setting_toggled]: {
    key: "allowOnline" | "allowPhysical" | "allowInternational";
    value: boolean;
  };
  [Events.card_pan_screenshot_detected]: Record<string, never>;
  [Events.kyc_started]: { level: 1 | 2 | 3 };
  [Events.kyc_completed]: { level: 1 | 2 | 3; duration_minutes: number };
  [Events.kyc_rejected]: { level: 1 | 2 | 3; reason: string };
  [Events.viewing_key_generated]: { scope_type: string; expires_in_days: number };
  [Events.recovery_initiated]: { trigger: "manual" | "forgot_device" };
  [Events.error_displayed]: { screen: string; error_code: string };
  [Events.feature_flag_evaluated]: { flag: string; variant: string };
}

/**
 * Cliente mínimo compatible con `capture()`. Definido lo más permisivo
 * posible para que PostHog (`PostHogEventProperties` con `JsonType` value
 * constraint) y mocks de tests satisfagan el shape sin gymnastics de
 * variance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intencional, ver doc arriba
export type CaptureClient = { capture: (event: string, props?: any) => unknown };

/**
 * Captura type-safe — usa este helper en lugar de pasar strings sueltos.
 *
 * @example
 *   capture(posthog, Events.send_completed, {
 *     type: "p2p",
 *     currency: "USD",
 *     fee_pct: 0.0075,
 *     amount_bucket: bucketAmountUsd(payload.amountUsd),
 *   });
 */
export function capture<E extends keyof EventProps>(
  client: CaptureClient,
  event: E,
  props: EventProps[E],
): void;
export function capture(
  client: CaptureClient,
  event: EventName,
  props?: Record<string, unknown>,
): void;
export function capture(
  client: CaptureClient,
  event: string,
  props?: Record<string, unknown>,
): void {
  client.capture(event, props);
}
