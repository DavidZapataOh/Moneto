export * from "./colors";
export * from "./typography";
export * from "./spacing";

import { darkTheme, lightTheme } from "./colors";

export type ThemeMode = "dark" | "light";

export const getTheme = (mode: ThemeMode) => (mode === "dark" ? darkTheme : lightTheme);
