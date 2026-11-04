"use client";

import { CalendarDays, FilterX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateInput } from "@/components/date-input";

export type Bubble = { id: number; name: string; hex: string };

/** Período (Hoje, 7 dias, 30 dias ou DE/ATÉ) e pessoas em bolhas coloridas. */
export function DashboardFilters({ preset, from, to, people, selected }: { preset: string; from: string; to: string; people: Bubble[]; selected: number[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const push = (mut: (p: URLSearchParams) => void) => { const p = new URLSearchParams(sp.toString()); mut(p); router.replace(`${path}?${p}`, { scroll: false }); };
  const chip = (on: boolean, hex = "#3b82f6") => ({ background: `color-mix(in srgb, ${hex} ${on ? 40 : 12}%, transparent)`, borderColor: `color-mix(in srgb, ${hex} ${on ? 100 : 40}%, transparent)`, outline: on ? `1.5px solid ${hex}` : undefined } as const);
  const usersParam = sp.getAll("u").map(Number);
  const toggleUser = (id: number) => push((p) => { const cur = p.getAll("u").map(Number); p.delete("u"); (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).forEach((x) => p.append("u", String(x))); });
  const dirty = !!(sp.get("p") || sp.get("from") || sp.get("to") || usersParam.length);
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarDays size={16} className="text-muted" aria-hidden />
        {([["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={preset === k} style={chip(preset === k)} className="rounded-md border px-2.5 py-1 text-sm font-medium" onClick={() => push((p) => { p.delete("from"); p.delete("to"); p.set("p", k); })}>{l}</button>
        ))}
      </div>
      <label className="text-sm"><span className="mb-1 block text-muted">De</span><div className="w-36"><DateInput label="De" value={from} onChange={(v) => push((p) => { p.delete("p"); v ? p.set("from", v) : p.delete("from"); if (!p.get("to") && v) p.set("to", v); })} /></div></label>
      <label className="text-sm"><span className="mb-1 block text-muted">Até</span><div className="w-36"><DateInput label="Até" value={to} onChange={(v) => push((p) => { p.delete("p"); v ? p.set("to", v) : p.delete("to"); if (!p.get("from") && v) p.set("from", v); })} /></div></label>
      {people.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {people.map((u) => <button key={u.id} type="button" aria-pressed={selected.includes(u.id) && usersParam.length > 0} style={chip(usersParam.includes(u.id), u.hex)} className="rounded-full border px-3 py-1 text-sm font-medium" onClick={() => toggleUser(u.id)}>{u.name.split(" ")[0]}</button>)}
        </div>
      )}
      {dirty && <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-danger/50 px-3 py-2 text-sm font-medium text-danger hover:bg-sunk" onClick={() => router.replace(path, { scroll: false })}><FilterX size={16} aria-hidden /> Limpar</button>}
    </div>
  );
}
