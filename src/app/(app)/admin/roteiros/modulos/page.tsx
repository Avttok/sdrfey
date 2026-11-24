import { and, eq, isNull } from "drizzle-orm";
import { ArrowRight, Puzzle } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { db, scripts } from "@/db";
import { CATEGORY_LABEL, flowOf, MODULES, moduleOf } from "@/config/script-modules";
import { GOALS, type ScriptNode } from "@/config/scripts";
import { requireAdmin } from "@/modules/auth/guard";
import { loadRuns, statsOf } from "@/modules/scripts/learn-core";

export const dynamic = "force-dynamic";

/** Galeria de módulos (só Adm): a sequência de cada roteiro padrão e como cada módulo se sai nas ligações. */
export default async function Page() {
  await requireAdmin();
  const [runs, rows] = await Promise.all([loadRuns(), db.select({ goal: scripts.goal, nodes: scripts.nodes, startId: scripts.startId }).from(scripts).where(and(isNull(scripts.ownerId), eq(scripts.segment, "geral"), eq(scripts.active, true)))]);
  const st = statsOf(runs, null);
  const keys = new Set<string>(MODULES.filter((m) => m.suggest).map((m) => m.key));
  for (const r of rows) for (const n of r.nodes as ScriptNode[]) { const m = moduleOf(n.id); if (m?.category === "objecao") keys.add(m.key); }
  const list = [...keys].map((k) => { const m = MODULES.find((x) => x.key === k) ?? moduleOf(`obj_${k.slice(4)}`)!; const s = st[k]; return { key: k, title: m.title, category: m.category, uses: s?.uses ?? 0, wins: s?.wins ?? 0, stops: s?.stops ?? 0, taken: s?.taken ?? 0 }; }).sort((a, b) => b.uses - a.uses || a.title.localeCompare(b.title));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <div className="space-y-5">
      <PageHead icon={Puzzle} size="md" title="Galeria de módulos" />
      <p className="text-sm text-muted">Cada roteiro é uma sequência de módulos ligados. Durante a ligação o sistema sugere o módulo que mais encaixa, e os números abaixo vêm das ligações guardadas ({runs.length} analisadas). “Aceitas” são as sugestões que a pessoa escolheu.</p>
      <section className={`${panelCls} space-y-3 p-4`}>
        <h2 className="font-bold">Sequência dos roteiros padrão (tipo Geral)</h2>
        {rows.map((r) => { const f = flowOf(r.nodes as ScriptNode[], r.startId); return (
          <div key={r.goal}><p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{GOALS[r.goal as keyof typeof GOALS]?.label ?? r.goal}</p>
            <div className="flex flex-wrap items-center gap-1 text-sm">{f.modules.map((m, i) => <span key={m.key} className="inline-flex items-center gap-1"><span className="rounded-lg border border-line bg-sunk px-2 py-1 font-semibold" title={`${CATEGORY_LABEL[m.category]} · ${m.nodes} passos`}>{m.title}</span>{i < f.modules.length - 1 && <ArrowRight size={13} aria-hidden className="text-muted" />}</span>)}</div></div>
        ); })}
      </section>
      <section className={`${panelCls} overflow-x-auto p-4`}>
        <h2 className="mb-2 font-bold">Desempenho dos módulos</h2>
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1 pr-2">Módulo</th><th className="px-2">Tipo</th><th className="px-2 text-right">Ligações</th><th className="px-2 text-right">Terminaram bem</th><th className="px-2 text-right">Pararam</th><th className="pl-2 text-right">Aceitas</th></tr></thead>
          <tbody>{list.map((m) => <tr key={m.key} className="border-t border-line"><td className="py-1.5 pr-2 font-semibold">{m.title}</td><td className="px-2 text-muted">{CATEGORY_LABEL[m.category]}</td><td className="px-2 text-right">{m.uses}</td><td className="px-2 text-right">{pct(m.wins, m.uses)}</td><td className="px-2 text-right">{pct(m.stops, m.uses)}</td><td className="pl-2 text-right">{m.taken}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
