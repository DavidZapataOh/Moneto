import { useContext } from "react";

import { ThemeContext, type ThemeContextValue } from "../providers/ThemeProvider";

/**
 * Reads theme tokens from the nearest <ThemeProvider>.
 *
 * Throws if not wrapped — production-grade fail-loud (catches missing provider in dev).
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      "useTheme() called outside <ThemeProvider>. Wrap your app root with <ThemeProvider mode={mode}>.",
    );
  }
  return ctx;
}
