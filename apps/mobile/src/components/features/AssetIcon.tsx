import { getAsset, type AssetId } from "@moneto/types";
import { Text, useTheme } from "@moneto/ui";
import { View, Image, type ImageSourcePropType } from "react-native";

import type { Asset } from "@data/mock";

interface AssetIconProps {
  /** Acepta un Asset (mock) o solo un AssetId — solo necesita el id. */
  asset: Asset | { id: AssetId };
  size?: number;
}

/**
 * Resolución `iconAsset` (string path del registry) → `require()` real.
 * El registry queda agnostic de la plataforma; este map es mobile-only.
 *
 * Si un path no está mapeado (ej. flags/mx.png aún no comprado), el
 * componente cae a un emoji fallback — no crash, identidad reconocible.
 */
const ICON_MAP: Record<string, ImageSourcePropType> = {
  "flags/us.png": require("../../../assets/images/Flag_of_the_United_States.png"),
  "flags/co.png": require("../../../assets/images/Flag_Colombia.png"),
  "crypto/sol.png": require("../../../assets/images/Solana_logo.png"),
  "crypto/btc.png": require("../../../assets/images/bitcoin.png"),
  "crypto/eth.png": require("../../../assets/images/ethereum-eth-logo.png"),
  // Pendientes (Sprint 3 polish): flags/eu.png, flags/mx.png, flags/br.png, flags/ar.png.
  // Mientras no estén, el fallback emoji-bandera tinted bubble cubre.
};

/** Emojis bandera de fallback per AssetId, para assets sin PNG aún. */
const EMOJI_FALLBACK: Partial<Record<AssetId, string>> = {
  eur: "🇪🇺",
  mxn: "🇲🇽",
  brl: "🇧🇷",
  ars: "🇦🇷",
};

/**
 * Asset icon canónico de Moneto. Lee del `ASSETS_REGISTRY` (`@moneto/types`)
 * el `iconType` y el `iconAsset` — el registry es la fuente de verdad
 * unificada para mobile + api + on-chain orchestrator.
 *
 * Reglas visuales:
 * - **flag** (stables con país): bandera fill al 100% dentro del círculo,
 *   borderColor sutil. Si la bandera PNG no está mapeada todavía, fallback
 *   a emoji bandera dentro de un bubble tinted con tono fiat (clay).
 * - **logo BTC/SOL**: logo al 100%, identidad propia (overlay bg sutil).
 * - **logo ETH**: logo al 62% dentro de bubble ETH-blue tinted — el logo
 *   solo se vería raro al 100%.
 *
 * Esos branches están guiados por design.txt — *"icons need no color"*
 * para los logos crypto que SON su color, vs flags que son neutral.
 */
export function AssetIcon({ asset, size = 48 }: AssetIconProps) {
  const { colors } = useTheme();
  const meta = getAsset(asset.id);
  const iconSource = ICON_MAP[meta.iconAsset];

  // ── Flag con PNG mapeado: cover full circle ──────────────────────────
  if (meta.iconType === "flag" && iconSource) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          flexShrink: 0,
          borderWidth: 1,
          borderColor: colors.border.subtle,
        }}
      >
        <Image source={iconSource} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    );
  }

  // ── Logos crypto con tratamiento especial por asset ─────────────────
  if (meta.iconType === "logo" && iconSource) {
    // BTC + SOL: logo al 100% (son su propia identidad).
    if (asset.id === "btc" || asset.id === "sol") {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
            flexShrink: 0,
            backgroundColor: colors.bg.overlay,
          }}
        >
          <Image source={iconSource} style={{ width: size, height: size }} resizeMode="cover" />
        </View>
      );
    }

    // ETH: logo al 62% dentro de bubble blue-tinted (color brand de ETH).
    if (asset.id === "eth") {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "rgba(98, 126, 234, 0.18)",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Image
            source={iconSource}
            style={{ width: size * 0.62, height: size * 0.62 }}
            resizeMode="contain"
          />
        </View>
      );
    }
  }

  // ── Fallback: emoji bandera (sin PNG) ─────────────────────────────────
  // Para flag-type assets cuya PNG aún no está, mostramos el emoji con
  // tinted bg cálido (clay) — coherente con la temperatura warm del theme
  // (ningún gris frío). EU usa olive bg para diferenciar.
  const isEur = asset.id === "eur";
  const emoji = EMOJI_FALLBACK[asset.id] ?? "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isEur ? "rgba(107, 122, 56, 0.2)" : "rgba(200, 148, 80, 0.22)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        borderWidth: 1,
        borderColor: colors.border.subtle,
      }}
    >
      <Text style={{ fontSize: size * 0.48 }} allowFontScaling={false}>
        {emoji}
      </Text>
    </View>
  );
}
