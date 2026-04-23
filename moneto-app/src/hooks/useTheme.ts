import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type ThemeMode } from "@theme/colors";
import { useThemeStore } from "@stores/useThemeStore";

export function useTheme() {
  const scheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);

  // Si el user eligió manualmente, respetamos esa elección.
  // Si está en "system", caemos al OS scheme (default: dark, alineado con
  // tesis de privacidad/noche).
  const mode: ThemeMode =
    preference === "light"
      ? "light"
      : preference === "dark"
        ? "dark"
        : scheme === "light"
          ? "light"
          : "dark";

  const colors = mode === "dark" ? darkTheme : lightTheme;
  return { mode, colors, isDark: mode === "dark" };
}
