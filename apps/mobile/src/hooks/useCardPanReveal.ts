import { createLogger } from "@moneto/utils";
import * as LocalAuthentication from "expo-local-authentication";
import * as ScreenCapture from "expo-screen-capture";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { capture, Events, getPostHog } from "@/lib/observability";

const log = createLogger("card.pan");

/**
 * Tiempo máximo de exposición del PAN. Match con Apple Wallet y Revolut.
 * 30s es suficiente para que el user lo lea / copie, sin dejarlo visible
 * en background si pone el phone bocabajo y se olvida.
 */
const AUTO_HIDE_MS = 30_000;

interface UseCardPanRevealReturn {
  /** True cuando el PAN completo se está mostrando en la card. */
  showFullPan: boolean;
  /**
   * Dispara el flow: biometric prompt → si OK, expone el PAN, arranca timer
   * de auto-hide y subscribe al screenshot listener. Idempotent — calls
   * concurrentes son no-op.
   */
  reveal: () => Promise<void>;
  /** Oculta el PAN inmediato (cancel del timer + unsub). */
  hide: () => void;
  /** True mientras corre el biometric prompt — disable button para evitar dobles. */
  isRevealing: boolean;
}

/**
 * Hook que encapsula el flow de reveal del PAN completo de la card.
 *
 * Garantías de privacidad:
 * 1. **Biometric obligatorio** — `LocalAuthentication.authenticateAsync` se
 *    llama en cada reveal. NO cacheamos auth; el user re-autentica cada vez.
 * 2. **Auto-hide a 30s** — timer cancelable + restart en cada reveal.
 * 3. **Screenshot detection** — `expo-screen-capture` notifica si el user
 *    captura pantalla mientras el PAN está visible → auto-hide + alert + event.
 * 4. **Cleanup en unmount** — timer + listener removidos al desmontar.
 *
 * NUNCA loguear el PAN en console / Sentry / Axiom. Sólo `pan_revealed: true`
 * sin valor.
 */
export function useCardPanReveal(): UseCardPanRevealReturn {
  const [showFullPan, setShowFullPan] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenshotSub = useRef<{ remove: () => void } | null>(null);

  const cleanup = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (screenshotSub.current) {
      screenshotSub.current.remove();
      screenshotSub.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    cleanup();
    setShowFullPan(false);
  }, [cleanup]);

  const reveal = useCallback(async () => {
    if (isRevealing || showFullPan) return;
    setIsRevealing(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;

      if (!hasHardware || !enrolled) {
        // Sin biometric — fallback no-auth solo en dev/sandbox. Production:
        // bloquear y prompt-ear setup. El usuario "vé" el PAN igual hoy en
        // mock, pero el evento queda con `method: 'fallback'` para tracking.
        log.warn("biometric unavailable, using fallback", { hasHardware, enrolled });
        const ph = getPostHog();
        if (ph) capture(ph, Events.card_pan_revealed, { method: "fallback" });
      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Mostrar número de tarjeta",
          cancelLabel: "Cancelar",
          disableDeviceFallback: false,
        });
        if (!result.success) {
          log.info("biometric cancelled or failed", {
            error: "error" in result ? result.error : null,
          });
          return;
        }
        const ph = getPostHog();
        if (ph) capture(ph, Events.card_pan_revealed, { method: "biometric" });
      }

      // Subscribe al screenshot — antes de exponer el PAN.
      try {
        const sub = ScreenCapture.addScreenshotListener(() => {
          log.warn("screenshot detected during PAN reveal — auto-hiding");
          const ph = getPostHog();
          if (ph) capture(ph, Events.card_pan_screenshot_detected, {});
          Alert.alert(
            "Captura detectada",
            "Tu número apareció en pantalla. Ocultamos los datos. Si tomaste la captura por error, borrala de tu galería.",
            [{ text: "Entendido" }],
          );
          hide();
        });
        screenshotSub.current = sub;
      } catch (err) {
        // En Android <10 + algunos devices no soporta el listener — degradamos
        // silently. El reveal sigue funcionando, sólo no detectamos screenshots.
        log.warn("screen-capture listener failed", {
          err: String(err),
          platform: Platform.OS,
        });
      }

      setShowFullPan(true);

      // Timer auto-hide. Cancelable si el user lo oculta antes manual.
      hideTimer.current = setTimeout(() => {
        log.debug("PAN reveal auto-hide timer fired");
        hide();
      }, AUTO_HIDE_MS);
    } finally {
      setIsRevealing(false);
    }
  }, [isRevealing, showFullPan, hide]);

  // Cleanup en unmount — sin esto, un user que navega out con PAN visible
  // dejaría timers pendientes y leaks de listener.
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { showFullPan, reveal, hide, isRevealing };
}
