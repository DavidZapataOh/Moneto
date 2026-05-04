/**
 * @moneto/theme — design tokens.
 *
 * Pure data, sin React. Consumido por `@moneto/ui` (componentes), `apps/mobile`
 * (tailwind / inline styles), `apps/web` (tailwind config + CSS vars).
 *
 * Reglas:
 * - Cero literales de color en componentes — siempre via `useTheme()` o tokens.
 * - JetBrains Mono SOLO para amounts/IDs/timestamps (`type.balanceHero`,
 *   `type.amountPrimary`, `type.amountSecondary`, `type.mono`).
 * - Spacing y radius siempre via tokens — nunca números arbitrarios.
 */

export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./radius";
export * from "./shadows";
export * from "./animation";

import { darkTheme, lightTheme } from "./colors";

export type ThemeMode = "dark" | "light";

export const getTheme = (mode: ThemeMode) => (mode === "dark" ? darkTheme : lightTheme);
