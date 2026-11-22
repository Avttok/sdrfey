"use client";

import { ListFilter, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useBusyWhile } from "@/components/toast";
import { FilterBar } from "@/components/filter-bar";
import { FilterGroup, Pill } from "@/components/filter-ui";
import { inputCls } from "@/components/ui";

const KEYS = ["q", "uf", "team", "manager", "status", "sort"] as const;
const LABEL: Record<(typeof KEYS)[number], string> = { q: "Busca", uf: "Estado", team: "Equipe", manager: "Gestor", status: "Situação", sort: "Ordem" };
const SORT: Record<string, string> = { "visitas-desc": "Mais visitas primeiro", "visitas-asc": "Menos visitas primeiro" };

/** Busca e filtros de representantes (enviados ao servidor, então funcionam com milhares de linhas). */
export function RepFilters({ ufs, teams, managers }: { ufs: string[]; teams: string[]; managers: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    v ? p.set(k, v) : p.delete(k);
    p.delete("page");
    start(() => router.replace(`${path}?${p.toString()}`, { scroll: false }));
  };
  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q.trim()) set("q", q.trim()); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const on = KEYS.filter((k) => sp.get(k));
  const status = sp.get("status") ?? "";
  const select = (k: "uf" | "team" | "manager", label: string, all: string, opts: string[]) => (
    <label className="block text-xs text-muted">{label}<select className={`${inputCls} mt-1`} value={sp.get(k) ?? ""} onChange={(e) => set(k, e.target.value)}><option value="">{all}</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
  );
  const valueOf = (k: (typeof KEYS)[number]) => { const v = sp.get(k)!; return k === "status" ? (v === "ativo" ? "só ativos" : "só inativos") : k === "sort" ? SORT[v] ?? v : k === "q" ? `“${v}”` : v; };
  const chips = on.length ? (
    <>
      <span className="mr-1 flex items-center gap-1 text-xs font-medium text-muted"><ListFilter size={13} aria-hidden /> Ativos:</span>
      {on.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs ring-1 ring-line"><b className="font-medium">{LABEL[k]}:</b> {valueOf(k)}<button type="button" aria-label={`Remover filtro ${LABEL[k]}`} onClick={() => { if (k === "q") setQ(""); set(k, ""); }}><X size={13} /></button></span>)}
    </>
  ) : null;
  return (
    <FilterBar id="reps" active={on.length} chips={chips} onClear={() => { setQ(""); start(() => router.replace(path, { scroll: false })); }}
      search={<><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} !rounded-xl !py-3 pl-11`} placeholder="Buscar por nome, código SAP, cidade, gestor, equipe ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} /></>}>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        <FilterGroup title="Situação"><div className="flex flex-wrap gap-1.5">{([["", "Todos"], ["ativo", "Só ativos"], ["inativo", "Só inativos"]] as const).map(([k, l]) => <Pill key={k} on={status === k} onClick={() => set("status", k)}>{l}</Pill>)}</div></FilterGroup>
        <FilterGroup title="Ordenar por"><div className="flex flex-wrap gap-1.5">{([["", "A–Z"], ["visitas-desc", "Mais visitas"], ["visitas-asc", "Menos visitas"]] as const).map(([k, l]) => <Pill key={k} on={(sp.get("sort") ?? "") === k} onClick={() => set("sort", k)}>{l}</Pill>)}</div></FilterGroup>
        <FilterGroup title="Estado"><div>{select("uf", "Estado", "Todos os estados", ufs)}</div></FilterGroup>
        <FilterGroup title="Equipe e gestão" span="md:col-span-2"><div className="grid gap-2 sm:grid-cols-2">{select("team", "Equipe", "Todas as equipes", teams)}{select("manager", "Gestor", "Todos os gestores", managers)}</div></FilterGroup>
      </div>
    </FilterBar>
  );
}
