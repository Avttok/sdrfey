"use client";

import { History, Undo2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { fmtDateTime } from "@/lib/format";
import { undoImportBatchAction, type BatchRow } from "@/modules/import/history";

const KIND: Record<string, string> = { leads: "Leads novos", inativos: "Leads inativos", reps: "Representantes", deals: "Negociações", carriers: "Transportadoras" };

export function ImportHistory({ rows }: { rows: BatchRow[] }) {
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  return (
    <section className={`${panelCls} overflow-hidden`}>
      <header className="flex items-center gap-2 border-b border-line bg-sunk/60 px-4 py-3"><History size={17} className="text-accent" aria-hidden /><h2 className="font-semibold">Histórico de importações</h2><span className="text-xs text-muted">últimas {rows.length}</span></header>
      {rows.length === 0 ? <p className="p-4 text-sm text-muted">Nenhuma importação registrada ainda.</p> : (
        <ul className="divide-y divide-line/70">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.fileName}</p><p className="text-xs text-muted">{KIND[r.kind] ?? r.kind} · {r.user ?? "—"} · {fmtDateTime(new Date(r.at))}</p></div>
              <p className="figure text-xs text-muted">{r.total.toLocaleString("pt-BR")} no arquivo · <b className="text-ink">{r.inserted.toLocaleString("pt-BR")}</b> entraram · {r.skipped.toLocaleString("pt-BR")} pulados</p>
              {r.undoneAt ? <span className="rounded-full bg-sunk px-2.5 py-1 text-xs text-muted">Desfeito · {r.undoneCount} apagados</span>
                : r.canUndo ? <button type="button" className={btnGhost} disabled={pending} onClick={() => ask({ title: "Desfazer esta importação?", body: `Apaga os leads criados por ${r.fileName} que ninguém trabalhou ainda${r.touched ? ` (${r.touched} já foram trabalhados e ficam)` : ""}. Não dá para refazer.`, label: "Sim, desfazer", icon: Undo2, tone: "warn", onConfirm: () => run(() => undoImportBatchAction(r.id)) })}><Undo2 size={14} aria-hidden /> Desfazer</button> : null}
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </section>
  );
}
