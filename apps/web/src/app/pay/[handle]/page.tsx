import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { fetchPublicPayProfile } from "@/lib/api";
import { detectDevice } from "@/lib/device";
import { renderQrSvg } from "@/lib/qr";
import { buildSolanaPayUrl, USDC_MAINNET_MINT } from "@/lib/solana-pay";

import { PayPageClient } from "./PayPageClient";
import { ProvisioningView } from "./ProvisioningView";

import type { Metadata } from "next";

interface PageProps {
  params: { handle: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Sin disclosure de PII en metadata. Si el handle no existe o aún se
  // está provisionando, OG cae al default + no-index.
  const result = await fetchPublicPayProfile(params.handle);
  if (result.status !== "ok") {
    return {
      title: "Moneto · Pago",
      robots: { index: false, follow: false },
    };
  }

  const { profile } = result;
  const displayName = profile.name ?? `@${profile.handle}`;
  const ogImageUrl = `/api/og/pay?handle=${encodeURIComponent(profile.handle)}`;
  return {
    title: `Pagar a ${displayName} · Moneto`,
    description: `Enviá USDC a ${displayName} desde cualquier wallet Solana. Sin fees al sender.`,
    openGraph: {
      title: `Pagar a ${displayName}`,
      description: "Pago en segundos vía Solana Pay.",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Pagar a ${displayName}`,
      description: "Powered by Moneto · privacy-first neobank LATAM.",
      images: [ogImageUrl],
    },
    robots: { index: false, follow: false }, // Privacy: handles públicos no se indexan.
  };
}

export default async function PayPage({ params }: PageProps) {
  const result = await fetchPublicPayProfile(params.handle);

  if (result.status === "not_found") notFound();
  if (result.status === "provisioning") {
    return <ProvisioningView handle={params.handle} />;
  }

  const { profile } = result;

  // Server-side QR para no-JS friendly first paint. URL default = sin
  // amount/memo (el sender los pega en el wallet). Cuando el user edita
  // los inputs, el client component toma el control y re-renderea.
  const initialPayUrl = buildSolanaPayUrl({
    recipient: profile.wallet_address,
    splToken: USDC_MAINNET_MINT,
    label: `Pagar a ${profile.name ?? profile.handle}`,
    message: "Moneto payroll",
  });
  const initialQrSvg = await renderQrSvg(initialPayUrl);

  // Device detection desde UA — mobile prioriza "Abrir en wallet" CTA,
  // desktop prioriza el QR. Cost de mal-clasificar es bajo (ambos
  // siempre visibles, solo cambia la prominencia).
  const userAgent = headers().get("user-agent");
  const device = detectDevice(userAgent);

  return <PayPageClient profile={profile} initialQrSvg={initialQrSvg} device={device} />;
}
