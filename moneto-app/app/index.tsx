import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useAppStore } from "@stores/useAppStore";

export default function Root() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }
  if (!isAuthenticated) {
    return <Redirect href="/(onboarding)/auth" />;
  }
  return <Redirect href="/(tabs)" />;
}
