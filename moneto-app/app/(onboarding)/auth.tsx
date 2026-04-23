import { useState } from "react";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Button } from "@components/ui/Button";
import { Logo } from "@components/ui/Logo";
import { Divider } from "@components/ui/Divider";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { useAppStore } from "@stores/useAppStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Grid config
const GRID_CELL = 48; // 8pt grid múltiplo — 48pt cells se sienten "premium"
const GRID_AREA_H = SCREEN_H * 0.62; // cubre el top-portion, fade antes de los botones

type AuthMode = "signup" | "login";
type AuthMethod = "apple" | "google" | "passkey";

const COPY: Record<AuthMode, { title: string; subtitle?: string; terms: string }> = {
  signup: {
    title: "Creá tu\ncuenta",
    subtitle: "En 30 segundos estás dentro.",
    terms: "Al crear tu cuenta aceptás",
  },
  login: {
    title: "Bienvenido\nde nuevo",
    subtitle: "Un toque y estás dentro.",
    terms: "Al continuar aceptás",
  },
};

// Cuadrícula de líneas hairline. Sin bg. Solo trazos verticales + horizontales.
function GridPattern({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const cols = Math.ceil(width / GRID_CELL) + 1;
  const rows = Math.ceil(height / GRID_CELL) + 1;

  return (
    <>
      {Array.from({ length: cols }).map((_, i) => (
        <View
          key={`v-${i}`}
          style={{
            position: "absolute",
            left: i * GRID_CELL,
            top: 0,
            bottom: 0,
            width: StyleSheet.hairlineWidth,
            backgroundColor: color,
          }}
        />
      ))}
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={`h-${i}`}
          style={{
            position: "absolute",
            top: i * GRID_CELL,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ mode?: AuthMode }>();
  const mode: AuthMode = params.mode === "login" ? "login" : "signup";
  const copy = COPY[mode];
  const [loading, setLoading] = useState<AuthMethod | null>(null);
  const login = useAppStore((s) => s.login);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const handleAuth = async (method: AuthMethod) => {
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

  // Líneas del grid tintadas con brand primary — le da calor y marca identidad,
  // no es gris neutro. Opacidad baja para que se lea como textura, no como UI.
  const gridLineColor = isDark
    ? "rgba(197, 103, 64, 0.22)"
    : "rgba(181, 69, 43, 0.14)";

  // Color del bg (ink-900 dark / cream-50 light) en rgba para los fades.
  const bgOpaque = isDark ? "rgba(20, 16, 11, 1)" : "rgba(251, 247, 239, 1)";
  const bgClear = isDark ? "rgba(20, 16, 11, 0)" : "rgba(251, 247, 239, 0)";

  return (
    <Screen padded={false}>
      {/* Grid background — fade en los 4 bordes para mezclarse con el bg */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: GRID_AREA_H,
          overflow: "hidden",
        }}
      >
        <GridPattern width={SCREEN_W} height={GRID_AREA_H} color={gridLineColor} />

        {/* Top fade — se disuelve hacia el status bar */}
        <LinearGradient
          colors={[bgOpaque, bgClear]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100 }}
        />
        {/* Bottom fade — se disuelve antes de que empiecen los botones */}
        <LinearGradient
          colors={[bgClear, bgOpaque]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 180 }}
        />
        {/* Left fade */}
        <LinearGradient
          colors={[bgOpaque, bgClear]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 60 }}
        />
        {/* Right fade */}
        <LinearGradient
          colors={[bgClear, bgOpaque]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 60 }}
        />
      </View>

      {/* Content — paddingHorizontal manual porque Screen va sin padded */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 32 }}>
        {/* Back chevron */}
        <View style={{ paddingTop: 12 }}>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.back();
            }}
            hitSlop={16}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
        </View>

        {/* Brand block — centrado vertical y horizontalmente en el espacio libre */}
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
          }}
        >
          <Logo size={72} variant="mark" tone="brand" />
          <View style={{ gap: 12, alignItems: "center" }}>
            <Text
              variant="heroDisplay"
              tone="primary"
              style={{ textAlign: "center" }}
            >
              {copy.title}
            </Text>
            {copy.subtitle && (
              <Text
                variant="body"
                tone="secondary"
                style={{ textAlign: "center", lineHeight: 23, maxWidth: 320 }}
              >
                {copy.subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Bloque de botones — INTACTO */}
        <View style={{ gap: 12 }}>
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
            leftIcon={<Ionicons name="logo-apple" size={20} color={colors.text.primary} />}
          />
          <Button
            label={loading === "google" ? "Entrando…" : "Continuar con Google"}
            variant="secondary"
            size="lg"
            fullWidth
            loading={loading === "google"}
            onPress={() => handleAuth("google")}
            leftIcon={<Ionicons name="logo-google" size={20} color={colors.text.primary} />}
          />

          <Text
            variant="bodySmall"
            tone="tertiary"
            style={{ textAlign: "center", marginTop: 12, lineHeight: 18 }}
          >
            {copy.terms} nuestros{" "}
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
