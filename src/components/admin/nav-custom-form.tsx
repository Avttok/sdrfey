"use client";

import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { GROUP_ICONS, NAV } from "@/config/nav";
import { NAV_ICONS, type NavCustom } from "@/config/nav-icons";
import { saveNavCustomAction, setGlobalNavAction, setUserNavAction } from "@/modules/admin/user-prefs";

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

/**
 * Editor ÚNICO da barra de menus: cada linha é uma aba (ícone, nome e posição) e as pastas ficam no topo.
 * Um botão salva tudo junto. `base` é o que valia antes desta edição (mostra de onde vem o padrão).
 */
export function NavCustomForm({ scope, initial, base, hrefs, layout = "top" }: { scope: "global" | number; initial: NavCustom; base: NavCustom; hrefs: string[]; layout?: "top" | "side" }) {
  const [c, setC] = useState<NavCustom>(initial);
  const [order, setOrder] = useState(hrefs);
  const { run, pending } = useRun();
  const groups = [...new Set(NAV.map((n) => n.group).filter(Boolean) as string[])];
  const set = (kind: "items" | "groups", key: string, patch: Entry) => setC((p) => ({ ...p, [kind]: { ...p[kind], [key]: { ...p[kind][key], ...patch } } }));
  const reset = (kind: "items" | "groups", key: string) => setC((p) => { const n = { ...p[kind] }; delete n[key]; return { ...p, [kind]: n }; });
  const move = (i: number, d: -1 | 1) => { const n = [...order]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); };
  const save = () => run(async () => {
    const a = await saveNavCustomAction(scope, c);
    if (!a.ok) return a;
    return scope === "global" ? setGlobalNavAction({ order }) : setUserNavAction(scope, { layout, order });
  });
  const row = (kind: "items" | "groups", key: string, defLabel: string, DefIcon: React.ComponentType<{ size?: number }>, pos?: number, tag?: string) => {
    const own = c[kind][key] ?? {}, inherited = base[kind][key] ?? {};
    const shownIcon = own.icon ?? inherited.icon;
    return (
      <li key={`${kind}-${key}`} className="flex items-center gap-2 rounded-xl bg-sunk px-3 py-2 sm:gap-3">
        {pos !== undefined ? <span className="figure w-5 shrink-0 text-center text-xs text-muted">{pos + 1}</span> : <span className="w-5 shrink-0" />}
        <IconPick value={shownIcon} fallback={(inherited.icon && NAV_ICONS[inherited.icon]) || DefIcon} onChange={(k) => set(kind, key, { icon: k })} />
        <input className={`${inputCls} !h-10 min-w-0 flex-1`} maxLength={24} placeholder={inherited.label ?? defLabel} value={own.label ?? ""} onChange={(e) => set(kind, key, { label: e.target.value })} aria-label={`Nome de ${defLabel}`} />
        {tag && <span className="hidden shrink-0 rounded-full bg-panel px-2 py-0.5 text-[11px] text-muted sm:block">{tag}</span>}
        <button type="button" className="rounded-md p-2 text-muted hover:bg-line hover:text-ink disabled:opacity-30" disabled={!c[kind][key]} aria-label={`Restaurar ${defLabel}`} title={`Restaurar nome e ícone (padrão: ${defLabel})`} onClick={() => reset(kind, key)}><RotateCcw size={15} /></button>
        {pos !== undefined && <>
          <button type="button" aria-label={`Subir ${defLabel}`} disabled={pos === 0} onClick={() => move(pos, -1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowUp size={15} /></button>
          <button type="button" aria-label={`Descer ${defLabel}`} disabled={pos === order.length - 1} onClick={() => move(pos, 1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowDown size={15} /></button>
        </>}
      </li>
    );
  };
  const dirty = order.join() !== hrefs.join() || JSON.stringify(c) !== JSON.stringify(initial);
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Pastas (nome e ícone)</p>
        <ul className="grid gap-2 sm:grid-cols-2">{groups.map((g) => row("groups", g, g, GROUP_ICONS[g] ?? NAV[0].icon))}</ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Abas, na ordem do menu</p>
        <ol className="space-y-2">{order.map((h, i) => { const n = NAV.find((x) => x.href === h); return n ? row("items", n.href, n.label, n.icon, i, n.group) : null; })}</ol>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={pending || !dirty} onClick={save}>{scope === "global" ? "Salvar para todos" : "Salvar para esta pessoa"}</button>
        <button type="button" className={btnGhost} disabled={pending} onClick={() => { setC({ items: {}, groups: {} }); setOrder(NAV.filter((n) => hrefs.includes(n.href)).map((n) => n.href)); }}>Restaurar padrão</button>
      </div>
    </div>
  );
}
