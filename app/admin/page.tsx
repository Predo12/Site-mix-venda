import { LockKeyhole } from "lucide-react";

import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { AdminDashboard } from "@/app/admin/admin-dashboard";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, role } = await requireAdminPage("/admin");
  if (!role) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#171312] p-6 text-white">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a1222b]"><LockKeyhole /></span>
          <h1 className="mt-5 text-2xl font-bold">Acesso não autorizado</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">O e-mail <strong className="text-white">{user.email}</strong> ainda não está cadastrado na equipe da Mixology.</p>
          <a href={chatGPTSignOutPath("/admin")} className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">Entrar com outra conta</a>
        </section>
      </main>
    );
  }
  return <AdminDashboard viewer={{ name: user.displayName, email: user.email, role }} signOutHref={chatGPTSignOutPath("/")} />;
}
