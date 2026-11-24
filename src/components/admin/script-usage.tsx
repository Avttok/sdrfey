"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { panelCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { purgeTestRunsAction } from "@/modules/scripts/usage-actions";
import type { Usage, UsageRow } from "@/modules/scripts/usage";

const mmss = (s: number) => (s ? `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s` : "—");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function Table({ title, rows }: { title: string; rows: UsageRow[] }) {
  return (
    <section className={`${panelCls} overflow-x-auto p-4`}>
      <h2 className="mb-2 font-bold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Sem ligações neste filtro.</p> : (
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1 pr-2">Nome</th><th className="px-2 text-right">Ligações</th><th className="px-2 text-right">Concluídas</th><th className="px-2 text-right">Paradas</th><th className="px-2 text-right">Agendadas</th><th className="px-2 text-right">Cotação</th><th className="px-2 text-right">Vendas</th><th className="pl-2 text-right">Duração</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label} className="border-t border-line"><td className="py-1.5 pr-2 font-semibold">{r.label}</td><td className="px-2 text-right">{r.runs}</td><td className="px-2 text-right">{r.done} <span className="text-xs text-muted">{pct(r.done, r.runs)}</span></td><td className="px-2 text-right">{r.stopped}</td><td className="px-2 text-right">{r.scheduled}</td><td className="px-2 text-right">{r.quote}</td><td className="px-2 text-right">{r.converted}</td><td className="pl-2 text-right">{mmss(r.avgSec)}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}

/** Painel de uso dos roteiros (Adm): filtros, tabelas, objeções, onde param, baixar CSV e limpar testes. */
export function UsageView({ data, days, userId, withTests }: { data: Usage; days: number | null; userId: number | null; withTests: boolean }) {
  const router = useRouter(); const toast = useToast(); const [busy, setBusy] = useState(false);
  const go = (n: Partial<{ dias: number | null; user: number | null; testes: boolean }>) => {
    const d = "dias" in n ? n.dias : days; const u = "user" in n ? n.user : userId; const t = "testes" in n ? n.testes : withTests;
    const p = new URLSearchParams(); if (d) p.set("dias", String(d)); if (u) p.set("user", String(u)); if (t) p.set("testes", "1");
    router.push(`/admin/roteiros/uso${p.size ? `?${p}` : ""}`);
  };
  const csv = `/api/roteiros-uso?${new URLSearchParams({ ...(days ? { days: String(days) } : {}), ...(userId ? { user: String(userId) } : {}), ...(withTests ? { tests: "1" } : {}) })}`;
  async function purge() {
    if (!confirm(`Apagar ${data.tests} ligação(ões) de teste do histórico? As ligações de verdade não são tocadas.`)) return;
    setBusy(true); const r = await purgeTestRunsAction().catch(() => null); setBusy(false);
    if (r?.ok) { toast("ok", `${r.removed} ligação(ões) de teste apagada(s).`); router.refresh(); } else toast("bad", "Não consegui apagar.");
  }
  const sel = "rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold";
  const t = data.total;
  return (
    <div className="space-y-4">
      <section className={`${panelCls} flex flex-wrap items-center gap-2 p-3`}>
        <select aria-label="Período" className={sel} value={days ?? 0} onChange={(e) => go({ dias: Number(e.target.value) || null })}><option value={0}>Todo o período</option><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select>
        <select aria-label="Pessoa" className={sel} value={userId ?? 0} onChange={(e) => go({ user: Number(e.target.value) || null })}><option value={0}>Todas as pessoas</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={withTests} onChange={(e) => go({ testes: e.target.checked })} /> Incluir testes</label>
        <span className="flex-1" />
        <a href={csv} className={`${sel} inline-flex items-center gap-1.5 hover:border-accent/50`}><Download size={15} aria-hidden /> Baixar CSV</a>
        <button type="button" disabled={busy || data.tests === 0} onClick={() => void purge()} className={`${sel} inline-flex items-center gap-1.5 text-bad hover:border-bad/50 disabled:opacity-50`}><Trash2 size={15} aria-hidden /> Limpar testes ({data.tests})</button>
      </section>
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Ligações com roteiro", String(t.runs)], ["Concluídas", `${t.done} · ${pct(t.done, t.runs)}`], ["Paradas no meio", String(t.stopped)], ["Duração média", mmss(t.avgSec)]].map(([k, v]) => <div key={k} className={`${panelCls} p-3`}><p className="text-xs uppercase text-muted">{k}</p><p className="text-xl font-extrabold">{v}</p></div>)}
      </section>
      <Table title="Por objetivo" rows={data.byObjective} />
      <Table title="Por roteiro" rows={data.byScript} />
      <Table title="Por pessoa" rows={data.byUser} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${panelCls} p-4`}><h2 className="mb-2 font-bold">Objeções mais enfrentadas</h2>{data.objections.length === 0 ? <p className="text-sm text-muted">Nenhuma ainda.</p> : <ul className="space-y-1 text-sm">{data.objections.map((o) => <li key={o.title} className="flex justify-between gap-3"><span>{o.title}</span><b>{o.times}</b></li>)}</ul>}</section>
        <section className={`${panelCls} p-4`}><h2 className="mb-2 font-bold">Onde as ligações param</h2>{data.stops.length === 0 ? <p className="text-sm text-muted">Nenhuma ligação parada.</p> : <ul className="space-y-1 text-sm">{data.stops.map((o) => <li key={o.title} className="flex justify-between gap-3"><span>{o.title}</span><b>{o.times}</b></li>)}</ul>}</section>
      </div>
    </div>
  );
}
