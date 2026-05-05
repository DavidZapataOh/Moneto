import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Text,
  Card,
  Avatar,
  Divider,
  SectionHeader,
  haptics,
  useEntrances,
  useTheme,
} from "@moneto/ui";
import { getGreeting } from "@moneto/utils";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { View, Pressable, RefreshControl } from "react-native";
import Animated from "react-native-reanimated";

import { capture, Events, getPostHog } from "@/lib/observability";
import { AssetStrip } from "@components/features/AssetStrip";
import { BalanceHero } from "@components/features/BalanceHero";
import { EmptyTransactions } from "@components/features/EmptyTransactions";
import { QuickActions } from "@components/features/QuickActions";
import { TransactionRow } from "@components/features/TransactionRow";
import { YieldChart } from "@components/features/YieldChart";
import { ScreenErrorBoundary } from "@components/ScreenErrorBoundary";
import { Skeleton, BalanceSkeleton, TxRowSkeleton } from "@components/Skeleton";
import { mockYieldHistory } from "@data/mock";
import { useDashboardData } from "@hooks/useDashboardData";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { useUnreadNotificationCount } from "@hooks/useUnreadNotificationCount";
import { useAppStore } from "@stores/useAppStore";

// Spacing system (8-pt grid):
// - SCREEN_PADDING: 20 (handled by Screen padded=true)
// - SECTION_GAP: 32 (entre sección y sección)
// - CARD_RADIUS: 20 (todas las cards de esta screen)
// - ROW_HEIGHT: ~68 (avatar 40 + padding 14×2)
const SECTION_GAP = 32;

const TX_PREVIEW_COUNT = 5;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const balanceHidden = useAppStore((s) => s.balanceHidden);
  const toggleBalanceVisibility = useAppStore((s) => s.toggleBalanceVisibility);
  const bottomSpace = useTabBarSpace();
  const unreadCount = useUnreadNotificationCount();
  const dashboard = useDashboardData();

  const isLoading = dashboard.status === "loading";
  const recentTxs = dashboard.transactions.slice(0, TX_PREVIEW_COUNT);
  const motion = useEntrances();

  const handleRefresh = useCallback(async () => {
    haptics.tap();
    const ph = getPostHog();
    if (ph) capture(ph, Events.dashboard_refresh, { screen: "saldo" });
    await dashboard.refresh();
    haptics.success();
  }, [dashboard]);

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
            // Android: el spinner es un círculo, le damos color de marca.
            colors={[colors.brand.primary]}
            progressBackgroundColor={colors.bg.elevated}
          />
        ),
      }}
    >
      {/* Top bar — altura 44 (tap target mínimo iOS) + respiro del safe area */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/(tabs)/profile");
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil de ${user.name}`}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={user.name} size="sm" tone="brand" />
            <View style={{ gap: 2 }}>
              <Text variant="label" tone="tertiary">
                {getGreeting()}
              </Text>
              <Text variant="bodyMedium">{user.name.split(" ")[0]}</Text>
            </View>
          </View>
        </Pressable>

        <View style={{ flexDirection: "row", gap: 4 }}>
          <HeaderIconButton icon="scan-outline" label="Escanear QR" onPress={() => haptics.tap()} />
          <HeaderIconButton
            icon="notifications-outline"
            label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
            unreadCount={unreadCount}
            onPress={() => haptics.tap()}
          />
        </View>
      </View>

      {/* Balance hero — única emphasis de la pantalla. Wrapped en boundary
          porque un fallo en BalanceHero (Reanimated worklet, format crash)
          rompería la pantalla entera y esta es la zona más crítica. */}
      <ScreenErrorBoundary feature="saldo.balance-hero">
        <Animated.View entering={motion.sectionDelayed(40)}>
          {isLoading ? (
            <BalanceSkeleton />
          ) : (
            <BalanceHero
              balance={dashboard.balance.totalUsd}
              yieldApy={dashboard.balance.yieldApy}
              hidden={balanceHidden}
              onToggleVisibility={toggleBalanceVisibility}
            />
          )}
        </Animated.View>
      </ScreenErrorBoundary>

      {/* Quick actions */}
      <Animated.View entering={motion.sectionDelayed(120)} style={{ marginTop: SECTION_GAP }}>
        <QuickActions />
      </Animated.View>

      {/* Asset strip — horizontal scroll */}
      <Animated.View entering={motion.sectionDelayed(160)} style={{ marginTop: SECTION_GAP }}>
        <SectionHeader
          title="Tus activos"
          action={{
            label: "Ver todos",
            onPress: () => {
              haptics.tap();
              router.push("/(tabs)/activos");
            },
          }}
        />
        {isLoading ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={120} height={88} radius={16} />
            ))}
          </View>
        ) : (
          <AssetStrip assets={dashboard.assets} />
        )}
      </Animated.View>

      {/* Yield module — card clickable */}
      <Animated.View entering={motion.sectionDelayed(200)} style={{ marginTop: SECTION_GAP }}>
        <SectionHeader
          title="Rendimiento"
          action={{
            label: "Ver detalle",
            onPress: () => {
              haptics.tap();
              router.push("/(tabs)/activos");
            },
          }}
        />
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/(tabs)/activos");
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver detalle de rendimiento"
        >
          <Card variant="elevated" padded radius="lg">
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Text variant="amountPrimary" tone="value" style={{ fontSize: 24 }}>
                +${dashboard.balance.yieldAccruedMonth.toFixed(2)}
              </Text>
              <Text variant="bodySmall" tone="tertiary">
                este mes · {(dashboard.balance.yieldApy * 100).toFixed(2)}% APY
              </Text>
            </View>
            <YieldChart points={mockYieldHistory} height={72} />
          </Card>
        </Pressable>
      </Animated.View>

      {/* Transactions — boundary aísla a la sección. Si la lista crash-ea
          (e.g., date format de tx malformada), el resto de Saldo sigue
          funcional con su retry button propio. */}
      <ScreenErrorBoundary feature="saldo.transactions">
        <Animated.View entering={motion.sectionDelayed(280)} style={{ marginTop: SECTION_GAP }}>
          <SectionHeader
            title="Movimientos"
            {...(recentTxs.length > 0
              ? {
                  action: {
                    label: "Ver todos",
                    onPress: () => haptics.tap(),
                  },
                }
              : {})}
          />
          <Card variant="elevated" padded={false} radius="lg">
            {isLoading ? (
              <>
                {[0, 1, 2, 3].map((i, _arr, arr = [0, 1, 2, 3]) => (
                  <View key={i}>
                    <TxRowSkeleton />
                    {i < arr.length - 1 ? (
                      <View style={{ paddingHorizontal: 16 }}>
                        <Divider />
                      </View>
                    ) : null}
                  </View>
                ))}
              </>
            ) : recentTxs.length === 0 ? (
              <EmptyTransactions />
            ) : (
              recentTxs.map((tx, i) => (
                <View key={tx.id}>
                  <TransactionRow tx={tx} onPress={() => haptics.tap()} />
                  {i < recentTxs.length - 1 && (
                    <View style={{ paddingHorizontal: 16 }}>
                      <Divider />
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        </Animated.View>
      </ScreenErrorBoundary>

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

/**
 * Header icon button con press feedback + badge dot opcional.
 *
 * Por qué dot (no número): el espacio top-right es premium, cualquier
 * número compite con el balance hero por la atención visual. Un dot
 * indica "hay algo nuevo" sin distraer; el count exacto se ve al abrir
 * la screen de notificaciones.
 */
function HeaderIconButton({
  icon,
  onPress,
  unreadCount = 0,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  unreadCount?: number;
  label: string;
}) {
  const { colors } = useTheme();
  const hasBadge = unreadCount > 0;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={colors.text.primary} />
      {hasBadge && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: colors.bg.primary,
          }}
        />
      )}
    </Pressable>
  );
}
