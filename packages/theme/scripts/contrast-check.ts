/* eslint-disable no-console -- CLI script: console output IS la interfaz. */
/// <reference types="node" />

/**
 * Contrast smoke check — corre con `pnpm --filter @moneto/theme contrast`
 * después de tocar `colors.ts`. Imprime las ratios de combinaciones
 * críticas; falla con exit code 1 si alguna baja del umbral AA (4.5).
 *
 * Cuando agreguemos Jest (Sprint 8), este script se promueve a un
 * `*.test.ts` que corre en CI. Por ahora vive como runner manual.
 */

import { contrast, meetsWCAGAA } from "@moneto/utils";

import { darkTheme, lightTheme } from "../src/colors";

interface Combo {
  /** Descripción human-readable. */
  label: string;
  /** Foreground color. */
  fg: string;
  /** Background color. */
  bg: string;
  /** True para texto large (≥18pt regular o ≥14pt bold). Cambia umbral AA a 3. */
  largeText?: boolean;
}

const combos: Array<{ theme: "light" | "dark"; combos: Combo[] }> = [
  {
    theme: "light",
    combos: [
      {
        label: "text.primary on bg.primary",
        fg: lightTheme.text.primary,
        bg: lightTheme.bg.primary,
      },
      {
        label: "text.primary on bg.elevated",
        fg: lightTheme.text.primary,
        bg: lightTheme.bg.elevated,
      },
      {
        label: "text.secondary on bg.primary",
        fg: lightTheme.text.secondary,
        bg: lightTheme.bg.primary,
      },
      {
        label: "text.tertiary on bg.primary",
        fg: lightTheme.text.tertiary,
        bg: lightTheme.bg.primary,
        largeText: true,
      },
      {
        label: "brand.primary on bg.primary",
        fg: lightTheme.brand.primary,
        bg: lightTheme.bg.primary,
        largeText: true,
      },
      { label: "success on bg.primary", fg: lightTheme.success, bg: lightTheme.bg.primary },
      { label: "warning on bg.primary", fg: lightTheme.warning, bg: lightTheme.bg.primary },
      { label: "danger on bg.primary", fg: lightTheme.danger, bg: lightTheme.bg.primary },
      {
        label: "text.inverse on brand.primary (button)",
        fg: lightTheme.text.inverse,
        bg: lightTheme.brand.primary,
      },
    ],
  },
  {
    theme: "dark",
    combos: [
      { label: "text.primary on bg.primary", fg: darkTheme.text.primary, bg: darkTheme.bg.primary },
      {
        label: "text.primary on bg.elevated",
        fg: darkTheme.text.primary,
        bg: darkTheme.bg.elevated,
      },
      {
        label: "text.secondary on bg.primary",
        fg: darkTheme.text.secondary,
        bg: darkTheme.bg.primary,
      },
      {
        label: "text.tertiary on bg.primary",
        fg: darkTheme.text.tertiary,
        bg: darkTheme.bg.primary,
        largeText: true,
      },
      {
        label: "brand.primary on bg.primary",
        fg: darkTheme.brand.primary,
        bg: darkTheme.bg.primary,
        largeText: true,
      },
      { label: "success on bg.primary", fg: darkTheme.success, bg: darkTheme.bg.primary },
      { label: "warning on bg.primary", fg: darkTheme.warning, bg: darkTheme.bg.primary },
      { label: "danger on bg.primary", fg: darkTheme.danger, bg: darkTheme.bg.primary },
      {
        label: "text.inverse on brand.primary (button)",
        fg: darkTheme.text.inverse,
        bg: darkTheme.brand.primary,
      },
    ],
  },
];

let failures = 0;

console.log("Moneto theme — WCAG contrast check\n");

for (const group of combos) {
  console.log(`── ${group.theme.toUpperCase()} theme ──`);
  for (const c of group.combos) {
    const ratio = contrast(c.fg, c.bg);
    const passes = meetsWCAGAA(c.fg, c.bg, c.largeText ? { largeText: true } : {});
    const tag = c.largeText ? " (large)" : "";
    const verdict = passes ? "✓" : "✗ FAIL";
    const line = `  ${verdict}  ${c.label}${tag}  →  ${ratio.toFixed(2)}:1`;
    console.log(line);
    if (!passes) failures += 1;
  }
  console.log("");
}

if (failures > 0) {
  console.error(`\n❌ ${failures} contrast check${failures === 1 ? "" : "s"} fallaron`);
  process.exit(1);
}
console.log("✅ Todas las combinaciones pasan WCAG AA");
