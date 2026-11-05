import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/modules/auth/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-3xl">Administração</h1>
        <p className="mt-1 text-sm text-muted">Tudo o que só o Adm controla, em um lugar.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <AdminNav />
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  );
}
