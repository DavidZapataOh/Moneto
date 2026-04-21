import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Avatar } from "@components/ui/Avatar";
import { IconButton } from "@components/ui/IconButton";
import { Divider } from "@components/ui/Divider";
import { BalanceHero } from "@components/features/BalanceHero";
import { QuickActions } from "@components/features/QuickActions";
import { TransactionRow } from "@components/features/TransactionRow";
import { YieldChart } from "@components/features/YieldChart";
import { useAppStore } from "@stores/useAppStore";
import { mockYieldHistory } from "@data/mock";
import { useTheme } from "@hooks/useTheme";
import { useTabBarSpace } from "@hooks/useTabBarSpace";
import { haptics } from "@hooks/useHaptics";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAppStore((s) => s.user);
  const balance = useAppStore((s) => s.balance);
  const transactions = useAppStore((s) => s.transactions).slice(0, 6);
  const balanceHidden = useAppStore((s) => s.balanceHidden);
  const toggleBalanceVisibility = useAppStore((s) => s.toggleBalanceVisibility);
  const bottomSpace = useTabBarSpace();

  return (
    <Screen padded={false} edges={["top"]} scroll>
      <View style={{ paddingHorizontal: 20 }}>
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 8,
            paddingBottom: 28,
          }}
        >
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push("/(tabs)/profile");
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            hitSlop={8}
          >
            <Avatar name={user.name} size="sm" tone="brand" />
            <View>
              <Text variant="bodySmall" tone="tertiary">
                Hola,
              </Text>
              <Text variant="bodyMedium">{user.name.split(" ")[0]}</Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 6 }}>
            <IconButton
              icon={<Ionicons name="search-outline" size={20} color={colors.text.primary} />}
              variant="filled"
              size="sm"
              onPress={() => {}}
              label="Buscar"
            />
            <IconButton
              icon={
                <View>
                  <Ionicons name="notifications-outline" size={20} color={colors.text.primary} />
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.brand.primary,
                    }}
                  />
                </View>
              }
              variant="filled"
              size="sm"
              onPress={() => {}}
              label="Notificaciones"
            />
          </View>
        </View>

        {/* Balance hero */}
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
          style={{ marginTop: 32 }}
        >
          <QuickActions />
        </Animated.View>

        {/* Yield chart mini */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={{ marginTop: 28 }}
        >
          <Card variant="sunken" padded radius="xl">
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <View style={{ gap: 4 }}>
                <Text variant="label" tone="secondary">
                  Rendimiento
                </Text>
                <Text variant="amountPrimary" tone="value">
                  +${balance.yieldAccruedMonth.toFixed(2)}{" "}
                  <Text variant="bodySmall" tone="tertiary">
                    este mes
                  </Text>
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push("/(tabs)/yield");
                }}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Pressable>
            </View>
            <YieldChart points={mockYieldHistory} height={72} />
          </Card>
        </Animated.View>

        {/* Transacciones recientes */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(280)}
          style={{ marginTop: 32 }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text variant="label" tone="secondary">
              Movimientos
            </Text>
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push("/(tabs)/profile");
              }}
              hitSlop={8}
            >
              <Text variant="bodySmall" tone="brand">
                Ver todo
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 2 }}>
            {transactions.map((tx, i) => (
              <View key={tx.id}>
                <TransactionRow tx={tx} onPress={() => {}} />
                {i < transactions.length - 1 && <Divider />}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Footer spacing for tab bar + home indicator */}
        <View style={{ height: bottomSpace }} />
      </View>
    </Screen>
  );
}
