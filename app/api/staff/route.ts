import { requireApiRole, type StaffRole } from "@/lib/admin-auth";
import { cleanText, getD1, jsonError } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await requireApiRole(["admin"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const result = await getD1().prepare("SELECT id, email, name, role, active, created_at AS createdAt FROM staff ORDER BY active DESC, name ASC").all();
  return Response.json({ staff: result.results });
}

export async function POST(request: Request) {
  const identity = await requireApiRole(["admin"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const body = await request.json().catch(() => null) as { email?: string; name?: string; role?: StaffRole } | null;
  const email = cleanText(body?.email, 160).toLowerCase();
  const name = cleanText(body?.name, 80);
  const role = body?.role;
  if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2 || !role || !["admin", "service", "production"].includes(role)) return jsonError("Revise nome, e-mail e função.");
  try {
    await getD1().prepare("INSERT INTO staff (email, name, role, active, created_at) VALUES (?, ?, ?, 1, ?)").bind(email, name, role, Date.now()).run();
  } catch {
    return jsonError("Este e-mail já está cadastrado.", 409);
  }
  return Response.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const identity = await requireApiRole(["admin"]);
  if (!identity) return jsonError("Acesso restrito.", 403);
  const body = await request.json().catch(() => null) as { id?: number; active?: boolean; role?: StaffRole } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return jsonError("Funcionário inválido.");
  if (body?.role && !["admin", "service", "production"].includes(body.role)) return jsonError("Função inválida.");
  await getD1().prepare("UPDATE staff SET active = COALESCE(?, active), role = COALESCE(?, role) WHERE id = ?").bind(typeof body?.active === "boolean" ? (body.active ? 1 : 0) : null, body?.role ?? null, id).run();
  return Response.json({ ok: true });
}
