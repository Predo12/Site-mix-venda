import { requireApiRole } from "@/lib/admin-auth";
import { getDeliveryZones, getD1, getPublicConfig, jsonError } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getPublicConfig());
  } catch {
    return jsonError("Não foi possível carregar as opções de entrega.", 503);
  }
}

export async function PUT(request: Request) {
  const identity = await requireApiRole(["admin"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const body = await request.json().catch(() => null) as { zones?: Array<{ neighborhood?: string; feeCents?: number; active?: boolean }> } | null;
  if (!body?.zones || !Array.isArray(body.zones) || body.zones.length > 80) return jsonError("Lista de bairros inválida.");

  const zones = body.zones.map((zone) => ({
    neighborhood: String(zone.neighborhood ?? "").trim().slice(0, 80),
    feeCents: Number(zone.feeCents),
    active: zone.active !== false,
  }));
  if (zones.some((zone) => !zone.neighborhood || !Number.isInteger(zone.feeCents) || zone.feeCents < 0 || zone.feeCents > 50000)) return jsonError("Revise os bairros e valores informados.");

  const now = Date.now();
  const db = getD1();
  const statements = [db.prepare("DELETE FROM delivery_zones")];
  for (const zone of zones) {
    statements.push(db.prepare("INSERT INTO delivery_zones (neighborhood, fee_cents, active, updated_at) VALUES (?, ?, ?, ?)").bind(zone.neighborhood, zone.feeCents, zone.active ? 1 : 0, now));
  }
  await db.batch(statements);
  return Response.json({ zones: await getDeliveryZones() });
}
