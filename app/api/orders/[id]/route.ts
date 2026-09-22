import { requireApiRole } from "@/lib/admin-auth";
import { getD1, jsonError } from "@/lib/server-data";

const validStatuses = ["new", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireApiRole();
  if (!identity) return jsonError("Acesso restrito.", 403);
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !validStatuses.includes(body.status)) return jsonError("Status inválido.");
  const db = getD1();
  const current = await db.prepare("SELECT status FROM orders WHERE id = ?").bind(id).first<{ status: string }>();
  if (!current) return jsonError("Pedido não encontrado.", 404);
  const now = Date.now();
  await db.batch([
    db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").bind(body.status, now, id),
    db.prepare("INSERT INTO order_events (order_id, actor_email, action, from_status, to_status, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, identity.email, "status_changed", current.status, body.status, now),
  ]);
  return Response.json({ ok: true, status: body.status });
}
