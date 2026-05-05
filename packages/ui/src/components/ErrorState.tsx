import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, type ViewStyle } from "react-native";

import { useTheme } from "../hooks/useTheme";

import { Button } from "./Button";
import { Text } from "./Text";

/**
 * Error state genérico. Diseño deliberadamente plain — esta es la red
 * de seguridad cuando algo falla, no debería ser un punto de fricción
 * visual extra.
 *
 * Diseño (colors.txt):
 * - Icon `alert-circle-outline` en círculo tinted danger (rgba 0.12).
 *   El único acento de color en el state — comunica state, no decoración.
 * - Title h3 + description body secondary (mismo pattern que EmptyState
 *   → consistency familiar).
 * - CTA "Reintentar" primary.
 * - `requestId` mostrado tappable como `bodySmall tertiary` — minimal,
 *   pero útil para soporte ("ID: ab12cd... tap to copy").
 *
 * El componente NO importa expo-clipboard — el caller pasa
 * `onCopyRequestId` para que `@moneto/ui` quede agnostic. mobile wirea
 * `Clipboard.setStringAsync`.
 *
 * @example
 *   <ErrorState
 *     title="No pudimos cargar tu balance"
 *     description="Verificá tu conexión e intentá de nuevo."
 *     requestId={errorId}
 *     onRetry={() => refetch()}
 *     onCopyRequestId={(id) => Clipboard.setStringAsync(id)}
 *   />
 */
export interface ErrorStateProps {
  /** Default "Algo no salió bien". */
  title?: string;
  description?: string;
  /** UUID del request para que support encuentre el log. Visible truncado. */
  requestId?: string;
  /** Si presente, muestra botón "Reintentar". */
  onRetry?: () => void;
  /**
   * Caller-provided copy handler — recibe el `requestId` completo. Mobile
   * wirea `Clipboard.setStringAsync` + alert "Copiado". Sin esta callback,
   * el ID queda visible pero no copyable.
   */
  onCopyRequestId?: (requestId: string) => void;
  style?: ViewStyle;
  testID?: string;
}

const DEFAULT_TITLE = "Algo no salió bien";

export function ErrorState({
  title = DEFAULT_TITLE,
  description,
  requestId,
  onRetry,
  onCopyRequestId,
  style,
  testID,
}: ErrorStateProps) {
  const { colors } = useTheme();

  const handleCopyRequestId = () => {
    if (!requestId || !onCopyRequestId) return;
    onCopyRequestId(requestId);
  };

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
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "rgba(168, 49, 26, 0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
      </View>

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

      {onRetry ? <Button label="Reintentar" variant="primary" size="md" onPress={onRetry} /> : null}

      {requestId ? (
        <Pressable
          onPress={handleCopyRequestId}
          disabled={!onCopyRequestId}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Request ID ${requestId}, tocar para copiar`}
          accessibilityState={{ disabled: !onCopyRequestId }}
          style={({ pressed }) => ({ opacity: pressed && onCopyRequestId ? 0.6 : 1 })}
        >
          <Text variant="bodySmall" tone="tertiary">
            ID: {requestId.slice(0, 8)}…{onCopyRequestId ? "  · tocar para copiar" : ""}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

ErrorState.displayName = "ErrorState";
