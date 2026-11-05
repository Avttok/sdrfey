"use client";

import { CalendarDays, Check, FilterX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateInput } from "@/components/date-input";
import { useBusyWhile } from "@/components/toast";

export type Bubble = { id: number; name: string; hex: string };

const readable = (hex: string) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.62 ? "#1a1a1a" : "#ffffff"; };

/** Período (Hoje, 7 dias, 30 dias ou DE/ATÉ com calendário) e pessoas em bolhas coloridas. */
export function DashboardFilters({ preset, from, to, people }: { preset: string; from: string; to: string; people: Bubble[]; selected: number[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const push = (mut: (p: URLSearchParams) => void) => { const p = new URLSearchParams(sp.toString()); mut(p); start(() => router.replace(`${path}?${p}`, { scroll: false })); };
  const usersParam = sp.getAll("u").map(Number);
  const toggleUser = (id: number) => push((p) => { const cur = p.getAll("u").map(Number); p.delete("u"); (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).forEach((x) => p.append("u", String(x))); });
  const dirty = !!(sp.get("p") || sp.get("from") || sp.get("to") || usersParam.length);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-sm text-muted"><CalendarDays size={14} aria-hidden /> Período</span>
          <div className="flex gap-1.5">
            {([["hoje", "Hoje"], ["7", "7 dias"], ["30", "30 dias"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => push((p) => { p.delete("from"); p.delete("to"); p.set("p", k); })}
                className={`h-11 rounded-lg border px-4 text-[15px] font-medium transition ${preset === k ? "border-accent bg-grad text-on-accent" : "border-line bg-panel hover:bg-sunk"}`}>{l}</button>
            ))}
          </div>
        </div>
        <label className="block text-sm"><span className="mb-1 block text-muted">De</span><div className="w-44"><DateInput label="De" value={from} onChange={(v) => push((p) => { p.delete("p"); v ? p.set("from", v) : p.delete("from"); if (!p.get("to") && v) p.set("to", v); })} /></div></label>
        <label className="block text-sm"><span className="mb-1 block text-muted">Até</span><div className="w-44"><DateInput label="Até" value={to} onChange={(v) => push((p) => { p.delete("p"); v ? p.set("to", v) : p.delete("to"); if (!p.get("from") && v) p.set("from", v); })} /></div></label>
        {dirty && <button type="button" className="inline-flex h-11 items-center gap-2 rounded-lg border border-danger/50 px-4 text-[15px] font-medium text-danger hover:bg-sunk" onClick={() => start(() => router.replace(path, { scroll: false }))}><FilterX size={16} aria-hidden /> Limpar</button>}
      </div>
      {people.length > 1 && (
        <div>
          <span className="mb-1.5 block text-sm text-muted">Pessoas {usersParam.length ? `(${usersParam.length} selecionada${usersParam.length > 1 ? "s" : ""})` : "(todas — clique para escolher)"}</span>
          <div className="flex flex-wrap items-center gap-2">
            {people.map((u) => {
              const on = usersParam.includes(u.id);
              return (
                <button key={u.id} type="button" aria-pressed={on} onClick={() => toggleUser(u.id)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-4 text-[15px] transition ${on ? "scale-110 font-bold shadow-lg" : usersParam.length ? "opacity-50 hover:opacity-100" : "hover:scale-105"}`}
                  style={on ? { background: u.hex, borderColor: u.hex, color: readable(u.hex), boxShadow: `0 0 0 4px color-mix(in srgb, ${u.hex} 30%, transparent)` } : { background: `color-mix(in srgb, ${u.hex} 14%, transparent)`, borderColor: `color-mix(in srgb, ${u.hex} 45%, transparent)` }}>
                  {on && <Check size={15} aria-hidden />}{u.name.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
