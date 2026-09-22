import { getChatGPTUser, requireChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/lib/server-data";

export type StaffRole = "admin" | "service" | "production";
export type AdminIdentity = ChatGPTUser & { role: StaffRole };

const BOOTSTRAP_ADMINS = new Set([
  "gotreks12@gmail.com",
  "pmartinssantos12@gmail.com",
]);

async function roleForEmail(email: string): Promise<StaffRole | null> {
  const normalized = email.trim().toLowerCase();
  if (BOOTSTRAP_ADMINS.has(normalized)) return "admin";
  try {
    const row = await getD1()
      .prepare("SELECT role, active FROM staff WHERE lower(email) = ? LIMIT 1")
      .bind(normalized)
      .first<{ role: StaffRole; active: number }>();
    return row?.active ? row.role : null;
  } catch {
    return null;
  }
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  const role = await roleForEmail(user.email);
  return role ? { ...user, role } : null;
}

export async function requireAdminPage(returnTo = "/admin") {
  const user = await requireChatGPTUser(returnTo);
  const role = await roleForEmail(user.email);
  return { user, role };
}

export async function requireApiRole(allowed: StaffRole[] = ["admin", "service", "production"]) {
  const identity = await getAdminIdentity();
  if (!identity || !allowed.includes(identity.role)) return null;
  return identity;
}
