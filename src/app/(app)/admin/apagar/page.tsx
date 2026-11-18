import { Eraser, Layers, Search, Users } from "lucide-react";
import Link from "next/link";
import { PurgeCategories } from "@/components/admin/purge-categories";
import { LeadRecordsView, LeadSearch } from "@/components/admin/purge-records";
import { PurgeUsers } from "@/components/admin/purge-users";
import { PageHead } from "@/components/page-head";
import { categoryCounts, leadRecords, searchLeadsForPurge, userPurgeRows } from "@/modules/admin/purge-data";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "categoria", label: "Por categoria", icon: Layers },
  { key: "usuario", label: "Por usuário", icon: Users },
  { key: "registro", label: "Registro a registro", icon: Search },
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; lead?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "categoria";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const leadId = Number(sp.lead);
  return (
    <div className="space-y-5">
      <PageHead icon={Eraser} size="md" title="Apagar" subtitle="Central de exclusão: por categoria, por pessoa ou registro a registro. Cada exclusão fica no Registro." />
      <nav aria-label="Tipo de exclusão" className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link key={key} href={`/admin/apagar?tab=${key}`} aria-current={tab === key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${tab === key ? "border-transparent bg-grad text-on-accent shadow-sm" : "border-line hover:bg-sunk"}`}>
            <Icon size={15} aria-hidden /> {label}
          </Link>
        ))}
      </nav>
      {tab === "categoria" && <PurgeCategories counts={await categoryCounts()} />}
      {tab === "usuario" && <PurgeUsers rows={await userPurgeRows()} />}
      {tab === "registro" && (Number.isInteger(leadId) && leadId > 0 ? await (async () => {
        const data = await leadRecords(leadId);
        return data ? <LeadRecordsView data={data} q={q} /> : <LeadSearch q={q} hits={await searchLeadsForPurge(q)} />;
      })() : <LeadSearch q={q} hits={await searchLeadsForPurge(q)} />)}
    </div>
  );
}
