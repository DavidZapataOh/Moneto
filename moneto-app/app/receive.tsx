import { useState } from "react";
import { View, Pressable, Share, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { IconButton } from "@components/ui/IconButton";
import { Badge } from "@components/ui/Badge";
import { Divider } from "@components/ui/Divider";
import { useAppStore } from "@stores/useAppStore";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { palette } from "@theme/colors";
import { fonts } from "@theme/typography";

export default function ReceiveScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const user = useAppStore((s) => s.user);
  const simulate = useAppStore((s) => s.simulateIncomingPayroll);
  const [copied, setCopied] = useState(false);

  const payrollLink = `moneto.xyz/pay/${user.handle.replace("@", "")}`;

  const handleCopy = async () => {
    haptics.success();
    await Clipboard.setStringAsync(`https://${payrollLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleShare = async () => {
    haptics.tap();
    try {
      await Share.share({
        message: `Pagáme en Moneto: https://${payrollLink}`,
      });
    } catch {}
  };

  const simulatePayroll = () => {
    haptics.success();
    simulate(3000);
    router.back();
  };

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
        <Text variant="h2">Recibir</Text>
        <IconButton
          icon={<Ionicons name="close" size={20} color={colors.text.primary} />}
          variant="filled"
          size="sm"
          onPress={() => router.back()}
          label="Cerrar"
        />
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: "center", marginBottom: 28 }}>
        <View
          style={{
            padding: 20,
            borderRadius: 28,
            backgroundColor: palette.cream[50],
            shadowColor: palette.ink[900],
            shadowOpacity: 0.15,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
          }}
        >
          <QRCode
            value={`https://${payrollLink}`}
            size={220}
            color={palette.ink[900]}
            backgroundColor={palette.cream[50]}
            logoBackgroundColor={palette.terracota[500]}
            logoSize={40}
            logoBorderRadius={8}
            ecl="H"
          />
        </View>

        <Badge
          label="Recepción privada"
          tone="value"
          size="md"
          icon={<Ionicons name="lock-closed" size={10} color={colors.value} />}
        />
      </Animated.View>

      {/* Payroll link */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)}>
        <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
          Tu payroll link
        </Text>
        <Pressable onPress={handleCopy}>
          <Card variant="outlined" padded radius="md">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 14,
                    color: colors.text.primary,
                  }}
                  numberOfLines={1}
                >
                  {payrollLink}
                </Text>
                <Text variant="bodySmall" tone="tertiary">
                  Compártelo con tu empleador · USD entra privado
                </Text>
              </View>
              <Ionicons
                name={copied ? "checkmark-circle" : "copy-outline"}
                size={20}
                color={copied ? colors.success : colors.text.tertiary}
              />
            </View>
          </Card>
        </Pressable>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(160)}
        style={{ flexDirection: "row", gap: 10, marginTop: 14 }}
      >
        <View style={{ flex: 1 }}>
          <Button
            label="Compartir"
            variant="primary"
            fullWidth
            onPress={handleShare}
            leftIcon={
              <Ionicons name="share-outline" size={16} color={colors.text.inverse} />
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={copied ? "Copiado" : "Copiar"}
            variant="secondary"
            fullWidth
            onPress={handleCopy}
            leftIcon={
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={16}
                color={colors.text.primary}
              />
            }
          />
        </View>
      </Animated.View>

      {/* What happens */}
      <Animated.View
        entering={FadeInDown.duration(400).delay(240)}
        style={{ marginTop: 28 }}
      >
        <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
          Qué pasa cuando pagan
        </Text>
        <Card variant="sunken" padded radius="md">
          <StepRow
            n={1}
            title="USD llegan"
            sub="Aparecen en tu saldo sin intermediarios"
          />
          <Divider />
          <StepRow
            n={2}
            title="Se shield automáticamente"
            sub="Balance encriptado via Umbra · 0 visibles en chain"
          />
          <Divider />
          <StepRow
            n={3}
            title="Empieza a rendir 6.2% APY"
            sub="Sin mover nada. Ruteado al mejor vault privado"
          />
        </Card>
      </Animated.View>

      {/* Demo: simulate payroll */}
      <Pressable
        onPress={simulatePayroll}
        style={({ pressed }) => ({
          marginTop: 20,
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border.subtle,
          borderStyle: "dashed",
          alignItems: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text variant="bodySmall" tone="tertiary">
          🧪 Simular recepción $3,000 USD (demo)
        </Text>
      </Pressable>
    </Screen>
  );
}

function StepRow({ n, title, sub }: { n: number; title: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.bg.elevated,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 12,
            color: colors.text.primary,
          }}
        >
          {n}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="bodySmall" tone="tertiary">
          {sub}
        </Text>
      </View>
    </View>
  );
}
