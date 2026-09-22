import { requireApiRole } from "@/lib/admin-auth";
import { cleanText, digits, getD1, jsonError } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: string; name?: string; phone?: string; token?: string; message?: string } | null;
  if (!body) return jsonError("Mensagem inválida.");
  const db = getD1();

  if (body.action === "start") {
    const name = cleanText(body.name, 80);
    const phone = digits(body.phone);
    const message = cleanText(body.message, 1200);
    if (name.length < 2 || phone.length < 10 || !message) return jsonError("Informe nome, WhatsApp e mensagem.");
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const now = Date.now();
    await db.batch([
      db.prepare("INSERT INTO conversations (id, access_token, customer_name, customer_phone, status, assigned_to, last_message_at, created_at) VALUES (?, ?, ?, ?, 'open', NULL, ?, ?)").bind(id, token, name, phone, now, now),
      db.prepare("INSERT INTO messages (conversation_id, sender_type, sender_name, body, created_at) VALUES (?, 'customer', ?, ?, ?)").bind(id, name, message, now),
    ]);
    return Response.json({ conversation: { id, token, customerName: name, customerPhone: phone, status: "open" } }, { status: 201 });
  }

  if (body.action === "message") {
    const token = cleanText(body.token, 80);
    const message = cleanText(body.message, 1200);
    if (!token || !message) return jsonError("Escreva uma mensagem.");
    const conversation = await db.prepare("SELECT id, customer_name AS customerName, status FROM conversations WHERE access_token = ?").bind(token).first<{ id: string; customerName: string; status: string }>();
    if (!conversation) return jsonError("Conversa não encontrada.", 404);
    const now = Date.now();
    await db.batch([
      db.prepare("INSERT INTO messages (conversation_id, sender_type, sender_name, body, created_at) VALUES (?, 'customer', ?, ?, ?)").bind(conversation.id, conversation.customerName, message, now),
      db.prepare("UPDATE conversations SET status = 'open', last_message_at = ? WHERE id = ?").bind(now, conversation.id),
    ]);
    return Response.json({ ok: true });
  }

  return jsonError("Ação inválida.");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = cleanText(url.searchParams.get("token"), 80);
  if (token) {
    const conversation = await getD1().prepare("SELECT id, customer_name AS customerName, customer_phone AS customerPhone, status, assigned_to AS assignedTo FROM conversations WHERE access_token = ?").bind(token).first<Record<string, unknown>>();
    if (!conversation) return jsonError("Conversa não encontrada.", 404);
    const result = await getD1().prepare("SELECT id, sender_type AS senderType, sender_name AS senderName, body, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 300").bind(conversation.id).all();
    return Response.json({ conversation, messages: result.results });
  }

  const identity = await requireApiRole(["admin", "service"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const result = await getD1().prepare(`SELECT c.id, c.customer_name AS customerName, c.customer_phone AS customerPhone,
    c.status, c.assigned_to AS assignedTo, c.last_message_at AS lastMessageAt, c.created_at AS createdAt,
    (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS lastMessage,
    (SELECT sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS lastSenderType
    FROM conversations c ORDER BY c.last_message_at DESC LIMIT 100`).all();
  return Response.json({ conversations: result.results, viewer: identity });
}
