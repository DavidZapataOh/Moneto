import { darkTheme, lightTheme, type ThemeColors, type ThemeMode } from "@moneto/theme";
import { createContext, useMemo, type ReactNode } from "react";

export interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  mode: ThemeMode;
  children: ReactNode;
}

/**
 * Wraps the app and exposes theme tokens via context.
 *
 * The mobile app resolves `mode` via `useThemeStore` + `useColorScheme()`
 * and passes the result here. UI components consume via `useTheme()`.
 */
export function ThemeProvider({ mode, children }: ThemeProviderProps) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "dark" ? darkTheme : lightTheme,
      isDark: mode === "dark",
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
