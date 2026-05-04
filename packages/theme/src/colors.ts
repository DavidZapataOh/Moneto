/**
 * Moneto color tokens
 * Temperatura cálida consistente. Ningún gris es frío, ningún negro es puro.
 * Terracota es el único color saturado del sistema.
 */

export const palette = {
  ink: {
    900: "#14100B",
    800: "#1F1A14",
    700: "#2A2419",
    600: "#3F372D",
    500: "#544A3C",
    400: "#6D655A",
    300: "#8A8275",
  },
  cream: {
    50: "#FBF7EF",
    100: "#F5EFE2",
    200: "#EAE0C9",
    300: "#D9CDB2",
  },
  terracota: {
    300: "#D88968",
    400: "#C56740",
    500: "#B5452B",
    600: "#93341F",
    700: "#7C2916",
  },
  clay: {
    300: "#E0B97D",
    400: "#D4A668",
    500: "#C89450",
    600: "#A27539",
    700: "#7D5826",
  },
  stone: {
    200: "#D5CDBD",
    300: "#BDB5A5",
    400: "#9E9688",
    500: "#7F786C",
    600: "#615B51",
  },
  success: { base: "#6B7A38", fg: "#A8B65A", bg: "#2A3318" },
  warning: { base: "#C28920", fg: "#E0A952", bg: "#3D2D0F" },
  danger: { base: "#A8311A", fg: "#D4572F", bg: "#3D1410" },
} as const;

export interface ThemeColors {
  bg: { primary: string; elevated: string; overlay: string; sunken: string };
  text: { primary: string; secondary: string; tertiary: string; inverse: string };
  border: { subtle: string; default: string; strong: string };
  brand: { primary: string; hover: string; pressed: string };
  value: string;
  success: string;
  warning: string;
  danger: string;
}

export const darkTheme: ThemeColors = {
  bg: {
    primary: palette.ink[900],
    elevated: palette.ink[800],
    overlay: palette.ink[700],
    sunken: "#0E0B08",
  },
  text: {
    primary: palette.cream[50],
    secondary: palette.ink[300],
    tertiary: palette.ink[400],
    inverse: palette.ink[900],
  },
  border: {
    subtle: palette.ink[700],
    default: palette.ink[600],
    strong: palette.ink[500],
  },
  brand: {
    primary: palette.terracota[400],
    hover: palette.terracota[300],
    pressed: palette.terracota[600],
  },
  value: palette.clay[400],
  success: palette.success.fg,
  warning: palette.warning.fg,
  danger: palette.danger.fg,
};

export const lightTheme: ThemeColors = {
  bg: {
    primary: palette.cream[50],
    elevated: palette.cream[100],
    overlay: palette.cream[200],
    sunken: "#F0E9D6",
  },
  text: {
    primary: palette.ink[900],
    secondary: palette.ink[500],
    tertiary: palette.ink[400],
    inverse: palette.cream[50],
  },
  border: {
    subtle: palette.cream[200],
    default: palette.stone[300],
    strong: palette.stone[400],
  },
  brand: {
    primary: palette.terracota[500],
    hover: palette.terracota[400],
    pressed: palette.terracota[700],
  },
  value: palette.clay[600],
  success: palette.success.base,
  warning: palette.warning.base,
  danger: palette.danger.base,
};
