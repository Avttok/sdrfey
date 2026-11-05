"use client";

import { FilterX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useBusyWhile } from "@/components/toast";
import { useEffect, useState } from "react";
import { DateInput } from "@/components/date-input";
import { inputCls, panelCls } from "@/components/ui";

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
  const active = ["from", "to", "user", "type", "q"].some((k) => sp.get(k));
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-sm"><span className="mb-1 block text-muted">{t}</span>{children}</label>;
  return (
    <div className={`${panelCls} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}>
      <L t="De"><DateInput label="De" value={sp.get("from") ?? ""} onChange={(v) => set("from", v)} /></L>
      <L t="Até"><DateInput label="Até" value={sp.get("to") ?? ""} onChange={(v) => set("to", v)} /></L>
      <L t="Usuário"><select className={inputCls} value={sp.get("user") ?? ""} onChange={(e) => set("user", e.target.value)}><option value="">Todos</option><option value="sistema">Sistema (automático)</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></L>
      <L t="Tipo"><select className={inputCls} value={sp.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}><option value="">Todos</option>{types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L>
      <L t="Buscar no texto"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} /></L>
      {active && <button type="button" onClick={() => { setQ(""); router.replace(path, { scroll: false }); }} className="inline-flex items-center gap-2 justify-self-start rounded-lg border border-danger/50 px-3 py-2 text-sm font-medium text-danger hover:bg-sunk"><FilterX size={16} aria-hidden /> Limpar</button>}
    </div>
  );
}
