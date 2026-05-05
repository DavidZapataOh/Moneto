import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, Button, Logo, Divider, useTheme, haptics } from "@moneto/ui";
import { createLogger } from "@moneto/utils";
import { useEmbeddedSolanaWallet, useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import { useLoginWithPasskey } from "@privy-io/expo/passkey";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View, Pressable, StyleSheet, Dimensions } from "react-native";

import { isBiometryAvailable, reportAuthError, waitForSolanaWallet } from "@/lib/auth";
import { useAppStore } from "@stores/useAppStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Grid config
const GRID_CELL = 48; // 8pt grid múltiplo — 48pt cells se sienten "premium"
const GRID_AREA_H = SCREEN_H * 0.62; // cubre el top-portion, fade antes de los botones

const log = createLogger("auth.screen");

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
function GridPattern({ width, height, color }: { width: number; height: number; color: string }) {
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

  const { user, isReady } = usePrivy();
  const wallets = useEmbeddedSolanaWallet();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const handleSuccess = useCallback(async () => {
    haptics.success();

    // UI optimista: navegamos inmediato. El polling del wallet corre en
    // background — si falla, mostramos alert pero el user ya ve la
    // pantalla nueva (Privy reintenta wallet creation automáticamente).
    completeOnboarding();
    router.replace("/(tabs)");

    const address = await waitForSolanaWallet(() => extractFirstSolanaAddress(wallets), {
      timeoutMs: 10_000,
    });
    if (!address) {
      log.warn("solana wallet not ready after timeout — user can retry from /(tabs)");
      // No bloqueamos UI — el `usePrivyAuthSync` seguirá poll-eando y
      // cuando el wallet esté ready, el authState pasa a `authenticated`.
    }
  }, [completeOnboarding, router, wallets]);

  const handleError = useCallback(
    (error: unknown, method: AuthMethod) => {
      const mapped = reportAuthError(error, method, mode);
      setLoading(null);

      if (mapped.errorCode === "user_cancelled") {
        // No alert — el user dio "cancel", no es error.
        return;
      }

      haptics.error();
      Alert.alert("Error de autenticación", mapped.message, [{ text: "OK" }]);
    },
    [mode],
  );

  const { loginWithPasskey } = useLoginWithPasskey({
    onSuccess: handleSuccess,
    onError: (e) => handleError(e, "passkey"),
  });

  const { login: loginWithOAuth } = useLoginWithOAuth({
    onSuccess: handleSuccess,
    onError: (e: Error) => handleError(e, loading ?? "apple"),
  });

  // Auto-redirect si Privy ya restauró sesión activa al cold start.
  useEffect(() => {
    if (isReady && user) {
      router.replace("/(tabs)");
    }
  }, [isReady, user, router]);

  const handleAuth = useCallback(
    async (method: AuthMethod) => {
      if (loading !== null) return;
      setLoading(method);
      haptics.medium();

      try {
        if (method === "passkey") {
          const ok = await isBiometryAvailable();
          if (!ok) {
            handleError(new Error("Biometric not available on this device"), "passkey");
            return;
          }
          await loginWithPasskey({ relyingParty: "moneto.xyz" });
        } else {
          await loginWithOAuth({ provider: method });
        }
      } catch (err) {
        handleError(err, method);
      }
    },
    [loading, loginWithPasskey, loginWithOAuth, handleError],
  );

  // Líneas del grid tintadas con brand primary — le da calor y marca identidad,
  // no es gris neutro. Opacidad baja para que se lea como textura, no como UI.
  const gridLineColor = isDark ? "rgba(197, 103, 64, 0.22)" : "rgba(181, 69, 43, 0.14)";

  // Color del bg (ink-900 dark / cream-50 light) en rgba para los fades.
  const bgOpaque = isDark ? "rgba(20, 16, 11, 1)" : "rgba(251, 247, 239, 1)";
  const bgClear = isDark ? "rgba(20, 16, 11, 0)" : "rgba(251, 247, 239, 0)";

  const passkeyLabel = useMemo(() => {
    if (loading === "passkey") return "Verificando…";
    return "Continuar con Face ID";
  }, [loading]);

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
            <Text variant="heroDisplay" tone="primary" style={{ textAlign: "center" }}>
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

        {/* Bloque de botones — INTACTO visualmente, handlers ahora usan Privy real */}
        <View style={{ gap: 12 }}>
          <Button
            label={passkeyLabel}
            variant="primary"
            size="lg"
            fullWidth
            loading={loading === "passkey"}
            disabled={loading !== null && loading !== "passkey"}
            onPress={() => handleAuth("passkey")}
            leftIcon={<Ionicons name="shield-checkmark" size={18} color={colors.text.inverse} />}
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
            disabled={loading !== null && loading !== "apple"}
            onPress={() => handleAuth("apple")}
            leftIcon={<Ionicons name="logo-apple" size={20} color={colors.text.primary} />}
          />
          <Button
            label={loading === "google" ? "Entrando…" : "Continuar con Google"}
            variant="secondary"
            size="lg"
            fullWidth
            loading={loading === "google"}
            disabled={loading !== null && loading !== "google"}
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

/** Helper local — duck-typing del shape variable de useEmbeddedSolanaWallet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape varía por estado
function extractFirstSolanaAddress(wallets: any): string | null {
  if (!wallets || wallets.status !== "connected") return null;
  const list = wallets.wallets;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!first || typeof first.address !== "string") return null;
  return first.address;
}
