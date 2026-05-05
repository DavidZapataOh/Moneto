import { useFonts, Fraunces_400Regular, Fraunces_500Medium } from "@expo-google-fonts/fraunces";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { palette, type ThemeMode } from "@moneto/theme";
import { ThemeProvider, useTheme } from "@moneto/ui";
import { PrivyProvider } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAutoLogoutOnExpired } from "@/hooks/useAutoLogoutOnExpired";
import { usePrivyAuthSync } from "@/hooks/usePrivyAuthSync";
import { useThemePreferenceSync } from "@/hooks/useThemePreferenceSync";
import { bootObservability } from "@/lib/observability";
import { useThemeStore } from "@stores/useThemeStore";

import "../global.css";

// Boot observability ANTES de cualquier render — Sentry necesita estar
// arriba para capturar crashes durante mount, PostHog para events de
// app_opened. No-op si los tokens públicos no están set.
bootObservability();

SplashScreen.preventAutoHideAsync();

const PRIVY_APP_ID = process.env["EXPO_PUBLIC_PRIVY_APP_ID"] ?? "";
const PRIVY_CLIENT_ID = process.env["EXPO_PUBLIC_PRIVY_CLIENT_ID"];

export default function RootLayout() {
  const scheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);

  const mode: ThemeMode = useMemo(() => {
    if (preference === "light") return "light";
    if (preference === "dark") return "dark";
    return scheme === "light" ? "light" : "dark";
  }, [preference, scheme]);

  const [loaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  // PrivyProvider DEBE wrappear ThemeProvider — usePrivy hooks se llaman
  // desde dentro de Shell, así que necesitan el contexto Privy disponible.
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      {...(PRIVY_CLIENT_ID ? { clientId: PRIVY_CLIENT_ID } : {})}
      config={{
        embedded: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <ThemeProvider mode={mode}>
        <Shell />
      </ThemeProvider>
    </PrivyProvider>
  );
}

function Shell() {
  const { isDark } = useTheme();

  // Sync Privy state → Zustand authState. Single writer, idempotent.
  usePrivyAuthSync();

  // Auto-logout silencioso si el authState llega a `"expired"` (refresh
  // del Privy token falló). Llama performLogoutCleanup + navigate sin UI.
  useAutoLogoutOnExpired();

  // Sync theme preference local ⇄ remote (Supabase user_preferences).
  // Pull on login (last-write-wins), push debounced en cambios locales.
  useThemePreferenceSync();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? palette.ink[900] : palette.cream[50]);
  }, [isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: isDark ? palette.ink[900] : palette.cream[50],
            },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="receive"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="send"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="send-success"
            options={{ presentation: "modal", animation: "fade" }}
          />
          <Stack.Screen
            name="privacy"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="swap"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="appearance"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="kyc"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="asset-priorities"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
        {/* PrivyElements monta UI overlays para flows OAuth (Apple/Google sheets). */}
        <PrivyElements />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
