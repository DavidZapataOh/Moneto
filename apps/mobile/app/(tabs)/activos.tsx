import { Ionicons } from "@expo/vector-icons";
import { fonts } from "@moneto/theme";
import {
  Card,
  Divider,
  Screen,
  ScreenHeader,
  SectionHeader,
  Text,
  haptics,
  useEntrances,
  useTheme,
} from "@moneto/ui";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";

import { capture, Events, getPostHog } from "@/lib/observability";
import { AssetDonut } from "@components/features/AssetDonut";
import { AssetRow } from "@components/features/AssetRow";
import { EmptyAssets } from "@components/features/EmptyAssets";
import { ScreenErrorBoundary } from "@components/ScreenErrorBoundary";
import { useAssetPreferences } from "@hooks/useAssetPreferences";
import { useAssetsData } from "@hooks/useAssetsData";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { useAppStore } from "@stores/useAppStore";

const SECTION_GAP = 32;

/**
 * Activos screen — patrimonio total + assets clasificados (rindiendo /
 * holdings) + vault allocation donut + payment routing settings.
 *
 * Filosofía visual aplicada (design.txt + colors.txt + mobile-design.txt):
 *
 * - **Una sola emphasis**: el patrimonio total. Las stat cells (rindiendo,
 *   APY, proyectado) van demoted a `text.secondary` con peso normal — son
 *   contexto, no headlines. Coherente con design.txt: *"Most of the text
 *   is light gray or dark purple, not even black."*
 * - **Donut chart**: único elemento "colorido" de la pantalla, y su paleta
 *   de slices se queda dentro de la familia warm (terracota / clay / stone).
 *   colors.txt: *"colors all work well on our UI because they're analogous
 *   and complimentary."*
 * - **Balance hidden mode**: respetado en hero + asset rows (USD column)
 *   + APY del donut. Coherente con la promesa de privacy.
 * - **Pull-to-refresh** = gift moment (anticipation → reveal → afterglow
 *   con haptic success).
 */
export default function ActivosScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const balanceHidden = useAppStore((s) => s.balanceHidden);
  const toggleBalanceVisibility = useAppStore((s) => s.toggleBalanceVisibility);
  const bottomSpace = useTabBarSpace();
  const data = useAssetsData();

  const motion = useEntrances();
  const prefs = useAssetPreferences();
  // Sprint 3.07: aplicamos `hidden_assets` + `asset_priority_order` del user.
  // El sort secundario por isEarning sigue intacto — la sección Rindiendo
  // siempre va antes de Holdings, pero dentro de cada sección respetamos
  // el orden del user.
  const visibleAssets = useMemo(() => {
    const hidden = new Set(prefs.data?.hidden_assets ?? []);
    const order = prefs.data?.asset_priority_order ?? [];
    const indexOf = new Map<string, number>(order.map((id, i) => [id, i]));
    return data.assets
      .filter((a) => !hidden.has(a.id))
      .sort((a, b) => {
        const ai = indexOf.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bi = indexOf.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return b.balanceUsd - a.balanceUsd;
      });
  }, [data.assets, prefs.data]);
  // Memoizamos los splits para que las `AssetRow` (memoized) reciban
  // referencias estables — sin esto, cada render del Activos crearía
  // arrays nuevos y forzaría re-render de las 9 rows aún si el data
  // del asset es el mismo.
  const earning = useMemo(() => visibleAssets.filter((a) => a.isEarning), [visibleAssets]);
  const holdings = useMemo(() => visibleAssets.filter((a) => !a.isEarning), [visibleAssets]);
  const isEmpty = data.totalPatrimonioUsd === 0;
  const change24h = data.change24hUsd;
  const changePct = data.change24hPct;

  const handleRefresh = useCallback(async () => {
    haptics.tap();
    const ph = getPostHog();
    if (ph) capture(ph, Events.dashboard_refresh, { screen: "activos" });
    await data.refresh();
    haptics.success();
  }, [data]);

  const handleOpenPriorities = useCallback(() => {
    haptics.tap();
    const ph = getPostHog();
    if (ph) capture(ph, Events.assets_priorities_opened, {});
    router.push("/asset-priorities");
  }, [router]);

  // Sprint 3.05: AssetRow's default ya navega a `/activos/:id` — no
  // override necesario.

  const formatHidden = (value: string) => (balanceHidden ? "•••" : value);

  return (
    <Screen
      padded
      edges={["top"]}
      scroll
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
            colors={[colors.brand.primary]}
            progressBackgroundColor={colors.bg.elevated}
          />
        ),
      }}
    >
      <ScreenHeader title="Activos" subtitle="Tu patrimonio completo" />

      {isEmpty ? (
        <EmptyAssets />
      ) : (
        <>
          {/* Hero — Patrimonio total */}
          <Animated.View entering={motion.hero}>
            <Card variant="elevated" padded radius="lg">
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text variant="label" tone="tertiary">
                  Patrimonio total
                </Text>
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    toggleBalanceVisibility();
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={balanceHidden ? "Mostrar saldos" : "Ocultar saldos"}
                >
                  <Ionicons
                    name={balanceHidden ? "eye-off-outline" : "eye-outline"}
                    size={16}
                    color={colors.text.tertiary}
                  />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 40,
                    lineHeight: 44,
                    color: colors.text.primary,
                    letterSpacing: -1.2,
                  }}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {balanceHidden
                    ? "$••••••"
                    : `$${data.totalPatrimonioUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                </Text>
                {!balanceHidden ? (
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 16,
                      color: colors.text.tertiary,
                    }}
                  >
                    USD
                  </Text>
                ) : null}
              </View>

              {!balanceHidden && Math.abs(change24h) > 0.01 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <Ionicons
                    name={change24h >= 0 ? "trending-up" : "trending-down"}
                    size={14}
                    color={change24h >= 0 ? colors.success : colors.danger}
                  />
                  <Text
                    variant="bodySmall"
                    style={{
                      color: change24h >= 0 ? colors.success : colors.danger,
                      fontFamily: fonts.monoMedium,
                    }}
                  >
                    {change24h >= 0 ? "+" : ""}${change24h.toFixed(2)} ·{" "}
                    {(changePct * 100).toFixed(2)}%
                  </Text>
                  <Text variant="bodySmall" tone="tertiary">
                    hoy
                  </Text>
                </View>
              ) : null}

              {/* Stat cells — secundarias, demoted a `text.secondary` para no
                  competir con el hero. design.txt principle. */}
              <View
                style={{
                  flexDirection: "row",
                  marginTop: 20,
                  paddingTop: 20,
                  borderTopWidth: 1,
                  borderTopColor: colors.border.subtle,
                  gap: 12,
                }}
              >
                <StatCell
                  label="Rindiendo"
                  value={formatHidden(
                    `$${data.totalEarningUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                  )}
                />
                <StatCell
                  label="APY ponderado"
                  value={formatHidden(`${(data.weightedApy * 100).toFixed(2)}%`)}
                />
                <StatCell
                  label="Proyectado/año"
                  value={formatHidden(`+$${(data.totalEarningUsd * data.weightedApy).toFixed(0)}`)}
                />
              </View>
            </Card>
          </Animated.View>

          {/* Gestionar prioridades */}
          <Pressable
            onPress={handleOpenPriorities}
            accessibilityRole="button"
            accessibilityLabel="Gestionar prioridades de pago"
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, marginTop: 12 })}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border.subtle,
              }}
            >
              <Ionicons name="options-outline" size={16} color={colors.text.secondary} />
              <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
                Prioridad de pago: USD → COP → SOL → BTC
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
            </View>
          </Pressable>

          {/* Rindiendo */}
          {earning.length > 0 ? (
            <Animated.View entering={motion.sectionDelayed(80)} style={{ marginTop: SECTION_GAP }}>
              <SectionHeader title="Rindiendo" />
              <Card variant="elevated" padded={false} radius="lg">
                {earning.map((asset, i) => (
                  <View key={asset.id}>
                    <AssetRow asset={asset} />
                    {i < earning.length - 1 && (
                      <View style={{ paddingHorizontal: 16 }}>
                        <Divider />
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            </Animated.View>
          ) : null}

          {/* Holdings (volátiles) */}
          {holdings.length > 0 ? (
            <Animated.View entering={motion.sectionDelayed(140)} style={{ marginTop: SECTION_GAP }}>
              <SectionHeader title="Holdings" />
              <Card variant="elevated" padded={false} radius="lg">
                {holdings.map((asset, i) => (
                  <View key={asset.id}>
                    <AssetRow asset={asset} />
                    {i < holdings.length - 1 && (
                      <View style={{ paddingHorizontal: 16 }}>
                        <Divider />
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            </Animated.View>
          ) : null}

          {/* Vault allocation — donut. Wrapped en boundary porque
              `react-native-svg` + Reanimated worklets son la zona más
              frágil de la screen. Un crash en el donut NO debe tirar
              el resto. */}
          <ScreenErrorBoundary feature="activos.donut">
            <Animated.View entering={motion.sectionDelayed(200)} style={{ marginTop: SECTION_GAP }}>
              <SectionHeader title="Dónde rinde tu dinero" />
              <Card variant="elevated" padded radius="lg">
                <AssetDonut
                  data={data.vaultAllocations}
                  weightedApy={data.weightedApy}
                  hidden={balanceHidden}
                />
              </Card>
            </Animated.View>
          </ScreenErrorBoundary>

          {/* Privacy footer */}
          <Animated.View
            entering={motion.sectionDelayed(260)}
            style={{ marginTop: 16, flexDirection: "row", gap: 12 }}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={colors.text.tertiary}
              style={{ marginTop: 2 }}
            />
            <Text variant="bodySmall" tone="tertiary" style={{ flex: 1 }}>
              Moneto reparte tu balance entre vaults usando cómputo encriptado. Ningún protocolo ve
              cuánto tenés.
            </Text>
          </Animated.View>
        </>
      )}

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

/**
 * Stat cell secundario — diseño.txt principle: el hero es la única
 * emphasis tipográfica. Las stats van en `text.secondary` con peso
 * normal y mono para legibilidad de números.
 */
function StatCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 15,
          lineHeight: 20,
          color: colors.text.secondary,
        }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
    </View>
  );
}
