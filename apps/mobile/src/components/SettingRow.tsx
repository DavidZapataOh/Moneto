import { Ionicons } from "@expo/vector-icons";
import { Text, Toggle, useTheme, haptics } from "@moneto/ui";
import { ActivityIndicator, Pressable, View } from "react-native";

/**
 * Rows reusables para paneles de configuración (Card, Notifications, etc).
 *
 * Filosofía visual (design.txt):
 * - Icon en `text.secondary` (no brand) — no compite con el balance hero o
 *   el card visual por la atención.
 * - Label en `bodyMedium` (peso medium, no bold) — hierarchy correcta.
 * - El **único** elemento con color es el Toggle ON (brand.primary), que
 *   indica state activo. Coherente con design.txt: *"Color should be
 *   reserved for communicating status."*
 * - Press states: opacity + el Toggle nativo ya tiene haptic.
 */

interface BaseProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Opcional — segunda línea, menor prioridad visual. */
  description?: string;
  disabled?: boolean;
}

interface ToggleRowProps extends BaseProps {
  variant: "toggle";
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Cuando true, muestra spinner en vez del Toggle (mid-mutation). */
  loading?: boolean;
}

interface NavRowProps extends BaseProps {
  variant: "nav";
  /** Texto cortó del valor actual a la derecha del label. Ej: "$500". */
  value?: string;
  onPress: () => void;
}

export type SettingRowProps = ToggleRowProps | NavRowProps;

const ICON_BG_LIGHT_OPACITY = 0.08;

export function SettingRow(props: SettingRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (props.disabled) return;
        if (props.variant === "nav") {
          haptics.tap();
          props.onPress();
        } else if (!props.loading) {
          // El Toggle propio ya emite haptic.select; no duplicar acá.
          props.onValueChange(!props.value);
        }
      }}
      // Toggle row no es "Pressable" como tal — el touch target es el switch
      // — pero permitimos tap en toda la row para tap targets accesibles.
      accessibilityRole={props.variant === "toggle" ? "switch" : "button"}
      accessibilityLabel={props.label}
      accessibilityState={
        props.variant === "toggle"
          ? { checked: props.value, disabled: props.disabled ?? false }
          : { disabled: props.disabled ?? false }
      }
      style={({ pressed }) => ({
        opacity: props.disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 12,
          minHeight: 56,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: `rgba(255,255,255,${ICON_BG_LIGHT_OPACITY})`,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name={props.icon} size={18} color={colors.text.secondary} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {props.label}
          </Text>
          {props.description ? (
            <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>
              {props.description}
            </Text>
          ) : null}
        </View>

        {props.variant === "toggle" ? (
          props.loading ? (
            <ActivityIndicator color={colors.text.tertiary} />
          ) : (
            <Toggle
              value={props.value}
              onValueChange={props.onValueChange}
              disabled={props.disabled ?? false}
              accessibilityLabel={props.label}
            />
          )
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {props.value ? (
              <Text variant="bodySmall" tone="secondary">
                {props.value}
              </Text>
            ) : null}
            <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
