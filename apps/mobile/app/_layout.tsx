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
import { QueryClientProvider } from "@tanstack/react-query";
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
import { usePushSetup } from "@/hooks/usePushSetup";
import { useThemePreferenceSync } from "@/hooks/useThemePreferenceSync";
import { setupNotificationHandler } from "@/lib/notifications";
import { bootObservability } from "@/lib/observability";
import { queryClient } from "@/lib/query-client";
import { OfflineBanner } from "@components/OfflineBanner";
import { useThemeStore } from "@stores/useThemeStore";

import "../global.css";

// Boot observability ANTES de cualquier render — Sentry necesita estar
// arriba para capturar crashes durante mount, PostHog para events de
// app_opened. No-op si los tokens públicos no están set.
bootObservability();

// Notification handler — debe estar arriba para que las notifs en
// foreground muestren banner. No-op safe en cada cold start.
setupNotificationHandler();

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

  // Provider chain (outside-in):
  // - QueryClientProvider: cache cross-screen para React Query.
  //   Vive arriba de PrivyProvider para que invalidations sobrevivan
  //   un Privy state flicker (auth refresh, etc).
  // - PrivyProvider: usePrivy hooks se llaman desde dentro de Shell.
  // - ThemeProvider: theme tokens disponibles a todo el subtree.
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
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

  // Push notifications — registra Expo token en backend on auth +
  // handles tap deep-links. No-op silent en simulator / permission deny.
  usePushSetup();

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
            name="cashout"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
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
            name="swap-success"
            options={{ presentation: "modal", animation: "fade" }}
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
          <Stack.Screen
            name="activos/[id]"
            options={{ presentation: "card", animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="transactions"
            options={{ presentation: "card", animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="tx/[signature]"
            options={{ presentation: "card", animation: "slide_from_right" }}
          />
        </Stack>
        {/* OfflineBanner — slide-down banner cuando perdemos conexión.
            Mounted top-level para que esté visible en cualquier ruta. */}
        <OfflineBanner />
        {/* PrivyElements monta UI overlays para flows OAuth (Apple/Google sheets). */}
        <PrivyElements />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
