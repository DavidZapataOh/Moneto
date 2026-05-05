import { ErrorBoundary, type ErrorBoundaryFallback } from "@moneto/ui";
import { createLogger } from "@moneto/utils";
import * as Sentry from "@sentry/react-native";

import type { ReactNode } from "react";

const log = createLogger("error-boundary");

interface Props {
  children: ReactNode;
  /**
   * Identificador del feature wrapped — agrega tag a Sentry para que el
   * dashboard agrupe errores por sección. Ej: "saldo.balance-hero",
   * "card.settings".
   */
  feature: string;
  /** Optional override del fallback. Default = ErrorState con retry. */
  fallback?: ErrorBoundaryFallback;
}

/**
 * Wrapper sobre `@moneto/ui ErrorBoundary` que inyecta el callback a
 * Sentry. Usar este en mobile en vez del primitivo crudo — `@moneto/ui`
 * NO depende de Sentry directamente para mantener el package agnostic.
 *
 * Uso recomendado: wrap por feature, NO global. Un error en
 * `<RecentTransactions />` no debe tirar la pantalla completa.
 *
 * @example
 *   <ScreenErrorBoundary feature="saldo.transactions">
 *     <RecentTransactions />
 *   </ScreenErrorBoundary>
 */
export function ScreenErrorBoundary({ children, feature, fallback }: Props) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        log.error("error boundary caught", { feature, message: error.message });
        Sentry.captureException(error, {
          tags: { error_boundary: feature },
          extra: { componentStack: errorInfo.componentStack },
        });
      }}
      {...(fallback ? { fallback } : {})}
    >
      {children}
    </ErrorBoundary>
  );
}
