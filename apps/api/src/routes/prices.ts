import { zValidator } from "@hono/zod-validator";
import { AssetIdSchema, type AssetId } from "@moneto/types";
import { createLogger } from "@moneto/utils";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import {
  createPriceService,
  type PriceHistoryRange,
  type PriceMeta,
  type PriceServiceEnv,
} from "../services/price-service";

const log = createLogger("api.prices");

/**
 * `/api/prices/*` — endpoints públicos (autenticados via authMiddleware
 * que aplica a `/api/*`) que exponen los spot prices del backend.
 *
 * **Por qué auth required**: aunque los Pyth prices son públicos, no
 * queremos que cualquier internet user pegue al backend (rate limit
 * abuse). Y la respuesta puede llevar `isStale` que el rate limiting
 * por user gates de forma natural.
 *
 * Endpoints:
 * - `GET  /api/prices/:assetId`  → single asset
 * - `POST /api/prices`           → batch { assets: AssetId[] }
 */

type Bindings = PriceServiceEnv;
type Variables = { userId: string };

const prices = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Single asset ────────────────────────────────────────────────────

prices.get("/:assetId", async (c) => {
  const rawId = c.req.param("assetId");
  const parsed = AssetIdSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new HTTPException(400, { message: "invalid_asset_id" });
  }
  const assetId: AssetId = parsed.data;

  const service = createPriceService(c.env);
  const meta = await service.getPriceWithMeta(assetId);
  if (!meta) {
    log.warn("price unavailable", { assetId });
    throw new HTTPException(503, { message: "price_unavailable" });
  }

  return c.json(serializeMeta(assetId, meta));
});

// ─── Batch ───────────────────────────────────────────────────────────

const BatchSchema = z.object({
  // Limit razonable — 9 assets total en el registry, batch hasta 20
  // protege contra abuse.
  assets: z.array(AssetIdSchema).min(1).max(20),
});

prices.post("/", zValidator("json", BatchSchema), async (c) => {
  const { assets } = c.req.valid("json");
  const service = createPriceService(c.env);

  // Paralelizamos los fetches — Pyth Hermes acepta concurrent requests;
  // total latency = max(individual), no sum.
  const settled = await Promise.allSettled(
    assets.map(async (id) => {
      const meta = await service.getPriceWithMeta(id);
      return { id, meta };
    }),
  );

  const result: Record<string, ReturnType<typeof serializeMeta>> = {};
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.meta) {
      result[r.value.id] = serializeMeta(r.value.id, r.value.meta);
    }
    // Failed/null meta: omit del response. El mobile chequea presence
    // del key vs hardcode default.
  }

  return c.json(result);
});

// ─── History ─────────────────────────────────────────────────────────

const RANGE_VALUES = [
  "1H",
  "1D",
  "7D",
  "30D",
  "1Y",
  "ALL",
] as const satisfies readonly PriceHistoryRange[];
const HistoryQuerySchema = z.object({
  range: z.enum(RANGE_VALUES).default("7D"),
});

prices.get("/:assetId/history", zValidator("query", HistoryQuerySchema), async (c) => {
  const rawId = c.req.param("assetId");
  const parsed = AssetIdSchema.safeParse(rawId);
  if (!parsed.success) {
    throw new HTTPException(400, { message: "invalid_asset_id" });
  }
  const assetId: AssetId = parsed.data;
  const { range } = c.req.valid("query");

  const service = createPriceService(c.env);
  const history = await service.getPriceHistory(assetId, range);

  if (!history) {
    // Stable o asset sin source: 204 No Content sería semantic, pero
    // mobile React Query maneja 200 + null más fácil. Devolvemos
    // estructura vacía con `points: []` para que el chart muestre
    // empty state.
    return c.json({
      assetId,
      range,
      points: [],
      source: null,
      fetchedAt: Date.now(),
    });
  }

  return c.json({
    assetId,
    range: history.range,
    points: history.points,
    source: history.source,
    fetchedAt: history.fetchedAt,
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────

function serializeMeta(assetId: AssetId, meta: PriceMeta) {
  return {
    assetId,
    price: meta.price,
    confidence: meta.confidence,
    publishTime: meta.publishTime,
    isStale: meta.isStale,
    source: meta.source,
  };
}

export default prices;
