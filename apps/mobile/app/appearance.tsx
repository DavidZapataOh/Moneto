import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@moneto/ui";
import { Text } from "@moneto/ui";
import { Card } from "@moneto/ui";
import { Divider } from "@moneto/ui";
import { useTheme } from "@moneto/ui";
import { haptics } from "@moneto/ui";
import {
  useThemeStore,
  type ThemePreference,
} from "@stores/useThemeStore";

type Option = {
  value: ThemePreference;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const OPTIONS: Option[] = [
  {
    value: "system",
    label: "Automático",
    sub: "Sigue el sistema",
    icon: "contrast-outline",
  },
  {
    value: "light",
    label: "Claro",
    sub: "Fondo cream",
    icon: "sunny-outline",
  },
  {
    value: "dark",
    label: "Oscuro",
    sub: "Fondo ink",
    icon: "moon-outline",
  },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <Screen padded edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 16,
        }}
      >
        <Pressable
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          hitSlop={16}
        >
          <Ionicons name="close" size={22} color={colors.text.primary} />
        </Pressable>
        <Text variant="bodyMedium">Apariencia</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={{ gap: 8, marginTop: 16 }}>
        <Text variant="body" tone="secondary" style={{ lineHeight: 22 }}>
          Elegí cómo se ve Moneto. Tu elección se guarda entre sesiones.
        </Text>
      </View>

      <Card variant="elevated" padded={false} radius="lg" style={{ marginTop: 24 }}>
        {OPTIONS.map((opt, i) => {
          const selected = preference === opt.value;
          return (
            <View key={opt.value}>
              <Pressable
                onPress={() => {
                  haptics.select();
                  setPreference(opt.value);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: selected
                        ? "rgba(197, 103, 64, 0.18)"
                        : "rgba(255, 255, 255, 0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={
                        selected ? colors.brand.primary : colors.text.secondary
                      }
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodyMedium" style={{ marginBottom: 2 }}>
                      {opt.label}
                    </Text>
                    <Text variant="bodySmall" tone="tertiary">
                      {opt.sub}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.brand.primary}
                    />
                  )}
                </View>
              </Pressable>
              {i < OPTIONS.length - 1 && (
                <View style={{ paddingHorizontal: 16 }}>
                  <Divider />
                </View>
              )}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
