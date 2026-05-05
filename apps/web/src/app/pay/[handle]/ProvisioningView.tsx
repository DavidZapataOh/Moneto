"use client";

import { useEffect, useState } from "react";

interface ProvisioningViewProps {
  handle: string;
}

/**
 * Render cuando el handle existe pero el wallet aún no fue provisionado
 * por Privy (race post-OAuth). El backend ya intentó 3× con backoff —
 * acá ofrecemos al user refresh manual + auto-retry cada 5s (máximo 6
 * intentos antes de mostrar "intentá de nuevo más tarde").
 *
 * Visual coherente con `not-found.tsx` y la pay page principal — cream
 * bg, terracota CTA único, copy honesto.
 */
export function ProvisioningView({ handle }: ProvisioningViewProps) {
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= 6) return;
    const t = setTimeout(() => {
      setAttempts((n) => n + 1);
      // Soft reload del current path — Next.js re-fetcha el server
      // component, que reintenta la resolución del wallet.
      window.location.reload();
    }, 5000);
    return () => clearTimeout(t);
  }, [attempts]);

  const exhausted = attempts >= 6;

  return (
    <main className="min-h-screen bg-[#FBF6E9] flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(181, 69, 43, 0.12)" }}
          aria-hidden
        >
          <span className="block w-8 h-8 rounded-full border-2 border-[#B5452B] border-t-transparent animate-spin" />
        </div>
        <h1 className="text-2xl font-semibold text-[#1A1610]">
          {exhausted ? "Cuenta aún no lista" : "Cuenta inicializándose"}
        </h1>
        <p className="mt-3 text-sm text-[#7A6D54] leading-relaxed">
          {exhausted
            ? `La cuenta de @${handle} todavía está siendo provisionada. Probá de nuevo en unos minutos.`
            : `Estamos preparando la cuenta de @${handle}. Te refrescamos automáticamente.`}
        </p>
        {exhausted ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-block rounded-2xl py-3 px-6 bg-[#B5452B] hover:bg-[#9C3B25] transition-colors text-white font-medium text-sm"
          >
            Reintentar
          </button>
        ) : (
          <p className="mt-4 text-[11px] uppercase tracking-wider text-[#9A8E73]">
            Reintento {attempts + 1} de 6
          </p>
        )}
      </div>
    </main>
  );
}
