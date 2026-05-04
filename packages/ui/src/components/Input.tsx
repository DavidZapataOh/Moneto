import { forwardRef, useState, useCallback } from "react";
import {
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
  type ViewStyle,
  Pressable,
} from "react-native";
import { radius, type, hitSlop } from "@moneto/theme";
import { Text } from "./Text";
import { useTheme } from "../hooks/useTheme";

export type InputVariant = "outlined" | "filled" | "ghost";
export type InputSize = "md" | "lg";

export interface InputProps extends Omit<RNTextInputProps, "style"> {
  /** Texto que aparece encima del campo (eyebrow `label` variant). */
  label?: string;
  /** Mensaje de error. Si presente: borde danger + helper en danger. */
  error?: string;
  /** Helper text bajo el campo (descartado si hay `error`). */
  helper?: string;
  /** Slot a la izquierda dentro del control (ej: search icon). */
  leftSlot?: React.ReactNode;
  /** Slot a la derecha dentro del control (ej: clear button, unit suffix). */
  rightSlot?: React.ReactNode;
  /** Visual variant. Default `outlined`. */
  variant?: InputVariant;
  /** Tamaño vertical. Default `md`. */
  size?: InputSize;
  /** Estilo extra para el contenedor (no para el TextInput interno). */
  containerStyle?: ViewStyle;
  /** testID para el TextInput interno (E2E). */
  testID?: string;
}

const SIZE_MAP = {
  md: { minHeight: 48, py: 12, px: 14, gap: 10 },
  lg: { minHeight: 56, py: 16, px: 16, gap: 12 },
} as const;

/**
 * Themed text input con label, helper, error states + slots para iconos.
 *
 * Asume one-line por default. Para multiline pasar `multiline numberOfLines={n}`
 * — el control crece y mantiene padding consistente.
 *
 * Para inputs hero con número grande (Send / Swap amount) usar `<AmountInput>`
 * (Sprint 2) en lugar de este — su tipografía y layout son distintos.
 *
 * @example
 *   <Input
 *     label="Email"
 *     value={email}
 *     onChangeText={setEmail}
 *     placeholder="tu@correo.com"
 *     keyboardType="email-address"
 *     autoCapitalize="none"
 *     error={emailError}
 *   />
 */
export const Input = forwardRef<RNTextInput, InputProps>(function Input(
  {
    label,
    error,
    helper,
    leftSlot,
    rightSlot,
    variant = "outlined",
    size = "md",
    containerStyle,
    onFocus,
    onBlur,
    editable = true,
    accessibilityLabel,
    accessibilityHint,
    testID,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback<NonNullable<RNTextInputProps["onFocus"]>>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback<NonNullable<RNTextInputProps["onBlur"]>>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const s = SIZE_MAP[size];
  const hasError = Boolean(error);
  const disabled = !editable;

  const borderColor = hasError
    ? colors.danger
    : focused
      ? colors.brand.primary
      : variant === "outlined"
        ? colors.border.default
        : "transparent";

  const bg =
    variant === "filled"
      ? colors.bg.elevated
      : variant === "outlined"
        ? colors.bg.primary
        : "transparent";

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: s.minHeight,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          gap: s.gap,
          backgroundColor: bg,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor,
          borderRadius: radius.md,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {leftSlot}

        <RNTextInput
          ref={ref}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.text.tertiary}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint}
          testID={testID}
          style={[
            type.body,
            {
              flex: 1,
              color: colors.text.primary,
              padding: 0,
              margin: 0,
              includeFontPadding: false,
            },
          ]}
          {...rest}
        />

        {rightSlot}
      </View>

      {hasError ? (
        <Text variant="bodySmall" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 6 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

Input.displayName = "Input";

/**
 * Pressable wrapper con hitSlop que limpia el contenido del Input.
 * Útil como `rightSlot` en search inputs.
 *
 * @example
 *   <Input
 *     value={q}
 *     onChangeText={setQ}
 *     rightSlot={q ? <ClearButton onPress={() => setQ("")} /> : null}
 *   />
 */
export function ClearButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop.medium}
      accessibilityRole="button"
      accessibilityLabel="Limpiar"
      testID={testID}
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.border.subtle,
      }}
    >
      <Text style={{ fontSize: 11, color: colors.text.secondary, lineHeight: 14 }}>×</Text>
    </Pressable>
  );
}

ClearButton.displayName = "ClearButton";
