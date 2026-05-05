import { ImageResponse } from "next/og";

import { fetchPublicPayProfile } from "@/lib/api";

export const runtime = "edge";

/**
 * Open Graph image generator para `/pay/[handle]` (Sprint 4.02). Sirve
 * el preview que aparece cuando el user comparte el payroll link en
 * WhatsApp, Telegram, Twitter, etc.
 *
 * Output: 1200×630 PNG, brand-coherente con la pay page (cream bg,
 * terracota accent, ink-900 text). Edge runtime para latencia mínima
 * — Next.js renderea con Satori (react-jsx → SVG → PNG).
 *
 * Cache: ImageResponse setea `Cache-Control: public, max-age=N` por
 * default. Ajustamos a 1h público + revalidate 5min para que cambios
 * de avatar/name del user se propaguen razonablemente rápido.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = (searchParams.get("handle") ?? "").toLowerCase().replace(/^@/, "");

  // Si el handle inválido o no existe, render genérico de Moneto. NO
  // 404 — los crawlers de WhatsApp/Twitter NO renderean OG con response
  // non-2xx, lo que rompería el preview.
  if (!handle || !/^[a-z0-9_-]{3,32}$/.test(handle)) {
    return brandFallback("Moneto · Payments");
  }

  const result = await fetchPublicPayProfile(handle);
  if (result.status !== "ok") {
    return brandFallback(`@${handle}`);
  }

  const { profile } = result;
  const displayName = profile.name ?? `@${profile.handle}`;
  const initials = (profile.name ?? profile.handle).slice(0, 2).toUpperCase();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FBF6E9",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#1A1610",
            letterSpacing: -0.5,
          }}
        >
          Moneto
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#7A6D54",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Solana Pay
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1, display: "flex" }} />

      {/* Recipient block */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
        }}
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori requiere <img>, no Image
          <img
            src={profile.avatar_url}
            alt=""
            width={144}
            height={144}
            style={{
              borderRadius: 72,
              border: "2px solid #E9DFC7",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 144,
              height: 144,
              borderRadius: 72,
              background: "rgba(200, 148, 80, 0.22)",
              color: "#7A4F1B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#7A6D54",
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
          >
            Pagar a
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              color: "#1A1610",
              letterSpacing: -1,
              lineHeight: 1.1,
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#7A6D54",
              marginTop: 4,
            }}
          >
            @{profile.handle}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1, display: "flex" }} />

      {/* Footer CTA strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 32,
          borderTop: "1px solid #E9DFC7",
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: "#3F392E",
            maxWidth: 720,
          }}
        >
          Pago en segundos desde cualquier wallet Solana — sin fees al sender.
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "#FBF6E9",
            background: "#B5452B",
            padding: "16px 28px",
            borderRadius: 999,
            letterSpacing: 0.2,
          }}
        >
          moneto.xyz
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}

/**
 * Fallback genérico cuando no podemos resolver el handle. Mantiene
 * brand para que el preview no rompa visualmente.
 */
function brandFallback(label: string): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FBF6E9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 88,
          fontWeight: 600,
          color: "#1A1610",
          letterSpacing: -2,
        }}
      >
        Moneto
      </div>
      <div
        style={{
          fontSize: 32,
          color: "#7A6D54",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 32,
          fontSize: 22,
          color: "#3F392E",
          maxWidth: 720,
          textAlign: "center",
        }}
      >
        El neobanco privado para LATAM. Construido en Solana.
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
