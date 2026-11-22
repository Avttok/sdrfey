"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useBusyWhile } from "@/components/toast";
import { FilterBar } from "@/components/filter-bar";
import { inputCls } from "@/components/ui";

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
  const active = ["q", "uf", "team", "manager", "status", "sort"].some((k) => sp.get(k));
  const select = (k: string, label: string, opts: string[]) => (
    <select aria-label={label} className={`${inputCls} !w-auto min-w-40`} value={sp.get(k) ?? ""} onChange={(e) => set(k, e.target.value)}>
      <option value="">{label}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  const count = ["q", "uf", "team", "manager", "status", "sort"].filter((k) => sp.get(k)).length;
  return (
    <FilterBar id="reps" active={count} onClear={() => { setQ(""); start(() => router.replace(path, { scroll: false })); }}
      search={<><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} pl-9`} placeholder="Buscar por nome, código SAP, cidade, gestor, equipe ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} /></>}>
      <div className="flex flex-wrap items-center gap-2">
        {select("uf", "Todos os estados", ufs)}
        {select("team", "Todas as equipes", teams)}
        {select("manager", "Todos os gestores", managers)}
        <select aria-label="Situação" className={`${inputCls} !w-auto`} value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">Ativos e inativos</option><option value="ativo">Só ativos</option><option value="inativo">Só inativos</option>
        </select>
        <select aria-label="Ordenar" className={`${inputCls} !w-auto`} value={sp.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)}>
          <option value="">Ordem alfabética</option><option value="visitas-desc">Mais visitas primeiro</option><option value="visitas-asc">Menos visitas primeiro</option>
        </select>
      </div>
    </FilterBar>
  );
}
