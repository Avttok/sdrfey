"use client";

import { Filter, FilterX, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DateInput } from "@/components/date-input";
import { TagChip } from "@/components/tag-chip";
import { inputCls, panelCls } from "@/components/ui";
import type { TagCatalog } from "@/modules/leads/view";

type Person = { id: number; name: string };

/** Filtros da aba Leads. O painel abre e fecha; os filtros ativos continuam visíveis como bolhas. */
export function LeadFilters({ catalog, people, ufs }: { catalog: TagCatalog; people: Person[]; ufs: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => { try { setOpen(localStorage.getItem("leadFiltersOpen") === "1"); } catch {} }, []);
  const toggleOpen = () => { setOpen(!open); try { localStorage.setItem("leadFiltersOpen", open ? "0" : "1"); } catch {} };

  const apply = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    p.delete("page");
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };
  const set = (k: string, v: string) => apply((p) => (v ? p.set(k, v) : p.delete(k)));
  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q.trim()) set("q", q.trim()); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selected = sp.getAll("tag");
  const toggleTag = (ref: string) => apply((p) => { const cur = p.getAll("tag"); p.delete("tag"); (cur.includes(ref) ? cur.filter((x) => x !== ref) : [...cur, ref]).forEach((x) => p.append("tag", x)); });
  const clearGroup = (g: string) => apply((p) => { const cur = p.getAll("tag").filter((x) => !x.startsWith(`${g}:`)); p.delete("tag"); cur.forEach((x) => p.append("tag", x)); });
  const clearAll = () => { setQ(""); router.replace(path, { scroll: false }); };

  const simple = ["owner", "uf", "city", "phone", "email", "status", "from", "to", "visit"].filter((k) => sp.get(k));
  const activeCount = selected.length + simple.length + (sp.get("q") ? 1 : 0);
  const labelOf = (ref: string) => { const [g, k] = ref.split(":"); return catalog.find((c) => c.key === g)?.tags.find((t) => t.key === k); };
  const filterGroups = catalog.filter((g) => ["temperatura", "meio", "qualificacao", "agenda", "situacao", "porte"].includes(g.key) && g.tags.length);

  const field = (label: string, node: React.ReactNode) => <label className="block text-sm"><span className="mb-1 block text-muted">{label}</span>{node}</label>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className={`${inputCls} pl-9`} placeholder="Buscar por empresa, CNPJ, telefone, e-mail ou pessoa" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" onClick={toggleOpen} aria-expanded={open} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-medium hover:bg-sunk">
          <Filter size={16} aria-hidden /> Filtros{activeCount ? <span className="figure rounded-full bg-accent px-1.5 text-xs text-on-accent">{activeCount}</span> : null}
        </button>
        {activeCount > 0 && <button type="button" onClick={clearAll} className="inline-flex items-center gap-2 rounded-lg border border-danger/50 px-3 py-2.5 text-sm font-medium text-danger hover:bg-sunk"><FilterX size={16} aria-hidden /> Limpar tudo</button>}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((ref) => { const t = labelOf(ref); return t ? <span key={ref} className="inline-flex items-center gap-1"><TagChip label={t.label} color={t.color} on /><button type="button" aria-label={`Remover filtro ${t.label}`} onClick={() => toggleTag(ref)}><X size={13} /></button></span> : null; })}
          {simple.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-md bg-sunk px-2 py-0.5 text-xs">{k}: {sp.get(k)}<button type="button" aria-label={`Remover filtro ${k}`} onClick={() => set(k, "")}><X size={13} /></button></span>)}
        </div>
      )}

      {open && (
        <div className={`${panelCls} space-y-4 p-4`}>
          {filterGroups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-3"><span className="text-sm font-medium">{g.name}</span><button type="button" className="text-xs text-accent underline" onClick={() => clearGroup(g.key)}>Limpar</button></div>
              <div className="flex flex-wrap gap-1.5">{g.tags.map((t) => <TagChip key={t.key} label={t.label} color={t.color} on={selected.includes(`${g.key}:${t.key}`)} onClick={() => toggleTag(`${g.key}:${t.key}`)} />)}</div>
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {field("Responsável", <select className={inputCls} value={sp.get("owner") ?? ""} onChange={(e) => set("owner", e.target.value)}><option value="">Todos</option><option value="-">Sem responsável</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
            {field("Estado", <select className={inputCls} value={sp.get("uf") ?? ""} onChange={(e) => set("uf", e.target.value)}><option value="">Todos</option>{ufs.map((u) => <option key={u}>{u}</option>)}</select>)}
            {field("Cidade", <input className={inputCls} defaultValue={sp.get("city") ?? ""} onBlur={(e) => set("city", e.target.value.trim())} />)}
            {field("Situação cadastral", <select className={inputCls} value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">Todas</option>{["ATIVA", "BAIXADA", "INAPTA", "SUSPENSA", "NULA"].map((s) => <option key={s}>{s}</option>)}</select>)}
            {field("Telefone", <select className={inputCls} value={sp.get("phone") ?? ""} onChange={(e) => set("phone", e.target.value)}><option value="">Todos</option><option value="1">Tem telefone</option><option value="0">Sem telefone</option></select>)}
            {field("E-mail", <select className={inputCls} value={sp.get("email") ?? ""} onChange={(e) => set("email", e.target.value)}><option value="">Todos</option><option value="1">Tem e-mail</option><option value="0">Sem e-mail</option></select>)}
            {field("Alterado de", <DateInput label="Alterado de" value={sp.get("from") ?? ""} onChange={(v) => set("from", v)} />)}
            {field("Alterado até", <DateInput label="Alterado até" value={sp.get("to") ?? ""} onChange={(v) => set("to", v)} />)}
            {field("Código da visita", <input className={inputCls} defaultValue={sp.get("visit") ?? ""} onBlur={(e) => set("visit", e.target.value.trim())} />)}
          </div>
        </div>
      )}
    </div>
  );
}
