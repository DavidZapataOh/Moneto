import { Ionicons } from "@expo/vector-icons";
import { View, type ViewStyle } from "react-native";

import { useTheme } from "../hooks/useTheme";

import { Button, type ButtonVariant } from "./Button";
import { Text } from "./Text";

import type { ReactNode } from "react";

/**
 * Empty state genérico. Composable: el caller pasa icon (Ionicons) o un
 * `illustration` custom (SVG, imagen, lo que sea).
 *
 * Diseño (mobile-design.txt — "gift, not receipt"):
 * - Icon en círculo neutral low-contrast — no compite con el resto de
 *   la pantalla.
 * - Title h3 centrado, description body secondary.
 * - CTA primary brand-pill (único acento de color en el state).
 * - Wrap en `<View padded>` con generous vertical space — el state debe
 *   sentirse "intencional", no apretado.
 *
 * @example
 *   <EmptyState
 *     icon="document-text-outline"
 *     title="Tu primer movimiento aparecerá acá"
 *     description="Cuando recibas o envíes dinero, lo vas a ver acá."
 *     cta={{ label: "Recibir mi primer pago", onPress: () => router.push("/receive") }}
 *   />
 */
export interface EmptyStateProps {
  /** Render custom (SVG, ilustración Lottie, etc). Si presente, ignora `icon`. */
  illustration?: ReactNode;
  /** Fallback Ionicons name si no hay illustration. Default `sparkles-outline`. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Headline del state. */
  title: string;
  /** Sub-copy debajo del title. Opcional, max 3 líneas recomendadas. */
  description?: string;
  cta?: {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    /** Iconito izquierdo en el button (Ionicons name). */
    leftIcon?: keyof typeof Ionicons.glyphMap;
  };
  /** testID propagado al CTA button. */
  /** Override del padding/gap si el wrapper externo ya lo maneja. */
  style?: ViewStyle;
  testID?: string;
}

export function EmptyState({
  illustration,
  icon = "sparkles-outline",
  title,
  description,
  cta,
  style,
  testID,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        {
          alignItems: "center",
          paddingVertical: 32,
          paddingHorizontal: 24,
          gap: 20,
        },
        style,
      ]}
    >
      {illustration ?? (
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.bg.overlay,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={32} color={colors.text.tertiary} />
        </View>
      )}

      <View style={{ alignItems: "center", gap: 8, maxWidth: 320 }}>
        <Text variant="h3" style={{ textAlign: "center" }}>
          {title}
        </Text>
        {description ? (
          <Text variant="body" tone="secondary" style={{ textAlign: "center", lineHeight: 22 }}>
            {description}
          </Text>
        ) : null}
      </View>

      {cta ? (
        <Button
          label={cta.label}
          variant={cta.variant ?? "primary"}
          size="md"
          onPress={cta.onPress}
          {...(cta.leftIcon
            ? {
                leftIcon: (
                  <Ionicons
                    name={cta.leftIcon}
                    size={16}
                    color={cta.variant === "secondary" ? colors.text.primary : colors.text.inverse}
                  />
                ),
              }
            : {})}
        />
      ) : null}
    </View>
  );
}

EmptyState.displayName = "EmptyState";
