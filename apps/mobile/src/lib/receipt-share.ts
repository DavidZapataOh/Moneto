import { createLogger } from "@moneto/utils";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

import type { DecryptedTx } from "@hooks/useTxHistory";

const log = createLogger("receipt.share");

/**
 * Helpers para share + PDF export del tx detail (Sprint 4.08).
 *
 * **Share PNG** (`shareReceiptImage`):
 * 1. `captureRef(viewRef, { format: "png", quality: 0.95 })` snapshot
 *    del card receipt-style — NO toda la screen (security: balance
 *    hidden state stays hidden).
 * 2. `Sharing.shareAsync(uri)` con UTI de imagen para que iOS muestre
 *    targets apropiados (Photos, Mensajes, WhatsApp, etc.).
 *
 * **Export PDF** (`exportReceiptPDF`):
 * 1. Render HTML branded inline (sans-serif, terracota accent,
 *    receipt-style layout).
 * 2. `Print.printToFileAsync({ html })` → file URI.
 * 3. `Sharing.shareAsync(uri)` con MIME PDF.
 *
 * **Privacy**: el HTML del PDF NO incluye keys, viewing keys, ni
 * full pubkey del recipient (display short).
 */

export interface ShareOptions {
  /** Optional title visible en el share sheet de Android. iOS lo ignora. */
  dialogTitle?: string;
}

/**
 * Captura el componente ref-eado y dispara el share sheet con el PNG.
 * Returns true si el user completó el share, false si canceló o falló.
 */
export async function shareReceiptImage(
  viewRef: React.RefObject<View>,
  options: ShareOptions = {},
): Promise<boolean> {
  if (!viewRef.current) {
    log.warn("share called with null ref");
    return false;
  }
  try {
    const uri = await captureRef(viewRef, {
      format: "png",
      quality: 0.95,
      // result: "tmpfile" → URI usable por Sharing en iOS + Android.
      result: "tmpfile",
    });
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      log.warn("sharing not available on platform");
      return false;
    }
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: options.dialogTitle ?? "Comprobante Moneto",
    });
    return true;
  } catch (err) {
    log.warn("share image failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Renderea HTML branded → PDF → share. Returns true on success.
 */
export async function exportReceiptPDF(
  tx: DecryptedTx,
  options: ShareOptions = {},
): Promise<boolean> {
  try {
    const html = renderReceiptHtml(tx);
    const result = await Print.printToFileAsync({
      html,
      base64: false,
      // A4 portrait — más universal que letter para LATAM.
      width: 595,
      height: 842,
    });
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      log.warn("sharing not available on platform");
      return false;
    }
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: options.dialogTitle ?? "Comprobante Moneto",
    });
    return true;
  } catch (err) {
    log.warn("export pdf failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * HTML inline brand-coherent. Sans-serif system + monospace para amount,
 * cream bg + terracota accent. Sprint 8 polish puede usar
 * @react-native-pdf con Inter/Fraunces real desde EAS asset.
 */
function renderReceiptHtml(tx: DecryptedTx): string {
  const isIncoming = tx.amount > 0;
  const sign = isIncoming ? "+" : "−";
  const abs = Math.abs(tx.amount);
  const amount = formatAmountForReceipt(abs, tx.currency);
  const counterparty = tx.counterpartyName ?? tx.counterpartyHandle ?? "—";
  const date = new Date(tx.timestamp).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const generatedAt = new Date().toLocaleString("es-CO");
  const sigShort = `${tx.id.slice(0, 8)}…${tx.id.slice(-8)}`;

  // SEC: escapamos cualquier user-controlled string que vaya al HTML.
  const safeDescription = htmlEscape(tx.description);
  const safeCounterparty = htmlEscape(counterparty);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Comprobante Moneto</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    color: #1A1610;
    background: #FBF6E9;
    padding: 48px 40px;
    -webkit-text-size-adjust: 100%;
  }
  .container { max-width: 480px; margin: 0 auto; }
  .header {
    text-align: center;
    padding-bottom: 24px;
    border-bottom: 1px solid #E9DFC7;
    margin-bottom: 28px;
  }
  .brand {
    font-size: 26px;
    font-weight: 600;
    color: #B5452B;
    letter-spacing: -0.5px;
  }
  .subtitle {
    font-size: 12px;
    color: #7A6D54;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    margin-top: 6px;
  }
  .status {
    text-align: center;
    margin-bottom: 12px;
  }
  .status-pill {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 999px;
    background: rgba(107, 122, 56, 0.12);
    color: #4F5B26;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
  .amount {
    text-align: center;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 44px;
    font-weight: 600;
    color: ${isIncoming ? "#4F5B26" : "#1A1610"};
    letter-spacing: -1.2px;
    margin: 8px 0 4px;
  }
  .currency {
    text-align: center;
    font-size: 13px;
    color: #7A6D54;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 28px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #E9DFC7;
    font-size: 14px;
  }
  .row:last-child { border-bottom: none; }
  .label { color: #7A6D54; }
  .value { color: #1A1610; font-weight: 500; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
  .footer {
    margin-top: 32px;
    text-align: center;
    font-size: 10px;
    color: #9A8E73;
    text-transform: uppercase;
    letter-spacing: 1.2px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Moneto</div>
      <div class="subtitle">Comprobante de movimiento</div>
    </div>

    <div class="status">
      <span class="status-pill">${tx.status === "completed" ? "Completado" : tx.status === "pending" ? "Pendiente" : "Fallido"}</span>
    </div>

    <div class="amount">${sign}${amount}</div>
    <div class="currency">${htmlEscape(tx.currency)}</div>

    <div class="row"><span class="label">Tipo</span><span class="value">${typeLabel(tx.type)}</span></div>
    <div class="row"><span class="label">${isIncoming ? "De" : "A"}</span><span class="value">${safeCounterparty}</span></div>
    ${tx.description ? `<div class="row"><span class="label">Mensaje</span><span class="value">${safeDescription}</span></div>` : ""}
    <div class="row"><span class="label">Fecha</span><span class="value">${htmlEscape(date)}</span></div>
    <div class="row"><span class="label">ID</span><span class="value mono">${htmlEscape(sigShort)}</span></div>

    <div class="footer">Generado por Moneto · ${htmlEscape(generatedAt)}</div>
  </div>
</body>
</html>`;
}

function typeLabel(type: DecryptedTx["type"]): string {
  switch (type) {
    case "p2p_in":
      return "Recibido";
    case "p2p_out":
      return "Enviado";
    case "swap":
      return "Conversión";
    case "cashout":
      return "Retiro";
    case "card":
      return "Tarjeta";
    case "yield":
      return "Rendimiento";
    case "payroll":
      return "Pago recibido";
    case "credit":
      return "Crédito";
    case "qr_pay":
      return "Pago QR";
    case "unknown":
    default:
      return "Movimiento";
  }
}

function formatAmountForReceipt(amount: number, currency: string): string {
  if (currency === "BTC") return amount.toFixed(8);
  if (currency === "SOL" || currency === "ETH") {
    return amount < 1 ? amount.toFixed(4) : amount.toFixed(2);
  }
  if (currency === "COP" || currency === "ARS") {
    return amount.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Mínimo HTML escape para user-controlled strings. Sprint 8 puede
 * swap a una lib formal si agregamos templating runtime.
 */
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Silence Platform import — usado en algunos OEMs Android para verify
// que Sharing.isAvailableAsync funcione. Reservado para Sprint 8.
void Platform;
