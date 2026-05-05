# Motion & Haptics

> Source of truth para el motion design system de Moneto: tokens,
> presets, hapticpolicy, reduced-motion behavior. Aplica a `apps/mobile`
> hoy + cualquier `apps/*` futuro que consuma `@moneto/ui`.

---

## Filosofía

Motion + haptics son **trust signals**, no decoración. Cada movimiento
y cada vibración existe porque comunica algo:

- **State change** confirmado (toggle on/off → `select` haptic).
- **Action acknowledgment** (button press → scale + opacity feedback).
- **Hierarchy** (hero entra primero, secciones siguen en cascade).
- **Celebration / closure** (refresh success → `success` haptic).

> mobile-design.txt: _"It's not what these apps reward. It's how they
> structure the reward."_ Motion estructura el reward — anticipation +
> reveal + afterglow. Sin esto, el user **siente** la app aún funcional
> pero "plana". Con esto, se siente premium.

Reglas duras:

1. **Spring physics > timing curves** para gestos físicos (press, drag,
   refresh). Solo usar `withTiming` para fades lineales y tickers
   numéricos.
2. **Haptic intencional, no spam**. Si suena en cada tap microscópico,
   pierde sensitivity (lección Robinhood). 7 patterns semánticos
   suficientes.
3. **Reduced motion = sistema operativo manda**. Si el user activa
   "Reduce Motion" en Settings, todas las entrance animations se
   colapsan a 0ms. La interaction sigue funcional.

---

## Tokens (`@moneto/theme`)

### Durations

| Token     | ms  | Uso                                                  |
| --------- | --- | ---------------------------------------------------- |
| `instant` | 90  | UI feedback inmediato (color change, opacity nudge). |
| `fast`    | 150 | Press-state, hover, micro feedback.                  |
| `normal`  | 250 | Transición estándar (sheet, modal, tab change).      |
| `slow`    | 400 | Hero entry, multi-step orchestration.                |
| `slower`  | 600 | Splash → app, onboarding hero.                       |

### Easings (cubic bezier tuples)

| Token        | Curve                 | Uso                                          |
| ------------ | --------------------- | -------------------------------------------- |
| `standard`   | `[0.2, 0, 0, 1]`      | Default bidireccional — entradas + salidas.  |
| `emphasized` | `[0.05, 0.7, 0.1, 1]` | Salida enfática — elementos que se asientan. |
| `decelerate` | `[0, 0, 0.2, 1]`      | Solo decelera — sheets que aparecen.         |
| `accelerate` | `[0.4, 0, 1, 1]`      | Solo acelera — sheets que se van.            |
| `linear`     | `[0, 0, 1, 1]`        | SOLO tickers numéricos / yield counter.      |

### Springs (Reanimated `withSpring`)

| Token    | Damping / Stiffness / Mass | Uso                                                          |
| -------- | -------------------------- | ------------------------------------------------------------ |
| `tap`    | 18 / 320 / 0.6             | Micro-bump al pulsar (Button, IconButton, PressableScale).   |
| `gentle` | 20 / 180 / 0.9             | Sheets, drawers, hero entries.                               |
| `snappy` | 14 / 260 / 0.7             | Feedback assertive (toast in, badge bounce, tab icon scale). |
| `wobbly` | 8 / 140 / 0.9              | Éxito / celebración (success screen).                        |

---

## Presets (`@moneto/ui`)

### `entrances` + `useEntrances()`

`entrances` exposes los presets directos (siempre animados). `useEntrances()`
respeta `useReducedMotion()` automático — preferir este desde screens.

| Preset               | Animation                                       | Uso                                                               |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| `hero`               | `FadeInDown.duration(400)`                      | Primer elemento prominente (BalanceHero, ScreenHeader principal). |
| `section(index)`     | `FadeInDown.duration(350).delay(80 + index*60)` | Secciones secuenciales con stagger.                               |
| `sectionDelayed(ms)` | `FadeInDown.duration(350).delay(ms)`            | Compat con call-sites con delays manuales.                        |
| `fade`               | `FadeIn.duration(250)`                          | Overlays sin movimiento (status row).                             |
| `fadeDelayed(ms)`    | `FadeIn.duration(250).delay(ms)`                | Idem con delay arbitrario.                                        |
| `sheet`              | `FadeInUp.duration(350)`                        | Modals/sheets que vienen de abajo.                                |

### `PressableScale`

Primitive component. Todo Button / IconButton / ListItem / row tappable
hereda este feedback:

- Press in: `scale → 0.97` con `springs.tap`, `opacity → 0.85` con
  `withTiming(durations.instant)`.
- Press out: `scale → 1`, `opacity → 1` con `withTiming(durations.fast)`.
- Cleanup en unmount via `cancelAnimation` (anti-leak).

### `useMotionConfig()`

Para timing inline o conditional rendering:

```ts
const motion = useMotionConfig();
scale.value = withTiming(1, { duration: motion.duration(350) });
const initial = motion.transform(0, 1); // 0 si animations on, 1 si reduced
```

---

## Haptic policy

Importar via `import { haptics } from "@moneto/ui"`.

| Action                              | Helper                                    | Razón                                 |
| ----------------------------------- | ----------------------------------------- | ------------------------------------- |
| Tab switch                          | `haptics.select()`                        | Subtle confirmation.                  |
| Button press genérico               | `haptics.tap()`                           | Acknowledgment.                       |
| Toggle on/off                       | `haptics.select()` (auto-fired by Toggle) | Crisp state change.                   |
| Pull-to-refresh release             | `haptics.tap()`                           | Action started.                       |
| Pull-to-refresh resolved            | `haptics.success()`                       | Closure.                              |
| Send / send confirmation modal open | `haptics.medium()`                        | Significant action.                   |
| Send completed                      | `haptics.success()`                       | Celebration.                          |
| Send failed                         | `haptics.error()`                         | Failure signal.                       |
| Swipe to delete / freeze toggle     | `haptics.medium()`                        | Destructive intent.                   |
| Recovery / logout confirmation      | `haptics.heavy()`                         | Irreversible.                         |
| Validation error blanda             | `haptics.warning()`                       | Attention.                            |
| Biometric prompt fire               | (none)                                    | OS handles natively.                  |
| Number ticker on update             | (none)                                    | Visual already enough.                |
| Tab icon focus animation            | (none)                                    | Already covered by `tabPress` haptic. |

Patterns semánticos > intensidades físicas: `tap` puede no ser igual de
fuerte cross-device, pero la intención (acknowledgment) es la misma.

### Defensive helper

`haptics.X()` está wrapped en try/catch silencioso. Razón: Android < 8 +
algunos OEMs pueden tirar exceptions en el bridge. Un fallo de haptic
NO debe propagar al UI. Los logs no incluyen el error — es noise.

---

## Reduced motion

iOS: `Settings → Accessibility → Motion → Reduce Motion`.
Android: `Settings → Accessibility → Remove animations`.

Cuando activo:

- `useReducedMotion()` (Reanimated) retorna `true`.
- `useEntrances()` devuelve presets de duración 0ms — la View se monta
  instantáneamente, sin movimiento visible.
- `useMotionConfig().duration(ms)` retorna 0.
- **Haptics no se afectan**: iOS los maneja vía system-level setting
  separado (`Touch Accommodations`) y `expo-haptics` no expone hook
  para detectarlo. Si el user pidió "reduce motion" y quiere también
  silenciar haptics, debe usar el toggle de iOS.

### Smoke test

1. Activar Reduce Motion en Settings.
2. Cold open Saldo / Activos / Card / Yo → secciones aparecen
   inmediato, sin slide-in stagger.
3. Botones siguen respondiendo con scale (es feedback contextual, no
   entrance), pero la animation es cuasi-imperceptible.
4. RefreshControl + native iOS sheets siguen con motion (el OS los
   maneja, no nuestro código).

---

## Convenciones de uso

### En screens

```tsx
import { useEntrances } from "@moneto/ui";

export default function MyScreen() {
  const motion = useEntrances();
  return (
    <Screen scroll>
      <Animated.View entering={motion.hero}>
        <Hero />
      </Animated.View>
      {sections.map((s, i) => (
        <Animated.View key={s.id} entering={motion.section(i)}>
          ...
        </Animated.View>
      ))}
    </Screen>
  );
}
```

### En components reutilizables

Usar `springs.tap` directo desde `@moneto/theme` para press feedback
custom; no inventar values. Los timings inline para state animations
custom (e.g., flip, count-up) usan `Easing.out(Easing.cubic)` por
default — cero ad-hoc curves.

### Haptics

Importar UNA vez por archivo, llamar inline:

```tsx
import { haptics } from "@moneto/ui";

<Pressable
  onPress={() => {
    haptics.medium();
    doThing();
  }}
/>;
```

NO crear wrappers tipo `haptics.confirmDelete()` — el matrix de
patterns semánticos cubre todo. Adding new patterns requires updating
el matrix arriba.

---

## Quality checklist por screen nueva

- [ ] Hero con `motion.hero`.
- [ ] Secciones con `motion.section(i)` o `motion.sectionDelayed(ms)`.
- [ ] Press feedback en buttons via `PressableScale` o `Button`.
- [ ] Haptic per matrix de arriba.
- [ ] Spring physics para scale/translate animations, timing solo
      para fades / number tickers.
- [ ] Cleanup en unmount si usás `useSharedValue` directo.
- [ ] No console warning "Animated value isn't initialized".
