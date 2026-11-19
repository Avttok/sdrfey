"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { GROUP_ICONS, NAV } from "@/config/nav";
import { NAV_ICONS, type NavCustom } from "@/config/nav-icons";
import { saveNavCustomAction } from "@/modules/admin/user-prefs";

type Entry = { label?: string; icon?: string };

function IconPick({ value, fallback, onChange }: { value?: string; fallback: React.ComponentType<{ size?: number }>; onChange: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const Cur = (value && NAV_ICONS[value]) || fallback;
  return (
    <div className="relative">
      <button type="button" aria-label="Escolher ícone" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`grid size-10 place-items-center rounded-xl border-2 transition ${value ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-ink"}`}><Cur size={18} /></button>
      {open && (
        <>
          <button type="button" aria-label="Fechar" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-50 grid w-72 grid-cols-7 gap-1 rounded-2xl border border-line bg-panel p-2 shadow-xl">
            {Object.entries(NAV_ICONS).map(([k, I]) => (
              <button key={k} type="button" title={k} onClick={() => { onChange(k); setOpen(false); }} className={`grid size-9 place-items-center rounded-lg transition hover:bg-sunk ${value === k ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}><I size={17} /></button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Nomes e ícones do menu: cada pasta e cada aba. `base` é o que vale antes desta edição (para mostrar de onde vem o padrão). */
export function NavCustomForm({ scope, initial, base }: { scope: "global" | number; initial: NavCustom; base: NavCustom }) {
  const [c, setC] = useState<NavCustom>(initial);
  const { run, pending } = useRun();
  const groups = [...new Set(NAV.map((n) => n.group).filter(Boolean))] as string[];
  const set = (kind: "items" | "groups", key: string, patch: Entry) => setC((p) => ({ ...p, [kind]: { ...p[kind], [key]: { ...p[kind][key], ...patch } } }));
  const reset = (kind: "items" | "groups", key: string) => setC((p) => { const n = { ...p[kind] }; delete n[key]; return { ...p, [kind]: n }; });
  const row = (kind: "items" | "groups", key: string, defLabel: string, DefIcon: React.ComponentType<{ size?: number }>, indent = false) => {
    const own = c[kind][key] ?? {}, inherited = base[kind][key] ?? {};
    const shownIcon = own.icon ?? inherited.icon;
    return (
      <li key={`${kind}-${key}`} className={`flex items-center gap-3 rounded-xl bg-sunk px-3 py-2 ${indent ? "ml-6" : ""}`}>
        <IconPick value={shownIcon} fallback={(inherited.icon && NAV_ICONS[inherited.icon]) || DefIcon} onChange={(k) => set(kind, key, { icon: k })} />
        <input className={`${inputCls} !h-10 flex-1`} maxLength={24} placeholder={inherited.label ?? defLabel} value={own.label ?? ""} onChange={(e) => set(kind, key, { label: e.target.value })} aria-label={`Nome de ${defLabel}`} />
        <span className="hidden w-28 truncate text-xs text-muted sm:block">padrão: {defLabel}</span>
        <button type="button" className="rounded-md p-2 text-muted hover:bg-line hover:text-ink disabled:opacity-30" disabled={!c[kind][key]} aria-label={`Restaurar ${defLabel}`} title="Restaurar padrão" onClick={() => reset(kind, key)}><RotateCcw size={15} /></button>
      </li>
    );
  };
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g} className="space-y-2">
            <ul className="space-y-2">{row("groups", g, g, GROUP_ICONS[g] ?? NAV[0].icon)}</ul>
            <ul className="space-y-2">{NAV.filter((n) => n.group === g).map((n) => row("items", n.href, n.label, n.icon, true))}</ul>
          </li>
        ))}
        <li><p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Abas soltas</p>
          <ul className="space-y-2">{NAV.filter((n) => !n.group && n.href !== "/conta").map((n) => row("items", n.href, n.label, n.icon))}</ul></li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveNavCustomAction(scope, c))}>{scope === "global" ? "Salvar para todos" : "Salvar para esta pessoa"}</button>
        <button type="button" className={btnGhost} disabled={pending} onClick={() => setC({ items: {}, groups: {} })}>Limpar tudo</button>
      </div>
    </div>
  );
}
