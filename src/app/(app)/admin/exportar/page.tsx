import type { Metadata } from "next";
import { Database, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { requireAdmin } from "@/modules/auth/guard";
import { EXPORT_KINDS, type ExportKind } from "@/modules/export/build";

export const metadata: Metadata = { title: "Exportar" };

export default async function Page() {
  await requireAdmin();
  const entries = Object.entries(EXPORT_KINDS) as [ExportKind, (typeof EXPORT_KINDS)[ExportKind]][];
  return (
    <div className="space-y-5">
      <PageHead icon={Download} size="md" title="Exportar / backup" />
      <section className={`${panelCls} flex flex-wrap items-center gap-4 border-accent/40 bg-accent/5 p-5`}>
        <span className="grid size-12 place-items-center rounded-xl bg-grad text-on-accent"><Database size={22} aria-hidden /></span>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">{EXPORT_KINDS.backup.label}</h2><p className="text-sm text-muted">{EXPORT_KINDS.backup.hint}</p></div>
        <a href="/admin/exportar/backup" download className={btnPrimary}><Download size={16} aria-hidden /> Baixar backup</a>
      </section>
      <ul className="grid gap-3 sm:grid-cols-2">
        {entries.filter(([k]) => k !== "backup").map(([k, v]) => (
          <li key={k} className={`${panelCls} flex items-start gap-3 p-4`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunk text-muted">{v.file.endsWith("json") ? <FileJson size={18} aria-hidden /> : <FileSpreadsheet size={18} aria-hidden />}</span>
            <div className="min-w-0 flex-1"><h2 className="font-semibold">{v.label}</h2><p className="text-sm text-muted">{v.hint}</p></div>
            <a href={`/admin/exportar/${k}`} download className={btnGhost}><Download size={15} aria-hidden /> CSV</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
