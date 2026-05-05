import { durations } from "@moneto/theme";
import {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useReducedMotion,
  type EntryAnimationsValues,
} from "react-native-reanimated";

/**
 * Entrance animation presets — usar en `<Animated.View entering={...}>`
 * para que toda la app respire con el mismo timing.
 *
 * Filosofía:
 * - **Heroes** (balance, header) entran rápido y prominentes — el user
 *   los necesita ver primero.
 * - **Sections** entran en cascade con stagger 60ms — sensación de
 *   "los datos llegando" (mobile-design.txt gift framework).
 * - **Fades** son para transiciones secundarias (status row, toast).
 *
 * Ojo: cuando `useReducedMotion()` retorna true, los presets devuelven
 * `undefined` para que el caller pase nada y la View se monte sin
 * animación. Ver `useMotionConfig` para el wiring completo.
 */

const HERO_DURATION_MS = durations.slow; // 400
const SECTION_DURATION_MS = 350;
const FADE_DURATION_MS = durations.normal; // 250

/**
 * Hero entry — el primer elemento prominente de la pantalla. FadeInDown
 * para que el user "venga del flow anterior" y aterrice en este content.
 *
 * @example
 *   <Animated.View entering={entrances.hero}>
 *     <BalanceHero />
 *   </Animated.View>
 */
export const entrances = {
  hero: FadeInDown.duration(HERO_DURATION_MS),

  /**
   * Section entry con stagger. El caller pasa el `index` (0-based) y la
   * función computa el delay (60ms × index + 80 base) — match con el
   * pattern preexistente del codebase, ahora centralizado.
   *
   * @example
   *   {sections.map((s, i) => (
   *     <Animated.View key={s.id} entering={entrances.section(i)}>
   *       ...
   *     </Animated.View>
   *   ))}
   */
  section: (index: number) => FadeInDown.duration(SECTION_DURATION_MS).delay(80 + index * 60),

  /** Fade in puro — para overlays, status rows, toast. */
  fade: FadeIn.duration(FADE_DURATION_MS),

  /** FadeInUp variant — para modals/sheets que vienen desde abajo. */
  sheet: FadeInUp.duration(SECTION_DURATION_MS),

  /**
   * Section delay arbitrario (compat con call-sites que usan delays
   * computados a mano). Prefer `section(index)` cuando es secuencial.
   */
  sectionDelayed: (delayMs: number) => FadeInDown.duration(SECTION_DURATION_MS).delay(delayMs),

  /**
   * Fade puro con delay arbitrario — para elementos secundarios (status
   * row, badge) que no deben deslizarse, solo aparecer suavemente.
   */
  fadeDelayed: (delayMs: number) => FadeIn.duration(FADE_DURATION_MS).delay(delayMs),
} as const;

/**
 * Cuando reduced motion está activo, devolvemos `undefined` para que el
 * caller spread vacío en `entering`. Es la forma idiomática en
 * Reanimated 4 — no hay un "no-op animation" oficial.
 *
 * @example
 *   const { enabled } = useMotionConfig();
 *   <Animated.View entering={enabled ? entrances.hero : undefined}>
 */
export type EntryAnimation = EntryAnimationsValues | undefined;

/**
 * Cuando reduced motion está activo, devolvemos animaciones de duración
 * 0ms — efectivamente instantáneas, sin movimiento visible. Reanimated
 * no tiene un "noop animation" oficial; `FadeIn.duration(0)` es el
 * pattern idiomático que satisface el typesystem de `entering` y se
 * salta visualmente.
 */
const ZERO_DURATION = 0;

const reducedEntrances = {
  hero: FadeIn.duration(ZERO_DURATION),
  section: (_index: number) => FadeIn.duration(ZERO_DURATION),
  fade: FadeIn.duration(ZERO_DURATION),
  sheet: FadeIn.duration(ZERO_DURATION),
  sectionDelayed: (_delayMs: number) => FadeIn.duration(ZERO_DURATION),
  fadeDelayed: (_delayMs: number) => FadeIn.duration(ZERO_DURATION),
} as const;

/**
 * Mismo set que `entrances` pero **respeta reduced-motion automático**.
 * Cuando el sistema reporta `useReducedMotion()`, todos los presets
 * devuelven una animation de duración 0 → la View se monta sin
 * movimiento visible.
 *
 * Es el método preferido en screens — `entrances` directo solo cuando
 * querés forzar la animación (pre-onboarding, splash).
 *
 * @example
 *   const motion = useEntrances();
 *   <Animated.View entering={motion.hero}>
 *     <BalanceHero />
 *   </Animated.View>
 */
export function useEntrances(): typeof entrances {
  const reduced = useReducedMotion();
  return reduced ? reducedEntrances : entrances;
}
