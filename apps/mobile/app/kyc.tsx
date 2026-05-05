import { Ionicons } from "@expo/vector-icons";
import { Screen, Text, Button, Card, useTheme, haptics } from "@moneto/ui";
import { createLogger } from "@moneto/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useAppStore } from "@stores/useAppStore";

const log = createLogger("kyc.screen");

const PERSONA_TEMPLATE_L1 = process.env["EXPO_PUBLIC_PERSONA_TEMPLATE_L1"] ?? "";
const PERSONA_TEMPLATE_L2 = process.env["EXPO_PUBLIC_PERSONA_TEMPLATE_L2"] ?? "";
const PERSONA_ENV =
  (process.env["EXPO_PUBLIC_ENV"] ?? "development") === "production" ? "production" : "sandbox";
const PERSONA_HOSTED_URL = "https://withpersona.com/verify";

type Phase = "intro" | "loading" | "in_progress" | "completed" | "cancelled" | "failed";

/**
 * KYC modal screen.
 *
 * Flow:
 * 1. Phase `intro`: explica qué necesitamos + CTA "Comenzar verificación".
 * 2. User tap → Phase `in_progress`: carga la inquiry hosted de Persona en
 *    un WebView. Persona emite `messages` JS → captamos via onMessage.
 * 3. Phase `completed`: Persona retorna `inquiry-completed`. Mostramos
 *    success transitorio + back to (tabs). El webhook actualizará el
 *    `kyc_level` server-side; mobile lo refleja cuando re-fetche profile
 *    (Sprint 1.05) o por realtime (Sprint 5).
 * 4. Phase `cancelled` / `failed`: vuelve a intro con copy ajustado.
 *
 * Decisión de WebView vs SDK nativo (`react-native-persona`):
 * - WebView: cero native modules extras, funciona en Expo Go, mismo flow
 *   visual que el SDK nativo (Persona renderiza igual en webview).
 * - SDK nativo: mejor UX en flujos de captura de cámara (rendering native
 *   en lugar de webview), pero añade native dep + EAS rebuild requerido.
 *
 * Sprint 8 polish: migrar a `react-native-persona` cuando ramp-eemos UX.
 * Por ahora WebView es buen compromise.
 */
export default function KYCScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ target_level?: string }>();
  const targetLevel = params.target_level === "2" ? 2 : 1;
  const setProfile = useAppStore((s) => s.setProfile);
  const userId = useAppStore((s) =>
    s.authState.status === "authenticated" ? s.authState.userId : null,
  );

  const [phase, setPhase] = useState<Phase>("intro");

  const templateId = targetLevel === 2 ? PERSONA_TEMPLATE_L2 : PERSONA_TEMPLATE_L1;
  const inquiryUrl = userId && templateId ? buildPersonaUrl(templateId, userId) : null;

  const handleStart = useCallback(() => {
    if (!userId) {
      Alert.alert("Sesión inválida", "Iniciá sesión nuevamente para continuar.");
      return;
    }
    if (!templateId) {
      log.warn("missing persona template id", { targetLevel });
      Alert.alert(
        "Configuración incompleta",
        "La verificación de identidad no está disponible en este momento.",
      );
      return;
    }
    haptics.medium();
    setPhase("in_progress");
  }, [userId, templateId, targetLevel]);

  const handleClose = useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      type PersonaMessage = { name?: string; metadata?: Record<string, unknown> };
      let payload: PersonaMessage;
      try {
        payload = JSON.parse(raw) as PersonaMessage;
      } catch {
        log.debug("non-json webview message", { raw: raw.slice(0, 100) });
        return;
      }

      // Persona dispatch eventos via window.postMessage. Event names
      // según docs: "complete", "cancel", "error", "ready", "load".
      switch (payload.name) {
        case "complete":
          log.info("persona inquiry complete", { targetLevel });
          haptics.success();
          // Setear status pending — el webhook server-side lo flippea a
          // approved/rejected. UI optimista + correct si webhook tarda.
          setProfile({ kycStatus: "pending" });
          setPhase("completed");
          // Auto-back después de 1.5s para mostrar el success state.
          setTimeout(() => router.back(), 1500);
          break;
        case "cancel":
          log.info("persona inquiry cancelled", { targetLevel });
          haptics.tap();
          setPhase("cancelled");
          break;
        case "error":
          log.warn("persona inquiry error", { targetLevel, metadata: payload.metadata });
          haptics.error();
          setPhase("failed");
          break;
        // ready/load: no-op, solo silencian el log.debug.
        default:
          break;
      }
    },
    [router, setProfile, targetLevel],
  );

  return (
    <Screen padded edges={["top", "bottom"]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 4,
          marginBottom: 16,
        }}
      >
        <Text variant="h2">
          {phase === "in_progress" ? "Verificando" : "Verificá tu identidad"}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          label={phase === "in_progress" ? "Cancelar" : "Cerrar"}
          onPress={handleClose}
        />
      </View>

      {phase === "intro" || phase === "cancelled" || phase === "failed" ? (
        <IntroBlock targetLevel={targetLevel} phase={phase} onStart={handleStart} />
      ) : null}

      {phase === "in_progress" && inquiryUrl ? (
        <View style={{ flex: 1, marginHorizontal: -20 }}>
          <WebView
            source={{ uri: inquiryUrl }}
            onMessage={handleWebViewMessage}
            originWhitelist={["https://*"]}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            mediaPlaybackRequiresUserAction={false}
            renderLoading={() => (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.bg.primary,
                }}
              >
                <ActivityIndicator size="large" color={colors.brand.primary} />
              </View>
            )}
          />
        </View>
      ) : null}

      {phase === "completed" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.success,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark" size={36} color={colors.text.inverse} />
          </View>
          <Text variant="h2">Verificación enviada</Text>
          <Text variant="body" tone="secondary" style={{ textAlign: "center", maxWidth: 280 }}>
            Estamos revisando tu información. Te avisamos en cuanto esté lista.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function IntroBlock({
  targetLevel,
  phase,
  onStart,
}: {
  targetLevel: 1 | 2;
  phase: Phase;
  onStart: () => void;
}) {
  const ctaLabel =
    phase === "cancelled"
      ? "Reintentar verificación"
      : phase === "failed"
        ? "Volver a intentar"
        : "Comenzar verificación";

  return (
    <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 16 }}>
      <View style={{ gap: 24 }}>
        <Text variant="heroDisplay" tone="primary" style={{ marginTop: 16 }}>
          Verificá{"\n"}tu identidad
        </Text>
        <Text variant="body" tone="secondary" style={{ lineHeight: 23 }}>
          {targetLevel === 1
            ? "Necesitamos confirmar tu identidad antes de mover montos mayores. Es rápido — alrededor de 2 minutos."
            : "Para subir tu límite mensual a USD 10.000 necesitamos tu identidad y un comprobante de domicilio. ~5 minutos."}
        </Text>

        <Card variant="sunken" padded radius="md">
          <View style={{ gap: 14 }}>
            <Requirement
              icon="card-outline"
              text="Tu documento de identidad (cédula o pasaporte)"
            />
            <Requirement icon="happy-outline" text="Una selfie corta para confirmar que sos vos" />
            {targetLevel === 2 ? (
              <Requirement
                icon="document-text-outline"
                text="Comprobante de domicilio (factura ≤3 meses)"
              />
            ) : null}
            <Requirement
              icon="time-outline"
              text={targetLevel === 2 ? "5–10 minutos" : "2–3 minutos"}
            />
          </View>
        </Card>

        {phase === "cancelled" ? (
          <Text variant="bodySmall" tone="tertiary" style={{ textAlign: "center" }}>
            Cancelaste la verificación. Podés reintentar cuando estés listo.
          </Text>
        ) : null}

        {phase === "failed" ? (
          <Text variant="bodySmall" tone="danger" style={{ textAlign: "center" }}>
            Algo falló durante la verificación. Probá de nuevo en unos segundos.
          </Text>
        ) : null}
      </View>

      <Button label={ctaLabel} variant="primary" size="lg" fullWidth onPress={onStart} />
    </View>
  );
}

function Requirement({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={icon} size={20} color={colors.brand.primary} />
      <Text variant="body" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Construye la URL del Persona hosted inquiry. Format documentado en
 * https://docs.withpersona.com/inquiry-flows/embedded-flows/hosted-flow.
 *
 * `reference-id` = privy DID — el webhook lo usa para resolver qué
 * profile actualizar.
 */
function buildPersonaUrl(templateId: string, referenceId: string): string {
  const params = new URLSearchParams({
    "inquiry-template-id": templateId,
    "reference-id": referenceId,
    environment: PERSONA_ENV,
    // `iframe-origin` permite que Persona postMessage al webview parent.
    "iframe-origin": "*",
  });
  return `${PERSONA_HOSTED_URL}?${params.toString()}`;
}
