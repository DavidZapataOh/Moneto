import { forwardRef } from "react";
import { Pressable, View } from "react-native";
import { hitSlop } from "@moneto/theme";
import { Text } from "./Text";

export interface ScreenHeaderProps {
  /** Eyebrow opcional (label uppercased above title). */
  eyebrow?: string;
  /** Título principal (variant `h2`). */
  title: string;
  /** Subtítulo opcional (variant `bodySmall`, tone `secondary`). */
  subtitle?: string;
  /** Slot trailing alineado a la derecha (icono/acción). */
  trailing?: React.ReactNode;
  /** testID para E2E. */
  testID?: string;
}

/**
 * Header consistente para top-level screens. Alineado al borde de la screen
 * (no extra padding horizontal — `<Screen padded>` ya lo aplica).
 *
 * Spacing 8-pt grid: 16 top, 24 bottom.
 *
 * @example
 *   <ScreenHeader eyebrow="Privacidad" title="Tus permisos" trailing={<IconButton ... />} />
 */
export const ScreenHeader = forwardRef<View, ScreenHeaderProps>(function ScreenHeader(
  { eyebrow, title, subtitle, trailing, testID },
  ref,
) {
  return (
    <View
      ref={ref}
      testID={testID}
      style={{
        paddingTop: 16,
        paddingBottom: 24,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? (
          <Text variant="label" tone="tertiary">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h2" tone="primary" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
});

ScreenHeader.displayName = "ScreenHeader";

export interface SectionHeaderProps {
  /** Texto label uppercased. */
  title: string;
  /** Action button opcional a la derecha. */
  action?: {
    label: string;
    onPress: () => void;
    testID?: string;
  };
  /** testID para E2E. */
  testID?: string;
}

/**
 * Section header dentro de una screen — más compacto que `<ScreenHeader>`.
 * Alineado al borde izquierdo de la card siguiente (no 4pt mágico).
 *
 * @example
 *   <SectionHeader title="Movimientos" action={{ label: "Ver todo", onPress }} />
 */
export const SectionHeader = forwardRef<View, SectionHeaderProps>(function SectionHeader(
  { title, action, testID },
  ref,
) {
  return (
    <View
      ref={ref}
      testID={testID}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}
    >
      <Text variant="label" tone="tertiary" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={hitSlop.medium}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          testID={action.testID}
        >
          <Text variant="bodySmall" tone="brand">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

SectionHeader.displayName = "SectionHeader";
