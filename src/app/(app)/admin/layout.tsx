import { ShieldCheck } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/modules/auth/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><ShieldCheck size={14} aria-hidden /> Administração · só o Adm vê esta área</p>
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
