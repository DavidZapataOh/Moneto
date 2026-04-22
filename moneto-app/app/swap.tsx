import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { IconButton } from "@components/ui/IconButton";
import { useTheme } from "@hooks/useTheme";

/**
 * Swap modal — placeholder MVP.
 * Post-hackathon: embebe Jupiter SDK para swap real entre assets.
 */
export default function SwapScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Screen padded edges={["top", "bottom"]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 4,
          marginBottom: 24,
        }}
      >
        <Text variant="h2">Convertir</Text>
        <IconButton
          icon={<Ionicons name="close" size={20} color={colors.text.primary} />}
          variant="filled"
          size="sm"
          onPress={() => router.back()}
          label="Cerrar"
        />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="swap-horizontal" size={32} color={colors.brand.primary} />
        </View>
        <Text variant="h3" style={{ textAlign: "center" }}>
          Swap entre assets
        </Text>
        <Text
          variant="bodySmall"
          tone="tertiary"
          style={{ textAlign: "center", maxWidth: 280, lineHeight: 18 }}
        >
          Convertí entre USD, COP, BTC, SOL y ETH con las mejores rutas vía Jupiter. Próximamente.
        </Text>
      </View>
    </Screen>
  );
}
