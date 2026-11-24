"use client";

import { ArrowDownAZ, Clock3, LayoutGrid, List, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Segmented } from "@/components/filter-ui";
import { useBusyWhile } from "@/components/toast";

const nf = new Intl.NumberFormat("pt-BR");

/** Atalhos de situação, ordem e jeito de ver (cartões ou lista) da aba Leads. Tudo vai para o endereço, então dá para compartilhar o link. */
export function LeadToolbar({ total, counts }: { total: number; counts?: { all: number; free: number; busy: number; deals: number; prospect?: number; inativo?: number } }) {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const [pending, start] = useTransition(); useBusyWhile(pending);
  const set = (k: string, v: string) => { const p = new URLSearchParams(sp.toString()); v ? p.set(k, v) : p.delete(k); if (k !== "view") p.delete("page"); start(() => router.replace(`${path}?${p}`, { scroll: false })); };
  const tipo = sp.get("tipo") ?? "", show = sp.get("show") ?? "", sort = sp.get("sort") ?? "", view = sp.get("view") === "lista" ? "lista" : "cards";
  const presets = counts ? ([["", "Qualquer", counts.all], ["livres", "Livres", counts.free], ["atendimento", "Em atendimento", counts.busy], ["vendedores", "Em vendas", counts.deals]] as const) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {counts && counts.prospect !== undefined && <Segmented label="Tipo de lead" value={(tipo || "todos") as "todos" | "prospect" | "inativo"} onChange={(v) => set("tipo", v === "todos" ? "" : v)} options={[["todos", <Cnt key="a" l="Todos" n={counts.all} />], ["prospect", <Cnt key="p" l="Prospecção" n={counts.prospect} />], ["inativo", <Cnt key="i" l="Inativos" n={counts.inativo ?? 0} />]] as const} />}
      {presets && <Segmented label="Situação do lead" value={(show || "qualquer") as string} onChange={(v) => set("show", v === "qualquer" ? "" : v)} options={presets.map(([k, l, n]) => [k || "qualquer", <Cnt key={k} l={k ? l : "Qualquer situação"} n={n} />] as const)} />}
      <p className="ml-auto text-sm font-medium text-muted"><span className="figure text-ink">{nf.format(total)}</span> {total === 1 ? "resultado" : "resultados"}</p>
      <Segmented label="Ordenar" value={(sort || "recentes") as "recentes" | "nome" | "novos"} onChange={(v) => set("sort", v === "recentes" ? "" : v)} options={[["recentes", "Atividade", <Sparkles key="a" size={14} aria-hidden />], ["novos", "Novos", <Clock3 key="n" size={14} aria-hidden />], ["nome", "A–Z", <ArrowDownAZ key="z" size={14} aria-hidden />]] as const} />
      <Segmented label="Visão" value={view} onChange={(v) => set("view", v === "cards" ? "" : v)} options={[["cards", "Cartões", <LayoutGrid key="c" size={14} aria-hidden />], ["lista", "Lista", <List key="l" size={14} aria-hidden />]] as const} />
    </div>
  );
}

function Cnt({ l, n }: { l: string; n: number }) { return <>{l} <span className="figure text-xs opacity-70">{nf.format(n)}</span></>; }
