/**
 * Moneto typography — enforced scale.
 *
 * Regla estricta (mobile-design.txt): máximo 4 font sizes + 2 weights por screen.
 *
 * Sistema reducido:
 * - 48pt (hero/display) — balance hero, APY hero
 * - 24pt (h2) — page titles, card hero numbers
 * - 16pt (body) — body text, primary row labels, CTAs
 * - 12pt (caption) — eyebrow labels, metadata, timestamps
 *
 * Weights:
 * - 400 (regular) — body, metadata
 * - 500 (medium) — titles, CTAs, numbers
 *
 * Fraunces solo display · Inter para UI · JetBrainsMono solo para amounts
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
  // 48pt — hero
  wordmark: {
    fontFamily: fonts.displayMedium,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
  } satisfies TypographyStyle,

  heroDisplay: {
    fontFamily: fonts.displayRegular,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.2,
  } satisfies TypographyStyle,

  heroDisplayLarge: {
    fontFamily: fonts.displayRegular,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.2,
  } satisfies TypographyStyle,

  // 24pt — h2
  h2: {
    fontFamily: fonts.sansSemibold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.4,
  } satisfies TypographyStyle,

  h3: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
  } satisfies TypographyStyle,

  // 16pt — body
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  } satisfies TypographyStyle,

  bodyMedium: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
  } satisfies TypographyStyle,

  // 12pt — caption
  bodySmall: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  } satisfies TypographyStyle,

  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  } satisfies TypographyStyle,

  button: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  } satisfies TypographyStyle,

  // Mono — siempre para amounts
  balanceHero: {
    fontFamily: fonts.monoMedium,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.4,
  } satisfies TypographyStyle,

  balanceHeroLarge: {
    fontFamily: fonts.monoMedium,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.4,
  } satisfies TypographyStyle,

  amountPrimary: {
    fontFamily: fonts.monoMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  } satisfies TypographyStyle,

  amountSecondary: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  } satisfies TypographyStyle,

  mono: {
    fontFamily: fonts.monoRegular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  } satisfies TypographyStyle,
} as const;
