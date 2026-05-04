import { useTheme } from "@moneto/ui";
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: "fade",
      }}
    />
  );
}
