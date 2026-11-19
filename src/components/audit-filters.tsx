"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useBusyWhile } from "@/components/toast";
import { useEffect, useState } from "react";
import { DateInput } from "@/components/date-input";
import { FilterBar } from "@/components/filter-bar";
import { inputCls } from "@/components/ui";

/** Filtros do Registro: data, usuário, tipo e texto, cada um com seu rótulo FORA da caixa. */
export function AuditFilters({ people, types }: { people: { id: number; name: string }[]; types: [string, string][] }) {
  const router0 = useRouter();
  const [navPending, startNav] = useTransition();
  useBusyWhile(navPending);
  const router = { replace: (url: string, o?: { scroll?: boolean }) => startNav(() => router0.replace(url, o)) };
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => { const p = new URLSearchParams(sp.toString()); v ? p.set(k, v) : p.delete(k); p.delete("page"); router.replace(`${path}?${p}`, { scroll: false }); };
  useEffect(() => { const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q.trim()) set("q", q.trim()); }, 400); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-sm"><span className="mb-1 block text-muted">{t}</span>{children}</label>;
  const count = ["from", "to", "user", "type", "q"].filter((k) => sp.get(k)).length;
  return (
    <FilterBar id="registro" active={count} onClear={() => { setQ(""); router.replace(path, { scroll: false }); }}
      search={<><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} pl-9`} placeholder="Buscar no texto do registro" value={q} onChange={(e) => setQ(e.target.value)} /></>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <L t="De"><DateInput label="De" value={sp.get("from") ?? ""} onChange={(v) => set("from", v)} /></L>
        <L t="Até"><DateInput label="Até" value={sp.get("to") ?? ""} onChange={(v) => set("to", v)} /></L>
        <L t="Usuário"><select className={inputCls} value={sp.get("user") ?? ""} onChange={(e) => set("user", e.target.value)}><option value="">Todos</option><option value="sistema">Sistema (automático)</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></L>
        <L t="Tipo"><select className={inputCls} value={sp.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}><option value="">Todos</option>{types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
      </div>
    </FilterBar>
  );
}
