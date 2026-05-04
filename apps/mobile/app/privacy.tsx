import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Text, Card, IconButton, Badge, Divider, useTheme, haptics } from "@moneto/ui";
import { useAppStore } from "@stores/useAppStore";
import { fonts } from "@moneto/theme";

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const viewingKeys = useAppStore((s) => s.viewingKeys);

  return (
    <Screen padded scroll edges={["top", "bottom"]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 4,
          marginBottom: 20,
        }}
      >
        <Text variant="h2">Privacidad</Text>
        <IconButton
          icon={<Ionicons name="close" size={20} color={colors.text.primary} />}
          variant="filled"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Cerrar"
        />
      </View>

      {/* Status card */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card variant="sunken" padded radius="xl">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(200, 148, 80, 0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield-checkmark" size={22} color={colors.value} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Balance protegido</Text>
              <Text variant="bodySmall" tone="secondary">
                Shielded via Umbra SDK
              </Text>
            </View>
            <Badge label="Activo" tone="success" size="sm" />
          </View>

          <Divider style={{ marginVertical: 14 }} />

          <View style={{ gap: 8 }}>
            <PrivacyStatRow
              icon="eye-off-outline"
              label="Tu saldo on-chain"
              value="Encriptado"
              tone="success"
            />
            <PrivacyStatRow
              icon="git-network-outline"
              label="Transacciones P2P"
              value="Privadas por default"
              tone="success"
            />
            <PrivacyStatRow
              icon="people-outline"
              label="Anonymity set"
              value="~23,400 users"
              tone="neutral"
            />
          </View>
        </Card>
      </Animated.View>

      {/* Viewing keys */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(80)}
        style={{ marginTop: 28 }}
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
            Viewing keys activas
          </Text>
          <Pressable
            onPress={() => {
              haptics.tap();
            }}
            hitSlop={8}
          >
            <Text variant="bodySmall" tone="brand">
              + Nueva
            </Text>
          </Pressable>
        </View>

        {viewingKeys.length === 0 ? (
          <Card variant="outlined" padded>
            <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
              No tenés keys compartidas.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {viewingKeys.map((vk) => {
              const daysLeft = Math.max(
                0,
                Math.floor((vk.expiresAt - Date.now()) / (24 * 3600 * 1000))
              );
              return (
                <Card key={vk.id} variant="outlined" padded radius="md">
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.bg.overlay,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="key-outline"
                        size={16}
                        color={colors.text.primary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="bodyMedium">{vk.label}</Text>
                      <Text variant="bodySmall" tone="tertiary">
                        {vk.scope}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                        <Badge label={vk.sharedWith} tone="neutral" size="sm" />
                        <Badge
                          label={daysLeft > 0 ? `Expira en ${daysLeft}d` : "Expirada"}
                          tone={daysLeft > 7 ? "neutral" : "warning"}
                          size="sm"
                        />
                      </View>
                    </View>
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={colors.text.tertiary}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* Actions */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(160)}
        style={{ marginTop: 28, gap: 10 }}
      >
        <Text variant="label" tone="secondary" style={{ marginBottom: 4 }}>
          Acciones rápidas
        </Text>
        <ActionRow
          icon="document-text-outline"
          label="Generar reporte fiscal"
          sub="PDF para contador · SAT · DIAN · AFIP"
          onPress={() => haptics.tap()}
        />
        <ActionRow
          icon="flash-outline"
          label="Proof of income"
          sub="ZK proof de ingresos sin revelar saldo"
          onPress={() => haptics.tap()}
        />
        <ActionRow
          icon="alert-circle-outline"
          label="Auditar uso de viewing keys"
          sub="Ver quién accedió y cuándo"
          onPress={() => haptics.tap()}
        />
      </Animated.View>

      {/* Disclosure */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(240)}
        style={{ marginTop: 24 }}
      >
        <Card variant="outlined" padded radius="md">
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.text.secondary}
              style={{ marginTop: 2 }}
            />
            <Text variant="bodySmall" tone="secondary" style={{ flex: 1, lineHeight: 19 }}>
              Moneto usa privacidad selectiva, no anonimato. Viewing keys te permiten compartir transacciones específicas con compliance, sin exponer tu historial completo.
            </Text>
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}

function PrivacyStatRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "success" | "neutral";
}) {
  const { colors } = useTheme();
  const valueColor = tone === "success" ? colors.success : colors.text.primary;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon} size={14} color={colors.text.tertiary} />
      <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 13,
          color: valueColor,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border.subtle,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bg.elevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={16} color={colors.text.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">{label}</Text>
          <Text variant="bodySmall" tone="tertiary">
            {sub}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </View>
    </Pressable>
  );
}
