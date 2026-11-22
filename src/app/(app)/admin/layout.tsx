import { ShieldCheck } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/modules/auth/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div className="fx-rise relative overflow-hidden rounded-3xl bg-grad px-5 py-4 text-on-accent shadow-lg sm:px-7">
        <span aria-hidden className="sh-card absolute -right-10 -top-14 size-48 rounded-full bg-white/20 blur-2xl" />
        <span aria-hidden className="sh-card absolute -bottom-16 left-1/3 size-40 rounded-full bg-black/15 blur-2xl" style={{ "--d": "-2s" } as React.CSSProperties} />
        <div className="relative flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-white/20 backdrop-blur"><ShieldCheck size={22} aria-hidden /></span><div><p className="display text-xl leading-tight sm:text-2xl">Administração</p><p className="text-xs opacity-85 sm:text-sm">Só o Adm vê esta área. Tudo o que muda aqui vale para a equipe inteira.</p></div></div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <AdminNav />
        <div className="admin-content min-w-0">{children}</div>
      </div>
    </div>
  );
}
