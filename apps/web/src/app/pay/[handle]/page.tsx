import { notFound } from "next/navigation";

import { fetchPublicPayProfile } from "@/lib/api";

import { PayPageClient } from "./PayPageClient";

import type { Metadata } from "next";

interface PageProps {
  params: { handle: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Sin disclosure de PII en metadata — solo confirma que el handle existe.
  // Si el handle no existe, OpenGraph cae al default del root layout.
  const profile = await fetchPublicPayProfile(params.handle);
  if (!profile) return { title: "Moneto · Pago" };

  const displayName = profile.name ?? `@${profile.handle}`;
  return {
    title: `Pagar a ${displayName} · Moneto`,
    description: `Enviá USDC a ${displayName} desde cualquier wallet Solana. Sin fees al sender.`,
    openGraph: {
      title: `Pagar a ${displayName}`,
      description: "Pago en segundos vía Solana Pay.",
      type: "website",
    },
    robots: { index: false, follow: false }, // Privacy: no indexamos handles públicos.
  };
}

export default async function PayPage({ params }: PageProps) {
  const profile = await fetchPublicPayProfile(params.handle);
  if (!profile) notFound();

  return <PayPageClient profile={profile} />;
}
