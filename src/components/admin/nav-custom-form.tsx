"use client";

import { ArrowDown, ArrowUp, FolderPlus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { GROUP_ICONS, NAV } from "@/config/nav";
import { NAV_ICONS, type NavCustom } from "@/config/nav-icons";
import { saveNavTreeAction } from "@/modules/admin/user-prefs";
import { defaultTree, type NavTree, type TreeFolder } from "@/config/nav-tree";

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
 * Editor ÚNICO e livre da barra de menus: crie, renomeie, apague e reordene pastas; mova qualquer aba para qualquer pasta
 * (ou deixe solta); troque nome e ícone de cada aba e pasta. Um botão salva tudo.
 * `base` é o que valia antes desta edição (mostra de onde vem o padrão).
 */
export function NavCustomForm({ scope, initial, base, tree: tree0, hadTree }: { scope: "global" | number; initial: NavCustom; base: NavCustom; tree: NavTree; hadTree: boolean }) {
  const [c, setC] = useState<NavCustom>(initial);
  const [tree, setTree] = useState<NavTree>(tree0);
  const [isDefault, setIsDefault] = useState(!hadTree);
  const { run, pending } = useRun();
  const edit = (fn: (t: NavTree) => NavTree) => { setTree((t) => fn(structuredClone(t))); setIsDefault(false); };
  const folders = tree.filter((n): n is TreeFolder => n.type === "folder");
  const setItem = (key: string, patch: Entry) => setC((p) => ({ ...p, items: { ...p.items, [key]: { ...p.items[key], ...patch } } }));
  const resetItem = (key: string) => setC((p) => { const n = { ...p.items }; delete n[key]; return { ...p, items: n }; });
  const swap = <T,>(arr: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  const moveTop = (i: number, d: -1 | 1) => edit((t) => { swap(t, i, d); return t; });
  const moveIn = (fid: string, i: number, d: -1 | 1) => edit((t) => { const f = t.find((n): n is TreeFolder => n.type === "folder" && n.id === fid); if (f) swap(f.items, i, d); return t; });
  const moveTo = (href: string, target: string) => edit((t) => {
    const without = t.filter((n) => !(n.type === "link" && n.href === href));
    for (const n of without) if (n.type === "folder") n.items = n.items.filter((h) => h !== href);
    if (target === "") without.push({ type: "link", href });
    else { const f = without.find((n): n is TreeFolder => n.type === "folder" && n.id === target); if (f) f.items.push(href); else without.push({ type: "link", href }); }
    return without;
  });
  const addFolder = () => edit((t) => { t.push({ type: "folder", id: `f${Date.now().toString(36)}`, label: "Nova pasta", items: [] }); return t; });
  const delFolder = (id: string) => edit((t) => t.flatMap((n) => (n.type === "folder" && n.id === id ? n.items.map((h) => ({ type: "link" as const, href: h })) : [n])));
  const patchFolder = (id: string, patch: Partial<TreeFolder>) => edit((t) => { const f = t.find((n) => n.type === "folder" && n.id === id); if (f) Object.assign(f, patch); return t; });
  const save = () => run(() => saveNavTreeAction(scope, isDefault ? null : tree, c));
  const dirty = JSON.stringify(c) !== JSON.stringify(initial) || JSON.stringify(tree) !== JSON.stringify(tree0) || isDefault !== !hadTree;

  const itemRow = (href: string, pos: number, len: number, onMove: (d: -1 | 1) => void, current: string) => {
    const n = NAV.find((x) => x.href === href); if (!n) return null;
    const own = c.items[href] ?? {}, inh = base.items[href] ?? {};
    return (
      <li key={href} className="flex flex-wrap items-center gap-2 rounded-xl bg-sunk px-3 py-2">
        <IconPick value={own.icon ?? inh.icon} fallback={(inh.icon && NAV_ICONS[inh.icon]) || n.icon} onChange={(k) => setItem(href, { icon: k })} />
        <input className={`${inputCls} !h-10 min-w-[8rem] flex-1`} maxLength={24} placeholder={`${n.group ? `${n.group} · ` : ""}${inh.label ?? n.label}`} value={own.label ?? ""} onChange={(e) => setItem(href, { label: e.target.value })} aria-label={`Nome de ${n.label}`} />
        <select aria-label={`Pasta de ${n.label}`} value={current} onChange={(e) => moveTo(href, e.target.value)} className="h-10 rounded-lg border border-line bg-panel px-2 text-xs">
          <option value="">Solta (sem pasta)</option>
          {folders.map((f) => <option key={f.id} value={f.id}>Pasta: {f.label}</option>)}
        </select>
        <button type="button" className="rounded-md p-2 text-muted hover:bg-line hover:text-ink disabled:opacity-30" disabled={!c.items[href]} aria-label={`Restaurar ${n.label}`} title={`Restaurar nome e ícone (padrão: ${n.label})`} onClick={() => resetItem(href)}><RotateCcw size={15} /></button>
        <button type="button" aria-label={`Subir ${n.label}`} disabled={pos === 0} onClick={() => onMove(-1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowUp size={15} /></button>
        <button type="button" aria-label={`Descer ${n.label}`} disabled={pos === len - 1} onClick={() => onMove(1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowDown size={15} /></button>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {tree.map((n, i) => n.type === "link"
          ? itemRow(n.href, i, tree.length, (d) => moveTop(i, d), "")
          : (
            <li key={n.id} className="rounded-2xl border-2 border-line p-2.5">
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <IconPick value={n.icon} fallback={NAV_ICONS.grid} onChange={(k) => patchFolder(n.id, { icon: k })} />
                <input className={`${inputCls} !h-10 min-w-[8rem] flex-1 font-semibold`} maxLength={24} value={n.label} onChange={(e) => patchFolder(n.id, { label: e.target.value })} aria-label="Nome da pasta" />
                <span className="rounded-full bg-sunk px-2 py-0.5 text-[11px] text-muted">pasta · {n.items.length} {n.items.length === 1 ? "aba" : "abas"}</span>
                <button type="button" aria-label={`Subir pasta ${n.label}`} disabled={i === 0} onClick={() => moveTop(i, -1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowUp size={15} /></button>
                <button type="button" aria-label={`Descer pasta ${n.label}`} disabled={i === tree.length - 1} onClick={() => moveTop(i, 1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowDown size={15} /></button>
                <button type="button" aria-label={`Excluir pasta ${n.label}`} title="Excluir pasta (as abas ficam soltas)" onClick={() => delFolder(n.id)} className="rounded-md p-2 text-danger hover:bg-danger/10"><Trash2 size={15} /></button>
              </div>
              <ul className="ml-4 space-y-2 border-l-2 border-line pl-3">
                {n.items.map((h, k) => itemRow(h, k, n.items.length, (d) => moveIn(n.id, k, d), n.id))}
                {n.items.length === 0 && <li className="rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted">Pasta vazia: ela só aparece no menu quando tiver abas. Use o seletor “Pasta” de uma aba para trazê-la para cá.</li>}
              </ul>
            </li>
          ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={addFolder}><FolderPlus size={16} aria-hidden /> Nova pasta</button>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" className={btnPrimary} disabled={pending || !dirty} onClick={save}>{scope === "global" ? "Salvar para todos" : "Salvar para esta pessoa"}</button>
        <button type="button" className={btnGhost} disabled={pending} onClick={() => { setC({ items: {}, groups: {} }); setTree(defaultTree(NAV.map((n) => n.href))); setIsDefault(true); }}>Restaurar padrão</button>
      </div>
    </div>
  );
}
