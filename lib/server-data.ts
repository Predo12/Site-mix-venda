import { env } from "cloudflare:workers";

import { DEFAULT_DELIVERY_ZONES, STORE, type DeliveryZone } from "@/lib/store-config";

export function getD1(): D1Database {
  if (!env.DB) throw new Error("Banco de dados indisponível.");
  return env.DB as D1Database;
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const db = getD1();
  const result = await db
    .prepare("SELECT neighborhood, fee_cents AS feeCents, active FROM delivery_zones ORDER BY fee_cents ASC")
    .all<{ neighborhood: string; feeCents: number; active: number }>();
  if (!result.results.length) return DEFAULT_DELIVERY_ZONES;
  return result.results.map((row) => ({ neighborhood: row.neighborhood, feeCents: row.feeCents, active: Boolean(row.active) }));
}

export async function getPublicConfig() {
  return {
    zones: await getDeliveryZones(),
    cardFeeCents: STORE.cardFeeCents,
    etaMin: STORE.etaMin,
    etaMax: STORE.etaMax,
    openingLabel: STORE.openingLabel,
    storeAddress: STORE.address,
    whatsappDigits: STORE.whatsappDigits,
  };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}
