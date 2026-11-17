"use client";

import { Building2, ChevronDown, FilterX, ListFilter, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DateInput } from "@/components/date-input";
import { TagChip } from "@/components/tag-chip";
import { useBusyWhile } from "@/components/toast";
import { inputCls } from "@/components/ui";
import type { TagCatalog } from "@/modules/leads/view";

type Person = { id: number; name: string };

const LABEL: Record<string, string> = { owner: "Responsável", uf: "Estado", city: "Cidade", phone: "Telefone", email: "E-mail", status: "Situação cadastral", from: "Alterado de", to: "Alterado até", visit: "Visita" };

/** Filtros da aba Leads: busca grande, filtros em seções e as escolhas ativas como bolhas removíveis. */
export function LeadFilters({ catalog, people, ufs, sellerView }: { sellerView?: boolean; catalog: TagCatalog; people: Person[]; ufs: string[] }) {
  const router0 = useRouter();
  const [navPending, startNav] = useTransition();
  useBusyWhile(navPending);
  const router = { replace: (url: string, o?: { scroll?: boolean }) => startNav(() => router0.replace(url, o)) };
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

  const simple = Object.keys(LABEL).filter((k) => sp.get(k));
  const activeCount = selected.length + simple.length + (sp.get("q") ? 1 : 0);
  const labelOf = (ref: string) => { const [g, k] = ref.split(":"); return catalog.find((c) => c.key === g)?.tags.find((t) => t.key === k); };
  const valueOf = (k: string) => { const v = sp.get(k)!; if (k === "owner") return v === "-" ? "Sem responsável" : people.find((p) => String(p.id) === v)?.name ?? v; if (k === "phone" || k === "email") return v === "1" ? "Tem" : "Não tem"; if (k === "from" || k === "to") return `${v.slice(8)}/${v.slice(5, 7)}/${v.slice(0, 4)}`; return v; };
  const filterGroups = catalog.filter((g) => ["temperatura", "meio", "qualificacao", "agenda", "situacao", "porte"].includes(g.key) && g.tags.length);

  const field = (label: string, node: React.ReactNode) => <label className="block text-sm"><span className="mb-1 block text-xs font-medium text-muted">{label}</span>{node}</label>;
  const Section = ({ icon: I, title, children }: { icon: typeof Tag; title: string; children: React.ReactNode }) => (
    <section className="space-y-3"><h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><I size={14} aria-hidden /> {title}</h3>{children}</section>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-60 flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input className={`${inputCls} !rounded-xl !py-3 pl-11`} placeholder="Buscar por empresa, CNPJ, telefone, e-mail ou pessoa" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" onClick={toggleOpen} aria-expanded={open} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${open ? "border-accent bg-accent/10 text-accent" : "border-line hover:bg-sunk"}`}>
          <SlidersHorizontal size={16} aria-hidden /> Filtros{activeCount ? <span className="figure rounded-full bg-accent px-1.5 text-xs text-on-accent">{activeCount}</span> : null}
          <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {activeCount > 0 && <button type="button" onClick={clearAll} className="inline-flex items-center gap-2 rounded-xl border border-danger/50 px-4 py-3 text-sm font-medium text-danger hover:bg-sunk"><FilterX size={16} aria-hidden /> Limpar</button>}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-sunk/40 px-3 py-2.5">
          <span className="mr-1 flex items-center gap-1 text-xs font-medium text-muted"><ListFilter size={13} aria-hidden /> Ativos:</span>
          {sp.get("q") && <span className="inline-flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs ring-1 ring-line">“{sp.get("q")}”<button type="button" aria-label="Remover busca" onClick={() => { setQ(""); set("q", ""); }}><X size={13} /></button></span>}
          {selected.map((ref) => { const t = labelOf(ref); return t ? <span key={ref} className="inline-flex items-center gap-1"><TagChip label={t.label} color={t.color} on /><button type="button" aria-label={`Remover filtro ${t.label}`} onClick={() => toggleTag(ref)}><X size={13} /></button></span> : null; })}
          {simple.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs ring-1 ring-line"><b className="font-medium">{LABEL[k]}:</b> {valueOf(k)}<button type="button" aria-label={`Remover filtro ${LABEL[k]}`} onClick={() => set(k, "")}><X size={13} /></button></span>)}
        </div>
      )}

      {open && (
        <div className="space-y-6 border-t border-line p-4 sm:p-5">
          <Section icon={Tag} title="Tags">
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {filterGroups.map((g) => (
                <div key={g.key}>
                  <div className="mb-1.5 flex items-center gap-3"><span className="text-sm font-medium">{g.name}</span>{selected.some((x) => x.startsWith(`${g.key}:`)) && <button type="button" className="text-xs text-accent underline" onClick={() => clearGroup(g.key)}>Limpar</button>}</div>
                  <div className="flex flex-wrap gap-1.5">{g.tags.map((t) => <TagChip key={t.key} label={t.label} color={t.color} on={selected.includes(`${g.key}:${t.key}`)} onClick={() => toggleTag(`${g.key}:${t.key}`)} />)}</div>
                </div>
              ))}
            </div>
          </Section>
          <Section icon={Building2} title="Empresa e contato">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {!sellerView && field("Responsável", <select className={inputCls} value={sp.get("owner") ?? ""} onChange={(e) => set("owner", e.target.value)}><option value="">Todos</option><option value="-">Sem responsável</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
              {field("Estado", <select className={inputCls} value={sp.get("uf") ?? ""} onChange={(e) => set("uf", e.target.value)}><option value="">Todos</option>{ufs.map((u) => <option key={u}>{u}</option>)}</select>)}
              {field("Cidade", <input className={inputCls} defaultValue={sp.get("city") ?? ""} onBlur={(e) => set("city", e.target.value.trim())} />)}
              {field("Situação cadastral", <select className={inputCls} value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}><option value="">Todas</option>{["ATIVA", "BAIXADA", "INAPTA", "SUSPENSA", "NULA"].map((s) => <option key={s}>{s}</option>)}</select>)}
              {field("Telefone", <select className={inputCls} value={sp.get("phone") ?? ""} onChange={(e) => set("phone", e.target.value)}><option value="">Todos</option><option value="1">Tem telefone</option><option value="0">Sem telefone</option></select>)}
              {field("E-mail", <select className={inputCls} value={sp.get("email") ?? ""} onChange={(e) => set("email", e.target.value)}><option value="">Todos</option><option value="1">Tem e-mail</option><option value="0">Sem e-mail</option></select>)}
              {field("Alterado de", <DateInput label="Alterado de" value={sp.get("from") ?? ""} onChange={(v) => set("from", v)} />)}
              {field("Alterado até", <DateInput label="Alterado até" value={sp.get("to") ?? ""} onChange={(v) => set("to", v)} />)}
              {field("Código da visita", <input className={inputCls} placeholder="V-12345" defaultValue={sp.get("visit") ?? ""} onBlur={(e) => set("visit", e.target.value.trim())} />)}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
