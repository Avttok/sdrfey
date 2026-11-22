"use client";

import { Building2, ListFilter, Search, Tag, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DateInput } from "@/components/date-input";
import { TagChip } from "@/components/tag-chip";
import { useBusyWhile } from "@/components/toast";
import { FilterBar } from "@/components/filter-bar";
import { FilterGroup, Pill, Tri3, type Tri } from "@/components/filter-ui";
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
  const [q, setQ] = useState(sp.get("q") ?? "");

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

  const chips = activeCount > 0 ? (
    <>
      <span className="mr-1 flex items-center gap-1 text-xs font-medium text-muted"><ListFilter size={13} aria-hidden /> Ativos:</span>
      {sp.get("q") && <span className="inline-flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs ring-1 ring-line">“{sp.get("q")}”<button type="button" aria-label="Remover busca" onClick={() => { setQ(""); set("q", ""); }}><X size={13} /></button></span>}
      {selected.map((ref) => { const t = labelOf(ref); return t ? <span key={ref} className="inline-flex items-center gap-1"><TagChip label={t.label} color={t.color} on /><button type="button" aria-label={`Remover filtro ${t.label}`} onClick={() => toggleTag(ref)}><X size={13} /></button></span> : null; })}
      {simple.map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs ring-1 ring-line"><b className="font-medium">{LABEL[k]}:</b> {valueOf(k)}<button type="button" aria-label={`Remover filtro ${LABEL[k]}`} onClick={() => set(k, "")}><X size={13} /></button></span>)}
    </>
  ) : null;
  return (
    <FilterBar id="leads" active={activeCount} onClear={clearAll} chips={chips}
      search={<><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} !rounded-xl !py-3 pl-11`} placeholder="Buscar por empresa, CNPJ, telefone, e-mail ou pessoa" value={q} onChange={(e) => setQ(e.target.value)} /></>}>
      <div className="space-y-6">
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
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              <FilterGroup title="Situação cadastral" span="md:col-span-2 xl:col-span-2"><div className="flex flex-wrap gap-1.5">{["", "ATIVA", "BAIXADA", "INAPTA", "SUSPENSA", "NULA"].map((st) => <Pill key={st} on={(sp.get("status") ?? "") === st} onClick={() => set("status", st)}>{st ? st[0] + st.slice(1).toLowerCase() : "Todas"}</Pill>)}</div></FilterGroup>
              {!sellerView && <FilterGroup title="Responsável"><select aria-label="Responsável" className={inputCls} value={sp.get("owner") ?? ""} onChange={(e) => set("owner", e.target.value)}><option value="">Todos</option><option value="-">Sem responsável</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FilterGroup>}
              <FilterGroup title="Onde fica"><div className="grid gap-2 sm:grid-cols-[7rem_1fr]">{field("Estado", <select className={inputCls} value={sp.get("uf") ?? ""} onChange={(e) => set("uf", e.target.value)}><option value="">Todos</option>{ufs.map((u) => <option key={u}>{u}</option>)}</select>)}{field("Cidade", <input className={inputCls} placeholder="Parte do nome" defaultValue={sp.get("city") ?? ""} onBlur={(e) => set("city", e.target.value.trim())} />)}</div></FilterGroup>
              <FilterGroup title="Contatos" span="md:col-span-2 xl:col-span-1"><div className="space-y-2">
                <Tri3 label="Telefone" v={({ "1": "sim", "0": "nao" } as Record<string, Tri>)[sp.get("phone") ?? ""] ?? ""} set={(t) => set("phone", t === "sim" ? "1" : t === "nao" ? "0" : "")} />
                <Tri3 label="E-mail" v={({ "1": "sim", "0": "nao" } as Record<string, Tri>)[sp.get("email") ?? ""] ?? ""} set={(t) => set("email", t === "sim" ? "1" : t === "nao" ? "0" : "")} />
              </div></FilterGroup>
              <FilterGroup title="Alterado entre"><div className="grid grid-cols-2 gap-2"><DateInput label="Alterado de" value={sp.get("from") ?? ""} onChange={(v) => set("from", v)} /><DateInput label="Alterado até" value={sp.get("to") ?? ""} onChange={(v) => set("to", v)} /></div></FilterGroup>
              <FilterGroup title="Código da visita"><input className={inputCls} placeholder="V-12345" defaultValue={sp.get("visit") ?? ""} onBlur={(e) => set("visit", e.target.value.trim())} /></FilterGroup>
            </div>
          </Section>
      </div>
    </FilterBar>
  );
}
