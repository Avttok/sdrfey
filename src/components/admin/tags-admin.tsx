"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { TagChip } from "@/components/tag-chip";
import { TAG_ICONS, tagIconKey } from "@/config/tag-icons";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { deleteTagAction, reorderTagsAction, saveTagAction } from "@/modules/admin/config";

export type TagRow = { id?: number; groupKey: string; label: string; color: string; blocksSorting: boolean; cooldownDays: number | null; active: boolean; autoOnly?: boolean; icon?: string | null; tagKey?: string };

function Row({ t, isNew, onGrip, dragging }: { t: TagRow; isNew?: boolean; onGrip?: (e: React.PointerEvent) => void; dragging?: boolean }) {
  const [f, setF] = useState(t);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  return (
    <li data-tag={t.id} className={`rounded-xl border bg-panel p-3 text-sm transition-shadow ${dragging ? "border-accent shadow-xl ring-2 ring-accent" : isNew ? "border-dashed border-line" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        {!isNew ? (
          <button type="button" aria-label={`Arrastar ${t.label} para mudar a ordem`} title="Segure e arraste para mudar a ordem" onPointerDown={onGrip} className="cursor-grab touch-none rounded-lg p-1.5 text-muted hover:bg-sunk active:cursor-grabbing"><GripVertical size={18} /></button>
        ) : <span className="grid size-8 place-items-center text-muted"><Plus size={18} aria-hidden /></span>}
        <input type="color" aria-label="Cor" className="size-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        <input className={`${inputCls} !w-44 !py-1.5`} aria-label="Nome" placeholder={isNew ? "Nova tag…" : "Nome da tag"} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        {!isNew && <TagChip label={f.label || "—"} color={f.color} icon={tagIconKey(f.icon, t.tagKey ?? "", t.groupKey)} />}
        {t.autoOnly && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">só o sistema aplica</span>}
        <span className="flex-1" />
        <button type="button" className={isNew ? btnPrimary : btnGhost} disabled={pending} onClick={() => run(() => saveTagAction({ ...f, id: t.id }), undefined, () => isNew && setF(t))}>{isNew ? <><Plus size={15} aria-hidden /> Criar</> : "Salvar"}</button>
        {!isNew && <button type="button" aria-label="Excluir tag" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir esta tag?", body: `A tag "${t.label}" será removida de todos os leads que a têm.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteTagAction(t.id!)) })}><Trash2 size={15} /></button>}
      </div>
      <details className="mt-2.5 border-t border-line/70 pt-2.5 pl-1 text-[13px] text-muted">
        <summary className="cursor-pointer select-none font-medium">Ícone da bolha {f.icon ? `· ${f.icon}` : "· padrão"}</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setF({ ...f, icon: null })} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${!f.icon ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>Padrão</button>
          {Object.entries(TAG_ICONS).map(([k, I]) => <button key={k} type="button" title={k} aria-label={k} aria-pressed={f.icon === k} onClick={() => setF({ ...f, icon: k })} className={`grid size-9 place-items-center rounded-lg border transition hover:-translate-y-0.5 ${f.icon === k ? "border-accent bg-accent/15 text-accent" : "border-line"}`}><I size={16} aria-hidden /></button>)}
        </div>
      </details>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 pt-2.5 pl-1 text-[13px] text-muted">
        <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="size-4" checked={f.blocksSorting} onChange={(e) => setF({ ...f, blocksSorting: e.target.checked })} /> Tira do sorteio</label>
        <label className="flex items-center gap-1.5">Volta em <input type="number" min={0} className={`${inputCls} !w-16 !py-1 text-center`} placeholder="—" value={f.cooldownDays ?? ""} onChange={(e) => setF({ ...f, cooldownDays: e.target.value === "" ? null : Number(e.target.value) })} /> dias</label>
        <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="size-4" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativa</label>
      </div>
      {dialog}
    </li>
  );
}

function Group({ g }: { g: { key: string; name: string; tags: TagRow[] } }) {
  const initial = g.tags.map((t) => t.id!);
  const [ord, setOrder] = useState<number[]>(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const ul = useRef<HTMLUListElement>(null);
  const orderRef = useRef<number[]>([]);
  const { run, pending } = useRun();
  const byId = new Map(g.tags.map((t) => [t.id!, t]));
  /* tags criadas/apagadas depois do carregamento entram/saem da lista sem perder a ordem que você está montando */
  const order = [...ord.filter((id) => byId.has(id)), ...initial.filter((id) => !ord.includes(id))];
  orderRef.current = order;
  const dirty = order.join() !== initial.join();

  const grip = (id: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDrag(id);
    const move = (ev: PointerEvent) => {
      const items = [...(ul.current?.querySelectorAll<HTMLElement>("li[data-tag]") ?? [])];
      let target = items.findIndex((el) => { const r = el.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      if (target === -1) target = items.length - 1;
      setOrder(() => {
        const cur = orderRef.current;
        const from = cur.indexOf(id);
        if (from === target || target < 0) return cur;
        const n = [...cur]; n.splice(from, 1); n.splice(target, 0, id);
        return n;
      });
    };
    const up = () => { setDrag(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  return (
    <section className={`${panelCls} overflow-hidden ${dirty ? "ring-2 ring-accent" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-sunk/60 px-4 py-3 sm:px-5">
        <span aria-hidden className="size-2.5 rounded-full bg-grad" /><h2 className="text-base font-semibold">{g.name}</h2><span className="figure rounded-full bg-panel px-2 py-0.5 text-xs text-muted">{g.tags.length} tags</span>
        <span className="hidden flex-wrap gap-1.5 md:flex">{g.tags.slice(0, 6).map((t) => <span key={t.id} title={t.label} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: t.color }} />)}</span>
        {dirty && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted">Ordem alterada, ainda não salva</span>
            <button type="button" className={btnGhost} disabled={pending} onClick={() => setOrder(initial)}>Descartar</button>
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => reorderTagsAction(g.key, order))}>Salvar ordem</button>
          </span>
        )}
      </div>
      <ul ref={ul} className="space-y-2.5 p-4 sm:p-5">
        {order.map((id) => <Row key={id} t={byId.get(id)!} onGrip={grip(id)} dragging={drag === id} />)}
        <Row isNew t={{ groupKey: g.key, label: "", color: "#64748b", blocksSorting: false, cooldownDays: null, active: true }} />
      </ul>
    </section>
  );
}

export function TagsAdmin({ groups }: { groups: { key: string; name: string; tags: TagRow[] }[] }) {
  return <div className="space-y-4">{groups.map((g) => <Group key={g.key} g={g} />)}</div>;
}
