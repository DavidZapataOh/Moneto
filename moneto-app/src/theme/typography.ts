/**
 * Moneto typography scale
 * Fraunces (display) · Inter (UI) · JetBrains Mono (números)
 * Cada familia tiene un rol exclusivo. Nunca se cruzan.
 */

import { TextStyle } from "react-native";

export const fonts = {
  displayRegular: "Fraunces_400Regular",
  displayMedium: "Fraunces_500Medium",
  sansRegular: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemibold: "Inter_600SemiBold",
  monoRegular: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

type TypographyStyle = TextStyle & { fontFamily: string };

export const type = {
  // Display — Fraunces, editorial voice
  wordmark: {
    fontFamily: fonts.displayMedium,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.2,
  } satisfies TypographyStyle,

  heroDisplay: {
    fontFamily: fonts.displayRegular,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.2,
  } satisfies TypographyStyle,

  heroDisplayLarge: {
    fontFamily: fonts.displayRegular,
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -1.4,
  } satisfies TypographyStyle,

  // UI — Inter
  h2: {
    fontFamily: fonts.sansSemibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.36,
  } satisfies TypographyStyle,

  h3: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
  } satisfies TypographyStyle,

  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0,
  } satisfies TypographyStyle,

  bodyMedium: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0,
  } satisfies TypographyStyle,

  bodySmall: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 19.5,
    letterSpacing: 0,
  } satisfies TypographyStyle,

  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.32,
    textTransform: "uppercase",
  } satisfies TypographyStyle,

  button: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.16,
  } satisfies TypographyStyle,

  // Mono — solo números
  balanceHero: {
    fontFamily: fonts.monoMedium,
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -1.2,
  } satisfies TypographyStyle,

  balanceHeroLarge: {
    fontFamily: fonts.monoMedium,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -1.4,
  } satisfies TypographyStyle,

  amountPrimary: {
    fontFamily: fonts.monoMedium,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.16,
  } satisfies TypographyStyle,

  amountSecondary: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  } satisfies TypographyStyle,

  mono: {
    fontFamily: fonts.monoRegular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  } satisfies TypographyStyle,
} as const;
