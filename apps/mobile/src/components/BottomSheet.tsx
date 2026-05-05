import { durations, easings } from "@moneto/theme";
import { useTheme } from "@moneto/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ENTER_DURATION = durations.normal;
const EXIT_DURATION = durations.fast;
const DISMISS_VELOCITY = 700;
const DISMISS_RATIO = 0.3;
const STANDARD_EASING = Easing.bezier(...easings.standard);

export interface BottomSheetProps {
  /** Controla visibilidad. Cuando pasa de true→false, animamos exit antes de unmount el Modal. */
  visible: boolean;
  /** Llamado cuando el sheet se cerró completo (post-animación). */
  onDismiss: () => void;
  /** Children del sheet. El padding/header lo agrega cada caller. */
  children: ReactNode;
  /** Optional max-height fraction del viewport. Default 0.85. */
  maxHeightFraction?: number;
}

/**
 * Bottom sheet primitive — Modal nativo + handle drag-to-dismiss + scrim.
 *
 * **Por qué custom**: `@gorhom/bottom-sheet` agrega ~120KB al bundle.
 * Un sheet simple es suficiente para asset-selector + slippage settings.
 *
 * **Comportamiento**:
 * - Enter: slide-up desde bottom (250ms `easings.standard`).
 * - Exit: slide-down (150ms `easings.standard`) y luego unmount.
 * - Pan-down: drag-to-dismiss; release con velocity >700 px/s o
 *   translation >30% del altura → cierra.
 * - Tap en scrim → cierra.
 *
 * **Accesibilidad**: el contenido ya está dentro de un Modal nativo, lo
 * que captura focus automáticamente. Pasamos `accessibilityViewIsModal`
 * en iOS y `importantForAccessibility="yes"` para Android.
 *
 * @example
 *   <BottomSheet visible={open} onDismiss={() => setOpen(false)}>
 *     <Text variant="h3">Title</Text>
 *     <ListItem ... />
 *   </BottomSheet>
 */
export function BottomSheet({
  visible,
  onDismiss,
  children,
  maxHeightFraction = 0.85,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = windowHeight * maxHeightFraction;
  // Mientras animamos exit, mantenemos el Modal montado. `mounted` se
  // setea true cuando `visible` flips on, y se vuelve false al final
  // del exit animation.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(0);
  // Sentinel para saber a qué offset corresponde "fully visible" — lo
  // computamos onLayout porque el contenido es dynamic.
  const sheetHeight = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Empezamos off-screen y animamos in. `sheetHeight` puede ser 0
      // hasta el primer layout — en ese caso el Modal entra fade-only.
      translateY.value = sheetHeight.value || 600;
      translateY.value = withTiming(0, {
        duration: ENTER_DURATION,
        easing: STANDARD_EASING,
      });
      opacity.value = withTiming(1, {
        duration: ENTER_DURATION,
        easing: STANDARD_EASING,
      });
    } else if (mounted) {
      translateY.value = withTiming(
        sheetHeight.value || 600,
        { duration: EXIT_DURATION, easing: STANDARD_EASING },
        (done) => {
          if (done) runOnJS(setMounted)(false);
        },
      );
      opacity.value = withTiming(0, {
        duration: EXIT_DURATION,
        easing: STANDARD_EASING,
      });
    }
  }, [visible, mounted, translateY, opacity, sheetHeight]);

  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  // Drag-to-dismiss gesture. Solo permitimos translateY ≥ 0 (no over-scroll
  // up). Release decide si snap-back o close.
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      const shouldClose =
        e.velocityY > DISMISS_VELOCITY ||
        (sheetHeight.value > 0 && e.translationY > sheetHeight.value * DISMISS_RATIO);
      if (shouldClose) {
        runOnJS(dismiss)();
      } else {
        translateY.value = withTiming(0, {
          duration: ENTER_DURATION,
          easing: STANDARD_EASING,
        });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
            },
            scrimStyle,
          ]}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) sheetHeight.value = h;
            }}
            style={[
              {
                backgroundColor: colors.bg.elevated,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 8,
                paddingBottom: insets.bottom + 12,
                maxHeight: maxSheetHeight,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -6 },
                elevation: 12,
              },
              sheetStyle,
            ]}
            accessibilityViewIsModal
            importantForAccessibility="yes"
          >
            {/* Drag handle */}
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border.default,
                marginBottom: 12,
              }}
            />
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
