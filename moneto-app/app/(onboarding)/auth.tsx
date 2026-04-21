import { useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Button } from "@components/ui/Button";
import { Logo } from "@components/ui/Logo";
import { Divider } from "@components/ui/Divider";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { useAppStore } from "@stores/useAppStore";

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);
  const login = useAppStore((s) => s.login);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const handleAuth = async (method: "apple" | "google" | "passkey") => {
    setLoading(method);
    haptics.medium();

    // Simulación: en producción aquí va Privy embedded wallet flow
    await new Promise((r) => setTimeout(r, 900));

    if (method === "passkey") {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Autenticate para entrar a Moneto",
          fallbackLabel: "Usar código",
        });
        if (!result.success) {
          setLoading(null);
          return;
        }
      } catch {
        // Continúa simulado en web
      }
    }

    haptics.success();
    completeOnboarding();
    login();
    setLoading(null);
    router.replace("/(tabs)");
  };

  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 32 }}>
        <View style={{ gap: 28, paddingTop: 12 }}>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            hitSlop={16}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>

          <View style={{ gap: 12 }}>
            <Logo size={48} variant="mark" tone="brand" />
            <Text variant="heroDisplay" tone="primary">
              Bienvenida{"\n"}de nuevo
            </Text>
            <Text variant="body" tone="secondary" style={{ lineHeight: 23 }}>
              Entrá con biometría o tu método preferido. Nunca pedimos contraseña.
            </Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {/* Passkey principal */}
          <Button
            label={loading === "passkey" ? "Verificando…" : "Continuar con Face ID"}
            variant="primary"
            size="lg"
            fullWidth
            loading={loading === "passkey"}
            onPress={() => handleAuth("passkey")}
            leftIcon={
              <Ionicons name="shield-checkmark" size={18} color={colors.text.inverse} />
            }
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginVertical: 4,
            }}
          >
            <Divider style={{ flex: 1 }} />
            <Text variant="bodySmall" tone="tertiary">
              o
            </Text>
            <Divider style={{ flex: 1 }} />
          </View>

          <Button
            label={loading === "apple" ? "Entrando…" : "Continuar con Apple"}
            variant="secondary"
            size="lg"
            fullWidth
            loading={loading === "apple"}
            onPress={() => handleAuth("apple")}
            leftIcon={<AntDesign name="apple1" size={18} color={colors.text.primary} />}
          />
          <Button
            label={loading === "google" ? "Entrando…" : "Continuar con Google"}
            variant="secondary"
            size="lg"
            fullWidth
            loading={loading === "google"}
            onPress={() => handleAuth("google")}
            leftIcon={<AntDesign name="google" size={18} color={colors.text.primary} />}
          />

          <Text
            variant="bodySmall"
            tone="tertiary"
            style={{ textAlign: "center", marginTop: 12, lineHeight: 18 }}
          >
            Al continuar aceptás nuestros{" "}
            <Text variant="bodySmall" tone="brand">
              Términos
            </Text>{" "}
            y{" "}
            <Text variant="bodySmall" tone="brand">
              Privacidad
            </Text>
            .
          </Text>
        </View>
      </View>
    </Screen>
  );
}
