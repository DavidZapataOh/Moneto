"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildSolanaPayUrl, USDC_MAINNET_MINT } from "@/lib/solana-pay";

import type { PublicPayProfile } from "@/lib/api";

interface PayPageClientProps {
  profile: PublicPayProfile;
}

/**
 * Client-side pay form + QR rendering. Server-side renderea el wrapper
 * (page.tsx) para SEO + first paint; este componente solo se hidrata
 * para que el user pueda editar amount/memo.
 *
 * Visual aplicada (colors.txt + design.txt + mobile-design.txt):
 * - **60/30/10**: bg cream-base, surfaces white-elevated, single emphasis
 *   en el botón "Abrir en wallet" (terracota). El QR es protagonista
 *   visual pero no compite por color — es black-on-cream.
 * - **Single emphasis**: el QR es el headline. Los inputs son contexto.
 * - **Gift framework**: render del QR con fade-in suave (200ms). El
 *   user "siente" que el QR se materializa después de tipear.
 */
export function PayPageClient({ profile }: PayPageClientProps) {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const displayName = profile.name ?? `@${profile.handle}`;
  const initials = (profile.name ?? profile.handle).slice(0, 2).toUpperCase();

  // ── Solana Pay URL — re-genera cuando amount/memo cambien ─────────────
  const solanaPayUrl = useMemo(() => {
    const amountNum = parseFloat(amount);
    return buildSolanaPayUrl({
      recipient: profile.wallet_address,
      ...(Number.isFinite(amountNum) && amountNum > 0 ? { amount: amountNum } : {}),
      splToken: USDC_MAINNET_MINT,
      label: `Pagar a ${displayName}`,
      message: memo.trim() || "Moneto payroll",
      ...(memo.trim() ? { memo: memo.trim() } : {}),
    });
  }, [profile.wallet_address, displayName, amount, memo]);

  // ── QR rendering ───────────────────────────────────────────────────────
  // `qrcode` lib renderea a SVG string (no DOM). Lo inyectamos via
  // `dangerouslySetInnerHTML` — el contenido es 100% determinístico
  // desde nuestros inputs, no XSS surface.
  useEffect(() => {
    let cancelled = false;
    QRCode.toString(solanaPayUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 1,
      width: 280,
      color: {
        dark: "#1A1610", // ink-900
        light: "#FBF6E9", // cream-50
      },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        // QR generation should never fail for valid input. Silent fail
        // → fallback message renders below.
      });
    return () => {
      cancelled = true;
    };
  }, [solanaPayUrl]);

  // ── Copy address ───────────────────────────────────────────────────────
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(profile.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission denied — fallback al manual copy.
    }
  };

  return (
    <main className="min-h-screen bg-[#FBF6E9] flex flex-col">
      <header className="px-6 py-5 border-b border-[#E9DFC7] bg-white/60 backdrop-blur">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tight text-[#1A1610]">Moneto</span>
          <a
            href="https://moneto.xyz"
            className="text-xs text-[#7A6D54] hover:text-[#1A1610] transition-colors"
            rel="noopener"
          >
            Conocé Moneto →
          </a>
        </div>
      </header>

      <section className="flex-1 px-6 py-8">
        <div className="max-w-md mx-auto">
          {/* Recipient header */}
          <div className="flex items-center gap-3 mb-6">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar urls vary, no Image domain config necesario
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-12 h-12 rounded-full border border-[#E9DFC7] object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-medium"
                style={{
                  backgroundColor: "rgba(200, 148, 80, 0.22)",
                  color: "#7A4F1B",
                }}
                aria-hidden
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] tracking-wider uppercase text-[#7A6D54]">Pagar a</p>
              <h1 className="text-xl font-semibold text-[#1A1610] truncate">{displayName}</h1>
              <p className="text-xs text-[#7A6D54] truncate">@{profile.handle}</p>
            </div>
          </div>

          {/* Amount + memo inputs */}
          <div className="space-y-3 mb-6">
            <label className="block">
              <span className="text-[11px] tracking-wider uppercase text-[#7A6D54]">
                Monto USD (opcional)
              </span>
              <div className="mt-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A6D54]">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="3000"
                  className="w-full pl-9 pr-4 py-3 rounded-2xl border border-[#E9DFC7] bg-white text-[#1A1610] text-base font-mono focus:outline-none focus:border-[#B5452B] transition-colors"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] tracking-wider uppercase text-[#7A6D54]">
                Mensaje (opcional)
              </span>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Salario diciembre"
                maxLength={140}
                className="mt-1 w-full px-4 py-3 rounded-2xl border border-[#E9DFC7] bg-white text-[#1A1610] text-base focus:outline-none focus:border-[#B5452B] transition-colors"
              />
            </label>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div
              className="bg-[#FBF6E9] p-5 rounded-3xl shadow-[0_18px_36px_-18px_rgba(26,22,16,0.28)] border border-[#E9DFC7]"
              aria-hidden
            >
              {qrSvg ? (
                <div
                  className="w-[280px] h-[280px] [&>svg]:w-full [&>svg]:h-full"
                  // eslint-disable-next-line react/no-danger -- contenido 100% derivado de inputs nuestros, no XSS surface
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="w-[280px] h-[280px] flex items-center justify-center text-sm text-[#7A6D54]">
                  Generando QR…
                </div>
              )}
            </div>
            <p className="text-sm text-[#3F392E] text-center max-w-xs">
              Escaneá con cualquier wallet Solana — Phantom, Backpack, Solflare.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="space-y-2">
            <a
              href={solanaPayUrl}
              className="block w-full text-center rounded-2xl py-4 px-5 bg-[#B5452B] hover:bg-[#9C3B25] active:bg-[#823120] transition-colors text-white font-medium text-[15px]"
            >
              Abrir en wallet
            </a>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="block w-full text-center rounded-2xl py-4 px-5 bg-white hover:bg-[#F0E9D6] active:bg-[#E9DFC7] transition-colors border border-[#E9DFC7] text-[#1A1610] font-medium text-[15px]"
            >
              {copied ? "Dirección copiada ✓" : "Copiar dirección"}
            </button>
          </div>

          {/* Wallet address (preview) */}
          <p className="mt-4 text-center text-[11px] font-mono text-[#7A6D54] break-all">
            {profile.wallet_address}
          </p>

          {/* Privacy footer */}
          <div className="mt-8 pt-6 border-t border-[#E9DFC7] text-center">
            <p className="text-xs text-[#7A6D54] leading-relaxed">
              Sin fees al sender. {displayName} recibe el pago en segundos y empieza a rendir APY
              automáticamente.
            </p>
            <p className="mt-3 text-[10px] tracking-wider uppercase text-[#9A8E73]">
              Powered by Moneto · Solana Pay
            </p>
          </div>
        </div>
      </section>

      {/* Hidden canvas — reservado para QR fallback rendering. */}
      <canvas ref={canvasRef} hidden />
    </main>
  );
}
