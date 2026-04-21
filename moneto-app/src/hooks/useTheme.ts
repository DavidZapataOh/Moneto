import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type ThemeMode } from "@theme/colors";

export function useTheme() {
  const scheme = useColorScheme();
  // Moneto: dark mode is primary (alineado con tesis de privacidad/noche)
  const mode: ThemeMode = scheme === "light" ? "light" : "dark";
  const colors = mode === "dark" ? darkTheme : lightTheme;
  return { mode, colors, isDark: mode === "dark" };
}
