import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import {
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  Card,
  Divider,
  haptics,
  useEntrances,
  useTheme,
} from "@moneto/ui";
import * as Clipboard from "expo-clipboard";
import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";

import { capture, Events, getPostHog } from "@/lib/observability";
import { EmptyCardState } from "@components/features/EmptyCardState";
import { TransactionRow } from "@components/features/TransactionRow";
import { VirtualCard } from "@components/features/VirtualCard";
import { ScreenErrorBoundary } from "@components/ScreenErrorBoundary";
import { SettingRow } from "@components/SettingRow";
import { useCardPanReveal } from "@hooks/useCardPanReveal";
import { useDashboardData } from "@hooks/useDashboardData";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { useAppStore } from "@stores/useAppStore";

const SECTION_GAP = 32;

/**
 * Card screen — virtual Visa con freeze, settings, daily spend tracker
 * y wallet add-button (Sprint 6 conecta real con Apple Pay / Google Pay).
 *
 * Filosofía visual (design.txt + mobile-design.txt):
 * - **Card visual = peak emphasis**. Único elemento branded en la pantalla.
 *   Todo lo demás es neutral para que la card respire.
 * - **Frozen state visible**: opacity 0.55 + breathe paused → "esto está
 *   apagado". No oculto, no ambiguo.
 * - **PAN reveal = gift moment**: anticipation (biometric prompt) →
 *   reveal (flip + número visible) → afterglow (auto-hide a 30s + alert
 *   educativo si screenshot).
 */
export default function CardScreen() {
  const { colors } = useTheme();
  const card = useAppStore((s) => s.card);
  const setCardFrozen = useAppStore((s) => s.setCardFrozen);
  const setCardSetting = useAppStore((s) => s.setCardSetting);
  const allTransactions = useAppStore((s) => s.transactions);
  // Memoize: el filter recreaba un array nuevo en cada render → forzaba
  // a la `TransactionRow` memo a re-render por identity diff. Con useMemo,
  // si las txs no cambian, la lista referencia es estable.
  const transactions = useMemo(
    () => allTransactions.filter((t) => t.type === "card"),
    [allTransactions],
  );
  const [showDetails, setShowDetails] = useState(false);
  const [frozenPending, setFrozenPending] = useState(false);
  const bottomSpace = useTabBarSpace();
  const dashboard = useDashboardData();
  const pan = useCardPanReveal();
  const motion = useEntrances();

  const frozen = card.status === "frozen";
  const notProvisioned = card.status === "not_provisioned";
  const spentPct = Math.min(100, (card.spentTodayUsd / card.limitDailyUsd) * 100);

  const handleRefresh = useCallback(async () => {
    haptics.tap();
    const ph = getPostHog();
    if (ph) capture(ph, Events.dashboard_refresh, { screen: "card" });
    await dashboard.refresh();
    haptics.success();
  }, [dashboard]);

  const handleToggleFrozen = useCallback(
    (next: boolean) => {
      // Debounce simple — bloqueamos el toggle mientras la mutación
      // simulada está in-flight. Sprint 6 lo reemplaza con loading state
      // de la mutation real contra Rain.
      if (frozenPending) return;
      setFrozenPending(true);
      haptics.medium();
      const ph = getPostHog();
      if (ph) capture(ph, Events.card_frozen, { frozen: next });
      // Si el user descongela mientras el PAN está visible, lo ocultamos
      // por safety — un cambio de estado merece re-auth para el reveal.
      if (next && pan.showFullPan) pan.hide();
      setCardFrozen(next);
      // Mock: un tick para que el `loading` sea visible en el toggle.
      setTimeout(() => setFrozenPending(false), 350);
    },
    [frozenPending, pan, setCardFrozen],
  );

  const handleSettingChange = useCallback(
    (key: "allowOnline" | "allowPhysical" | "allowInternational", value: boolean) => {
      const ph = getPostHog();
      if (ph) capture(ph, Events.card_setting_toggled, { key, value });
      setCardSetting(key, value);
    },
    [setCardSetting],
  );

  const handleCopyLast4 = useCallback(async () => {
    haptics.success();
    await Clipboard.setStringAsync(card.last4);
  }, [card.last4]);

  const handleApplePay = useCallback(() => {
    haptics.medium();
    Alert.alert(
      Platform.OS === "ios" ? "Apple Pay" : "Google Pay",
      "Provisioning a wallets nativos llega en Sprint 6 con la integración real de Rain.",
      [{ text: "Entendido" }],
    );
  }, []);

  const handleRequestCard = useCallback(() => {
    Alert.alert(
      "Solicitar tarjeta",
      "El flow de issuance se conecta con Rain en Sprint 6. Por ahora podés explorar la pantalla con la card de demo.",
      [{ text: "Entendido" }],
    );
  }, []);

  return (
    <Screen
      padded
      edges={["top"]}
      scroll
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={dashboard.isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
            progressBackgroundColor={colors.bg.elevated}
          />
        ),
      }}
    >
      <ScreenHeader title="Tarjeta" subtitle="Virtual · Visa" />

      {notProvisioned ? (
        <EmptyCardState onRequest={handleRequestCard} />
      ) : (
        <>
          {/* Card visual — único accent peak. Wrapped en boundary porque
              el flip 3D + LinearGradient + tilt animation lo hace la zona
              más frágil. Si crash-ea, el resto de la screen (settings,
              spend tracker) sigue funcional para que el user no pierda
              acceso a `freeze`. */}
          <ScreenErrorBoundary feature="card.visual">
            <Animated.View
              entering={motion.hero}
              style={{ alignItems: "center", marginBottom: 20 }}
            >
              <VirtualCard
                last4={card.last4}
                cardholderName={card.cardholderName}
                expiryMonth={card.expiryMonth}
                expiryYear={card.expiryYear}
                showDetails={showDetails}
                showFullPan={pan.showFullPan}
                fullPan={card.fullPan}
                cvv="•••" /* CVV mock — production viene del API call cifrado */
                frozen={frozen}
                onTap={() => setShowDetails((s) => !s)}
              />
            </Animated.View>
          </ScreenErrorBoundary>

          {/* Status row */}
          <Animated.View
            entering={motion.fadeDelayed(120)}
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              marginBottom: SECTION_GAP,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: frozen ? colors.warning : colors.success,
              }}
            />
            <Text variant="bodySmall" tone="secondary">
              {frozen ? "Congelada — no permite pagos" : "Activa"}
            </Text>
            {pan.showFullPan ? (
              <>
                <Text variant="bodySmall" tone="tertiary">
                  ·
                </Text>
                <Text variant="bodySmall" tone="tertiary">
                  Ocultando en 30s
                </Text>
              </>
            ) : null}
          </Animated.View>

          {/* Actions row */}
          <Animated.View
            entering={motion.sectionDelayed(180)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: SECTION_GAP,
            }}
          >
            <CardAction
              icon={pan.showFullPan ? "eye-off-outline" : "eye-outline"}
              label={pan.showFullPan ? "Ocultar" : "Mostrar #"}
              busy={pan.isRevealing}
              onPress={() => {
                if (pan.showFullPan) {
                  haptics.tap();
                  pan.hide();
                } else {
                  void pan.reveal();
                }
              }}
            />
            <CardAction icon="copy-outline" label="Copiar" onPress={handleCopyLast4} />
            <CardAction
              icon={Platform.OS === "ios" ? "logo-apple" : "wallet-outline"}
              label={Platform.OS === "ios" ? "Apple Pay" : "Google Pay"}
              onPress={handleApplePay}
            />
            <CardAction icon="settings-outline" label="Ajustes" onPress={() => haptics.tap()} />
          </Animated.View>

          {/* Daily usage */}
          <Animated.View entering={motion.sectionDelayed(260)}>
            <SectionHeader title="Gastado hoy" />
            <Card variant="elevated" padded radius="lg">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 24,
                      lineHeight: 28,
                      color: colors.text.primary,
                      letterSpacing: -0.4,
                    }}
                  >
                    ${card.spentTodayUsd.toFixed(2)}
                  </Text>
                  <Text variant="bodySmall" tone="tertiary">
                    de ${card.limitDailyUsd}
                  </Text>
                </View>
                <Text variant="bodySmall" tone="secondary">
                  {(100 - spentPct).toFixed(0)}% libre
                </Text>
              </View>

              <View
                style={{
                  height: 8,
                  backgroundColor: colors.bg.overlay,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${spentPct}%`,
                    backgroundColor: colors.brand.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
            </Card>
          </Animated.View>

          {/* Settings */}
          <Animated.View entering={motion.sectionDelayed(320)} style={{ marginTop: SECTION_GAP }}>
            <SectionHeader title="Configuración" />
            <Card variant="elevated" padded={false} radius="lg">
              <SettingRow
                variant="toggle"
                icon="snow-outline"
                label="Congelar tarjeta"
                description="Pausa todos los pagos al instante"
                value={frozen}
                loading={frozenPending}
                onValueChange={handleToggleFrozen}
              />
              <View style={{ paddingHorizontal: 16 }}>
                <Divider />
              </View>
              <SettingRow
                variant="toggle"
                icon="globe-outline"
                label="Pagos online"
                description="E-commerce, suscripciones"
                value={card.allowOnline}
                disabled={frozen}
                onValueChange={(v) => handleSettingChange("allowOnline", v)}
              />
              <View style={{ paddingHorizontal: 16 }}>
                <Divider />
              </View>
              <SettingRow
                variant="toggle"
                icon="storefront-outline"
                label="Pagos físicos"
                description="POS contactless"
                value={card.allowPhysical}
                disabled={frozen}
                onValueChange={(v) => handleSettingChange("allowPhysical", v)}
              />
              <View style={{ paddingHorizontal: 16 }}>
                <Divider />
              </View>
              <SettingRow
                variant="toggle"
                icon="airplane-outline"
                label="Pagos internacionales"
                description="Comercios fuera de tu país"
                value={card.allowInternational}
                disabled={frozen}
                onValueChange={(v) => handleSettingChange("allowInternational", v)}
              />
              <View style={{ paddingHorizontal: 16 }}>
                <Divider />
              </View>
              <SettingRow
                variant="nav"
                icon="cash-outline"
                label="Límite diario"
                value={`$${card.limitDailyUsd.toFixed(0)}`}
                onPress={() =>
                  Alert.alert(
                    "Cambiar límite diario",
                    "El control de límites llega en Sprint 7 con biometric + cooldown anti-fraud.",
                    [{ text: "Entendido" }],
                  )
                }
              />
            </Card>
          </Animated.View>

          {/* Transactions */}
          <Animated.View entering={motion.sectionDelayed(380)} style={{ marginTop: SECTION_GAP }}>
            <SectionHeader
              title="Movimientos con tarjeta"
              {...(transactions.length > 0
                ? { action: { label: "Ver todos", onPress: () => haptics.tap() } }
                : {})}
            />
            {transactions.length === 0 ? (
              <Card variant="elevated" padded radius="lg">
                <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.bg.overlay,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="receipt-outline" size={20} color={colors.text.tertiary} />
                  </View>
                  <Text variant="bodySmall" tone="tertiary">
                    Aún sin gastos hoy
                  </Text>
                </View>
              </Card>
            ) : (
              <Card variant="elevated" padded={false} radius="lg">
                {transactions.map((tx, i) => (
                  <View key={tx.id}>
                    <TransactionRow tx={tx} showDate />
                    {i < transactions.length - 1 && (
                      <View style={{ paddingHorizontal: 16 }}>
                        <Divider />
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            )}
          </Animated.View>
        </>
      )}

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

function CardAction({
  icon,
  label,
  onPress,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy ?? false}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy ? { busy: true } : undefined}
      style={({ pressed }) => ({ flex: 1, opacity: busy ? 0.55 : pressed ? 0.55 : 1 })}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={colors.text.primary} />
        </View>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
