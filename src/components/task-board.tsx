"use client";

import { AlarmClock, CalendarClock, Check, ChevronDown, ExternalLink, ListChecks, Phone, Plus, RotateCcw, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TASK_KEYS, TASK_KINDS, dueBucket, dueFromDays, fromLocalInput, toLocalInput, type TaskArea, type TaskKind } from "@/config/tasks";
import { fmtPhone } from "@/lib/format";
import { createTaskAction, deleteTaskAction, snoozeTaskAction, updateTaskAction } from "@/modules/tasks/actions";
import type { TaskRow } from "@/modules/tasks/queries";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useToast } from "./toast";
import { DueChip, KindBadge, TASK_HEX } from "./task-ui";

type Bucket = ReturnType<typeof dueBucket>;
const GROUPS: { k: Bucket; label: string; hex: string }[] = [
  { k: "atrasada", label: "Atrasadas", hex: "#ef4444" },
  { k: "hoje", label: "Hoje", hex: "#f59e0b" },
  { k: "amanha", label: "Amanhã", hex: "#0ea5e9" },
  { k: "semana", label: "Esta semana", hex: "#8b5cf6" },
  { k: "depois", label: "Mais pra frente", hex: "#64748b" },
  { k: "sem_data", label: "Sem data", hex: "#94a3b8" },
];

/** O quadro de tarefas: atrasadas, hoje, próximas e concluídas. Concluir, adiar, remover e criar à mão. */
export function TaskBoard({ area, open, done, people, viewing, meId, otherName }: { area: TaskArea; open: TaskRow[]; done: TaskRow[]; people: { id: number; name: string }[]; viewing: number; meId: number; otherName: string | null }) {
  const router = useRouter(); const toast = useToast();
  const [openRows, setOpen] = useState(open); const [doneRows, setDone] = useState(done);
  const [kind, setKind] = useState<TaskKind | "todas">("todas");
  const [bucket, setBucket] = useState<Bucket | "todas">("todas");
  const [pending, start] = useTransition();
  const mine = viewing === meId;
  // volta a copiar quando o servidor manda dados novos
  const [seen, setSeen] = useState({ open, done });
  if (seen.open !== open || seen.done !== done) { setSeen({ open, done }); setOpen(open); setDone(done); }

  const now = new Date();
  const rows = useMemo(() => openRows.filter((t) => (kind === "todas" || t.kind === kind) && (bucket === "todas" || dueBucket(t.dueAt, now) === bucket)), [openRows, kind, bucket]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (b: Bucket) => openRows.filter((t) => dueBucket(t.dueAt, now) === b).length;
  const kindsUsed = TASK_KEYS.filter((k) => openRows.some((t) => t.kind === k));

  const finish = (t: TaskRow) => { setOpen((l) => l.filter((x) => x.id !== t.id)); setDone((l) => [{ ...t, doneAt: new Date().toISOString() }, ...l]); start(async () => { const r = await updateTaskAction(t.id, { done: true }); if (!r.ok) { toast("bad", r.message ?? "Não consegui concluir."); router.refresh(); } }); };
  const reopen = (t: TaskRow) => { setDone((l) => l.filter((x) => x.id !== t.id)); setOpen((l) => [...l, { ...t, doneAt: null }]); start(async () => { await updateTaskAction(t.id, { done: false }); router.refresh(); }); };
  const remove = (t: TaskRow) => { setOpen((l) => l.filter((x) => x.id !== t.id)); setDone((l) => l.filter((x) => x.id !== t.id)); start(async () => { await deleteTaskAction(t.id); toast("ok", "Tarefa removida."); }); };
  const snooze = (t: TaskRow, days: number) => { setOpen((l) => l.map((x) => (x.id === t.id ? { ...x, dueAt: dueFromDays(days).toISOString() } : x))); start(async () => { await snoozeTaskAction(t.id, days); router.refresh(); }); };
  const setDue = (t: TaskRow, v: string) => { const d = fromLocalInput(v); if (!d) return; setOpen((l) => l.map((x) => (x.id === t.id ? { ...x, dueAt: d.toISOString() } : x))); start(async () => { await updateTaskAction(t.id, { due: v }); router.refresh(); }); };

  return (
    <div className="space-y-4">
      {people.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm"><UserRound size={16} aria-hidden className="text-muted" /> <span className="font-medium">Tarefas de</span>
          <select className={`${inputCls} !w-auto`} value={viewing} onChange={(e) => router.push(`?u=${e.target.value}`)}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.id === meId ? `${p.name} (você)` : p.name}</option>)}
          </select>
        </label>
      )}
      {otherName && <p className="rounded-xl bg-sunk px-3 py-2 text-sm text-muted">Você está vendo as tarefas de <b className="text-ink">{otherName}</b>. Só quem criou consegue concluir ou mudar.</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GROUPS.filter((g) => g.k === "atrasada" || g.k === "hoje" || g.k === "amanha").map((g) => (
          <button key={g.k} type="button" aria-pressed={bucket === g.k} onClick={() => setBucket(bucket === g.k ? "todas" : g.k)}
            className={`${panelCls} flex flex-col items-start gap-0.5 p-3 text-left transition active:scale-[0.98] ${bucket === g.k ? "ring-2" : "hover:brightness-105"}`} style={bucket === g.k ? { ["--tw-ring-color" as string]: g.hex } : undefined}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: g.hex }}>{g.label}</span>
            <span className="figure text-3xl font-extrabold leading-none">{count(g.k)}</span>
          </button>
        ))}
        <button type="button" aria-pressed={bucket === "sem_data"} onClick={() => setBucket(bucket === "sem_data" ? "todas" : "sem_data")} className={`${panelCls} flex flex-col items-start gap-0.5 p-3 text-left transition active:scale-[0.98] ${bucket === "sem_data" ? "ring-2 ring-accent" : "hover:brightness-105"}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Em aberto</span>
          <span className="figure text-3xl font-extrabold leading-none">{openRows.length}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {kindsUsed.length > 1 && (["todas", ...kindsUsed] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${kind === k ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink"}`}>{k === "todas" ? "Todas" : TASK_KINDS[k].short}</button>
        ))}
        {mine && <NewTask area={area} />}
      </div>

      {openRows.length === 0 && (
        <div className={`${panelCls} grid place-items-center gap-2 px-6 py-12 text-center`}>
          <span className="grid size-14 place-items-center rounded-2xl bg-grad-soft text-accent"><ListChecks size={28} aria-hidden /></span>
          <p className="text-lg font-bold">Nenhuma tarefa em aberto</p>
          <p className="max-w-md text-sm text-muted">Quando uma ligação terminar com “ligar de novo”, “enviar e-mail” ou “enviar a cotação”, a tarefa aparece aqui sozinha, com a data combinada.</p>
        </div>
      )}

      {GROUPS.map((g) => {
        const list = rows.filter((t) => dueBucket(t.dueAt, now) === g.k);
        if (!list.length) return null;
        return (
          <section key={g.k} className="space-y-2" aria-label={g.label}>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: g.hex }}><span className="size-2.5 rounded-full" style={{ background: g.hex }} /> {g.label} <span className="figure rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">{list.length}</span></h2>
            <ul className="space-y-2">
              {list.map((t) => <TaskCard key={t.id} t={t} mine={mine} pending={pending} onDone={() => finish(t)} onRemove={() => remove(t)} onSnooze={(d) => snooze(t, d)} onDue={(v) => setDue(t, v)} />)}
            </ul>
          </section>
        );
      })}

      {doneRows.length > 0 && <DoneList rows={doneRows} mine={mine} onReopen={reopen} onRemove={remove} />}
    </div>
  );
}

function leadLine(t: TaskRow) {
  if (!t.lead) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
      <Link href={`/leads/${t.lead.id}`} className="inline-flex items-center gap-1 font-semibold text-ink underline-offset-2 hover:text-accent hover:underline">{t.lead.name}<ExternalLink size={12} aria-hidden /></Link>
      {t.lead.city && <span>{t.lead.city}</span>}
      {t.lead.contact && <span>· {t.lead.contact}</span>}
      {t.lead.phone && t.kind === "ligar" && <a href={`tel:+55${t.lead.phone}`} className="inline-flex items-center gap-1 font-semibold text-accent"><Phone size={12} aria-hidden />{fmtPhone(t.lead.phone)}</a>}
    </p>
  );
}

function TaskCard({ t, mine, pending, onDone, onRemove, onSnooze, onDue }: { t: TaskRow; mine: boolean; pending: boolean; onDone: () => void; onRemove: () => void; onSnooze: (d: number) => void; onDue: (v: string) => void }) {
  const [menu, setMenu] = useState(false); const [ask, setAsk] = useState(false);
  const late = dueBucket(t.dueAt) === "atrasada";
  return (
    <li className={`${panelCls} p-3 ${late ? "border-danger/40" : ""}`} style={{ borderLeft: `4px solid ${TASK_HEX[t.kind]}` }}>
      <div className="flex items-start gap-3">
        {mine ? <button type="button" onClick={onDone} disabled={pending} aria-label={`Concluir: ${t.title}`} title="Concluir" className="group mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-2 border-line text-transparent transition hover:border-ok hover:bg-ok/10 hover:text-ok active:scale-90"><Check size={18} aria-hidden /></button> : <KindBadge kind={t.kind} />}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold leading-snug">{t.title}</p><DueChip due={t.dueAt} />{t.fromScript && <span className="rounded-full bg-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">do script</span>}</div>
          {leadLine(t)}
          {t.note && <p className="text-sm text-muted">{t.note}</p>}
        </div>
        {mine && <KindBadge kind={t.kind} />}
      </div>
      {mine && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:bg-sunk" aria-expanded={menu} onClick={() => setMenu(!menu)}><AlarmClock size={14} aria-hidden /> Adiar <ChevronDown size={12} aria-hidden className={menu ? "rotate-180" : ""} /></button>
          {menu && <>
            <button type="button" className="rounded-lg bg-sunk px-2.5 py-1.5 text-xs font-semibold hover:brightness-95" onClick={() => { onSnooze(1); setMenu(false); }}>Amanhã</button>
            <button type="button" className="rounded-lg bg-sunk px-2.5 py-1.5 text-xs font-semibold hover:brightness-95" onClick={() => { onSnooze(2); setMenu(false); }}>Em 2 dias</button>
            <button type="button" className="rounded-lg bg-sunk px-2.5 py-1.5 text-xs font-semibold hover:brightness-95" onClick={() => { onSnooze(7); setMenu(false); }}>Em 1 semana</button>
            <label className="flex items-center gap-1 text-xs text-muted"><CalendarClock size={14} aria-hidden /><span className="sr-only">Escolher data e hora</span><input type="datetime-local" className={`${inputCls} !min-h-8 !w-auto !py-0.5 !text-xs`} defaultValue={toLocalInput(t.dueAt)} onChange={(e) => onDue(e.target.value)} /></label>
          </>}
          <span className="flex-1" />
          {ask ? <><span className="text-xs text-muted">Remover?</span><button type="button" className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-bold text-white" onClick={onRemove}>Sim</button><button type="button" className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold" onClick={() => setAsk(false)}>Não</button></>
            : <button type="button" aria-label={`Remover a tarefa ${t.title}`} title="Remover" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger" onClick={() => setAsk(true)}><Trash2 size={15} aria-hidden /></button>}
        </div>
      )}
    </li>
  );
}

function DoneList({ rows, mine, onReopen, onRemove }: { rows: TaskRow[]; mine: boolean; onReopen: (t: TaskRow) => void; onRemove: (t: TaskRow) => void }) {
  const [show, setShow] = useState(false);
  return (
    <section className="space-y-2" aria-label="Concluídas">
      <button type="button" aria-expanded={show} onClick={() => setShow(!show)} className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ok"><Check size={15} aria-hidden /> Concluídas nos últimos 7 dias <span className="figure rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">{rows.length}</span><ChevronDown size={14} aria-hidden className={show ? "rotate-180" : ""} /></button>
      {show && <ul className="space-y-1.5">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/60 bg-sunk/40 px-3 py-2 text-sm">
            <Check size={15} aria-hidden className="shrink-0 text-ok" />
            <span className="min-w-0 flex-1 text-muted line-through decoration-muted/50">{t.title}{t.lead ? ` · ${t.lead.name}` : ""}</span>
            {mine && <><button type="button" className={`${btnGhost} !min-h-8 !px-2.5 !py-1 !text-xs`} onClick={() => onReopen(t)}><RotateCcw size={13} aria-hidden /> Reabrir</button>
              <button type="button" aria-label={`Remover ${t.title}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" onClick={() => onRemove(t)}><Trash2 size={14} aria-hidden /></button></>}
          </li>
        ))}
      </ul>}
    </section>
  );
}

function NewTask({ area }: { area: TaskArea }) {
  const router = useRouter(); const toast = useToast();
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(""); const [kind, setKind] = useState<TaskKind>("ligar"); const [due, setDue] = useState(toLocalInput(dueFromDays(1)));
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await createTaskAction({ area, kind, title, due: due || null });
    if (!r.ok) { toast("bad", r.message ?? "Não consegui criar."); return; }
    toast("ok", "Tarefa criada."); setTitle(""); setOpen(false); router.refresh();
  });
  if (!open) return <button type="button" className={`${btnPrimary} !min-h-9 !px-3 !py-1.5 !text-sm`} onClick={() => setOpen(true)}><Plus size={15} aria-hidden /> Nova tarefa</button>;
  return (
    <form className={`${panelCls} flex w-full flex-wrap items-end gap-2 p-3`} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label className="min-w-48 flex-1 text-sm font-medium">O que fazer<input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligar para a Rondo e confirmar o pedido" maxLength={120} autoFocus /></label>
      <label className="text-sm font-medium">Tipo<select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>{TASK_KEYS.map((k) => <option key={k} value={k}>{TASK_KINDS[k].label}</option>)}</select></label>
      <label className="text-sm font-medium">Quando<input type="datetime-local" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <button type="submit" className={btnPrimary} disabled={pending || title.trim().length < 2}>Criar</button>
      <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancelar</button>
    </form>
  );
}
