import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Avatar } from "@components/ui/Avatar";
import { Divider } from "@components/ui/Divider";
import { SectionHeader } from "@components/ui/ScreenHeader";
import { BalanceHero } from "@components/features/BalanceHero";
import { QuickActions } from "@components/features/QuickActions";
import { TransactionRow } from "@components/features/TransactionRow";
import { YieldChart } from "@components/features/YieldChart";
import { AssetStrip } from "@components/features/AssetStrip";
import { useAppStore } from "@stores/useAppStore";
import { mockYieldHistory, mockAssets } from "@data/mock";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@hooks/useHaptics";
import { getGreeting } from "@lib/format";

// Spacing system (8-pt grid):
// - SCREEN_PADDING: 20 (handled by Screen padded=true)
// - SECTION_GAP: 32 (entre sección y sección)
// - CARD_RADIUS: 20 (todas las cards de esta screen)
// - ROW_HEIGHT: ~68 (avatar 40 + padding 14×2)

const SECTION_GAP = 32;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const balance = useAppStore((s) => s.balance);
  const transactions = useAppStore((s) => s.transactions).slice(0, 5);
  const balanceHidden = useAppStore((s) => s.balanceHidden);
  const toggleBalanceVisibility = useAppStore((s) => s.toggleBalanceVisibility);
  const bottomSpace = useTabBarSpace();

  return (
    <Screen padded edges={["top"]} scroll>
      {/* Top bar — altura 44 (tap target mínimo iOS) + respiro del safe area */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          marginTop: 16,
          marginBottom: 36,
        }}
      >
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push("/(tabs)/profile");
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          hitSlop={8}
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
          <HeaderIconButton
            icon="scan-outline"
            onPress={() => haptics.tap()}
          />
          <HeaderIconButton
            icon="notifications-outline"
            hasBadge
            onPress={() => haptics.tap()}
          />
        </View>
      </View>

      {/* Balance hero — única emphasis de la pantalla */}
      <Animated.View entering={FadeInDown.duration(400).delay(40)}>
        <BalanceHero
          balance={balance.totalUsd}
          yieldApy={balance.yieldApy}
          hidden={balanceHidden}
          onToggleVisibility={toggleBalanceVisibility}
        />
      </Animated.View>

      {/* Quick actions */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(120)}
        style={{ marginTop: SECTION_GAP }}
      >
        <QuickActions />
      </Animated.View>

      {/* Asset strip — horizontal scroll */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(160)}
        style={{ marginTop: SECTION_GAP }}
      >
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
        <AssetStrip assets={mockAssets} />
      </Animated.View>

      {/* Yield module — card clickable */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={{ marginTop: SECTION_GAP }}
      >
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
                +${balance.yieldAccruedMonth.toFixed(2)}
              </Text>
              <Text variant="bodySmall" tone="tertiary">
                este mes · {(balance.yieldApy * 100).toFixed(2)}% APY
              </Text>
            </View>
            <YieldChart points={mockYieldHistory} height={72} />
          </Card>
        </Pressable>
      </Animated.View>

      {/* Transactions — rows flat dentro de card padded=false */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(280)}
        style={{ marginTop: SECTION_GAP }}
      >
        <SectionHeader
          title="Movimientos"
          action={{
            label: "Ver todos",
            onPress: () => haptics.tap(),
          }}
        />
        <Card variant="elevated" padded={false} radius="lg">
          {transactions.map((tx, i) => (
            <View key={tx.id}>
              <TransactionRow tx={tx} onPress={() => haptics.tap()} />
              {i < transactions.length - 1 && (
                <View style={{ paddingHorizontal: 16 }}>
                  <Divider />
                </View>
              )}
            </View>
          ))}
        </Card>
      </Animated.View>

      <View style={{ height: bottomSpace }} />
    </Screen>
  );
}

function HeaderIconButton({
  icon,
  onPress,
  hasBadge = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  hasBadge?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={22} color={colors.text.primary} />
      {hasBadge && (
        <View
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.brand.primary,
            borderWidth: 2,
            borderColor: colors.bg.primary,
          }}
        />
      )}
    </Pressable>
  );
}
