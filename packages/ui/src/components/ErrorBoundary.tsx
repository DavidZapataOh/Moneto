import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "./ErrorState";

/**
 * Render-prop fallback. Si el caller pasa `fallback`, recibe el error
 * + un `retry()` callback que resetea el boundary. Si no, renderea el
 * default `ErrorState` con `onRetry`.
 */
export type ErrorBoundaryFallback = (error: Error, retry: () => void) => ReactNode;

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ErrorBoundaryFallback;
  /**
   * Hook para reportar el error a una herramienta externa (Sentry, Axiom).
   * `@moneto/ui` no importa Sentry directo — el caller wirea
   * `Sentry.captureException(error, { extra: { componentStack } })`.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Class-component error boundary. Aísla failures: un error en un sub-tree
 * no rompe la pantalla completa. Patrón recomendado: wrap por feature
 * (BalanceHero, AssetStrip, RecentTransactions) en lugar de un único
 * boundary global.
 *
 * El error capturado se reporta via `onError` (mobile wirea Sentry) y
 * el render cae al `fallback` o al default `ErrorState` con retry.
 *
 * **No usa hooks** — class component porque React no soporta error
 * boundaries vía hooks. Esto es por diseño de React.
 *
 * @example
 *   <ErrorBoundary onError={(e, info) => Sentry.captureException(e, { extra: info })}>
 *     <BalanceHero />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  retry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.retry);
      return <ErrorState onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
