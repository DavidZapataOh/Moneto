import { View } from "react-native";
import { Text } from "./Text";

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

/**
 * Header consistente. Alineado a borde de screen (no paddingHorizontal extra).
 * Spacing 8-pt grid: 16 top (matchea el marginTop del top bar de Saldo), 24 bottom.
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
}: ScreenHeaderProps) {
  return (
    <View
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
        {eyebrow && (
          <Text variant="label" tone="tertiary">
            {eyebrow}
          </Text>
        )}
        <Text variant="h2" tone="primary">
          {title}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" tone="secondary">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );
}

/**
 * Section header — usa fuera de cards, alineado a card content-start.
 * Section labels deben alinearse al borde izquierdo de la card siguiente (no 4pt mágico).
 */
interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
        paddingHorizontal: 0, // alineado al borde de screen (no más 4pt inconsistencia)
      }}
    >
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
      {action && (
        <Text
          variant="bodySmall"
          tone="brand"
          onPress={action.onPress}
          suppressHighlighting
        >
          {action.label}
        </Text>
      )}
    </View>
  );
}
