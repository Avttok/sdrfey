import { FilterBar } from "@/components/filter-bar";
import { plural } from "@/lib/format";
import { Pagination } from "@/components/pagination";
import { CircleDollarSign, FileText, History, PhoneCall, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { DateField } from "@/components/date-field";
import { PageHead } from "@/components/page-head";
import { glass } from "@/components/theme-kit";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtBRL, STAGE_META } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { sellerHistory, type SellerHistFilters } from "@/modules/deals/queries";
import { StageChip } from "./deal-ui";

export async function SellerHistory({ userId, sp }: { userId: number; sp: Record<string, string | string[] | undefined> }) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() || undefined : undefined);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  const stage = one("etapa") as DealStage | undefined;
  const f: SellerHistFilters = { q: one("q"), stage: stage && stage in STAGE_META ? stage : undefined, from: date("from"), to: date("to") };
  const rows = await sellerHistory(userId, f);
  const PAGE = 30;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pg = Math.min(pages, Math.max(1, Number(one("p")) || 1));
  const pageHref = (n: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "p") u.set(k, v); if (n > 1) u.set("p", String(n)); return `/historico${u.size ? `?${u}` : ""}`; };
  const won = rows.filter((r) => r.stage === "ganho");
  const total = won.reduce((a, r) => a + (r.valueCents ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHead icon={History} title="Meu histórico" subtitle="Suas negociações, vendas e contatos" hex="#f97316" stats={[
        { icon: History, label: "Negociações", value: rows.length, hex: "#f97316" },
        { icon: Trophy, label: "Vendas fechadas", value: won.length, hint: fmtBRL(total), hex: "#10b981" },
        { icon: PhoneCall, label: "Contatos feitos", value: rows.reduce((a, r) => a + r.contacts, 0), hex: "#3b82f6" },
        { icon: FileText, label: "Cotações enviadas", value: rows.reduce((a, r) => a + r.quotes, 0), hex: "#8b5cf6" },
      ]} />
      <FilterBar id="historico-vendas" active={[f.q, f.stage, f.from, f.to].filter(Boolean).length}>
      <form className="flex flex-wrap items-end gap-3" action="/historico-vendas">
        <label className="block min-w-48 flex-1 text-sm"><span className="mb-1 block text-muted">Buscar cliente</span><input name="q" defaultValue={f.q} className={inputCls} placeholder="Nome da empresa" /></label>
        <label className="block w-44 text-sm"><span className="mb-1 block text-muted">Etapa</span>
          <select name="etapa" defaultValue={f.stage ?? ""} className={inputCls}><option value="">Todas</option>{(Object.keys(STAGE_META) as DealStage[]).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}</select></label>
        <div className="w-40 text-sm"><span className="mb-1 block text-muted">De</span><DateField name="from" label="De" defaultValue={f.from} /></div>
        <div className="w-40 text-sm"><span className="mb-1 block text-muted">Até</span><DateField name="to" label="Até" defaultValue={f.to} /></div>
        <button className={btnPrimary}><Search size={16} aria-hidden /> Filtrar</button>
        <Link prefetch={false} href="/historico-vendas" className={`${btnGhost} !py-3`}>Limpar</Link>
      </form>
      </FilterBar>
      <ul className="space-y-2.5">
        {rows.slice((pg - 1) * PAGE, pg * PAGE).map((r, idx) => (
          <li key={r.id}>
            <Link prefetch={false} href={`/negociacoes/${r.id}`} className="lift card-in group relative flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-2xl border-[1.5px] p-4 pl-6" style={{ ...glass(STAGE_META[r.stage].color, 10, 2), "--i": Math.min(idx, 10) } as React.CSSProperties}>
              <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: STAGE_META[r.stage].color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold group-hover:text-accent">{r.company}</span>
                <span className="block text-xs text-muted">{r.city ? `${r.city}/${r.uf} · ` : ""}recebida em {fmtDate(r.createdAt)} · {plural(r.contacts, "contato", "contatos")} · {plural(r.quotes, "cotação", "cotações")}{r.stage === "perdido" && r.lostReason ? ` · ${r.lostReason}` : ""}</span>
              </span>
              {r.valueCents ? <b className="figure inline-flex items-center gap-1 rounded-full bg-grad-soft px-2.5 py-0.5 text-sm text-accent"><CircleDollarSign size={14} aria-hidden />{fmtBRL(r.valueCents)}</b> : null}
              <StageChip stage={r.stage} />
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className={`${panelCls} p-10 text-center text-sm text-muted`}>Nenhuma negociação com esses filtros.</li>}
      </ul>
      <Pagination page={pg} pages={pages} href={pageHref} />
    </div>
  );
}
