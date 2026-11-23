"use client";

import { CalendarClock, CheckCircle2, ListChecks, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fromLocalInput, toLocalInput, type TaskArea } from "@/config/tasks";
import { deleteTaskAction, runTasksAction, updateTaskAction } from "@/modules/tasks/actions";
import type { TaskRow } from "@/modules/tasks/queries";
import { inputCls } from "@/components/ui";
import { KindBadge } from "./task-ui";

/** No fim da ligação: as tarefas que o script criou (ligar de novo, enviar e-mail…). A pessoa ajusta a data ou tira. */
export function RunTasks({ runId, area }: { runId: string; area: TaskArea }) {
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  useEffect(() => {
    let live = true; let tries = 0;
    const load = () => runTasksAction(runId).then((r) => { if (!live) return; if (!r.length && tries++ < 3) setTimeout(load, 900); else setRows(r); }).catch(() => live && setRows([]));
    const t = setTimeout(load, 500);
    return () => { live = false; clearTimeout(t); };
  }, [runId]);
  if (rows === null) return <p className="text-xs text-muted" role="status">Criando as tarefas desta ligação…</p>;
  if (!rows.length) return null;
  const href = area === "vendas" ? "/tarefas-vendas" : "/tarefas";
  return (
    <section className="w-full max-w-xl space-y-2 rounded-2xl border border-line bg-sunk/50 p-3 text-left" aria-label="Tarefas desta ligação">
      <p className="flex items-center gap-2 text-sm font-bold"><ListChecks size={16} aria-hidden className="text-accent" /> Tarefas criadas por esta ligação</p>
      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-panel p-2 shadow-sm">
            <KindBadge kind={t.kind} />
            <span className="min-w-0 flex-1 text-sm font-semibold">{t.title}</span>
            <label className="flex items-center gap-1.5 text-xs text-muted"><CalendarClock size={14} aria-hidden /><span className="sr-only">Data e hora</span>
              <input type="datetime-local" className={`${inputCls} !min-h-9 !w-auto !py-1 !text-sm`} defaultValue={toLocalInput(t.dueAt)}
                onChange={(e) => { const v = e.target.value; if (fromLocalInput(v)) void updateTaskAction(t.id, { due: v }); }} />
            </label>
            <button type="button" aria-label={`Remover a tarefa ${t.title}`} title="Remover" className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
              onClick={() => { setRows((l) => (l ?? []).filter((x) => x.id !== t.id)); void deleteTaskAction(t.id); }}><Trash2 size={16} aria-hidden /></button>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 size={13} aria-hidden className="text-ok" /> Já estão salvas. Veja e conclua em <Link href={href} className="font-semibold text-accent underline underline-offset-2">Tarefas</Link>.</p>
    </section>
  );
}
