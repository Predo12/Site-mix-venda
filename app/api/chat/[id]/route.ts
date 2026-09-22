import { requireApiRole } from "@/lib/admin-auth";
import { cleanText, getD1, jsonError } from "@/lib/server-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireApiRole(["admin", "service"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const { id } = await params;
  const db = getD1();
  const conversation = await db.prepare("SELECT id, customer_name AS customerName, customer_phone AS customerPhone, status, assigned_to AS assignedTo, last_message_at AS lastMessageAt FROM conversations WHERE id = ?").bind(id).first();
  if (!conversation) return jsonError("Conversa não encontrada.", 404);
  const messages = await db.prepare("SELECT id, sender_type AS senderType, sender_name AS senderName, body, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 300").bind(id).all();
  return Response.json({ conversation, messages: messages.results });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireApiRole(["admin", "service"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const { id } = await params;
  const body = await request.json().catch(() => null) as { message?: string; action?: string } | null;
  const db = getD1();

  if (body?.action === "close" || body?.action === "reopen") {
    const status = body.action === "close" ? "closed" : "open";
    await db.prepare("UPDATE conversations SET status = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?").bind(status, identity.email, id).run();
    return Response.json({ ok: true, status });
  }

  const message = cleanText(body?.message, 1200);
  if (!message) return jsonError("Escreva uma resposta.");
  const now = Date.now();
  const result = await db.batch([
    db.prepare("INSERT INTO messages (conversation_id, sender_type, sender_name, body, created_at) SELECT id, 'staff', ?, ?, ? FROM conversations WHERE id = ?").bind(identity.displayName, message, now, id),
    db.prepare("UPDATE conversations SET assigned_to = ?, status = 'open', last_message_at = ? WHERE id = ?").bind(identity.email, now, id),
  ]);
  if (!result[0].meta.changes) return jsonError("Conversa não encontrada.", 404);
  return Response.json({ ok: true });
}
