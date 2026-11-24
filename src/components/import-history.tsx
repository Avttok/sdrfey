"use client";

import { History, Pencil, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { fmtDateTime } from "@/lib/format";
import { editImportBatchAction } from "@/modules/import/batch-edit";
import { undoImportBatchAction, type BatchRow } from "@/modules/import/history";

const KIND: Record<string, string> = { leads: "Leads novos", inativos: "Leads inativos", reps: "Representantes", deals: "Negociações", carriers: "Transportadoras", eox: "Planilhas da EOX" };

export function ImportHistory({ rows }: { rows: BatchRow[] }) {
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const [editing, setEditing] = useState<number | null>(null);
  const [f, setF] = useState({ name: "", kind: "", source: "", changeSource: false });
  return (
    <section className={`${panelCls} overflow-hidden`}>
      <header className="flex items-center gap-2 border-b border-line bg-sunk/60 px-4 py-3"><History size={17} className="text-accent" aria-hidden /><h2 className="font-semibold">Histórico de importações</h2><span className="text-xs text-muted">últimas {rows.length}</span></header>
      {rows.length === 0 ? <p className="p-4 text-sm text-muted">Nenhuma importação registrada ainda.</p> : (
        <ul className="divide-y divide-line/70">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.fileName}</p><p className="text-xs text-muted">{KIND[r.kind] ?? r.kind} · {r.user ?? "—"} · {fmtDateTime(new Date(r.at))}</p></div>
              <p className="figure text-xs text-muted">{r.total.toLocaleString("pt-BR")} no arquivo · <b className="text-ink">{r.inserted.toLocaleString("pt-BR")}</b> entraram · {r.skipped.toLocaleString("pt-BR")} pulados</p>
              <div className="flex items-center gap-1.5">
                {(r.kind === "leads" || r.kind === "inativos") && !r.undoneAt && <Link href={`/leads?lote=${r.id}`} className={btnGhost}><Users size={14} aria-hidden /> Ver leads</Link>}
                <button type="button" className={btnGhost} onClick={() => { setEditing(editing === r.id ? null : r.id); setF({ name: r.fileName, kind: "", source: "", changeSource: false }); }}><Pencil size={14} aria-hidden /> Editar</button>
              </div>
              {r.undoneAt ? <span className="rounded-full bg-sunk px-2.5 py-1 text-xs text-muted">Desfeito · {r.undoneCount} {r.kind === "eox" ? "leads revertidos" : "apagados"}</span>
                : r.canUndo ? <button type="button" className={btnGhost} disabled={pending} onClick={() => ask({ title: "Desfazer esta importação?", body: r.kind === "eox" ? `Os leads alterados por ${r.fileName} voltam ao que eram antes (Ids, endereço, telefones, retrato da EOX e contatos importados). Leads criados que ninguém trabalhou são apagados.` : `Apaga os leads criados por ${r.fileName} que ninguém trabalhou ainda${r.touched ? ` (${r.touched} já foram trabalhados e ficam)` : ""}. Não dá para refazer.`, label: "Sim, desfazer", icon: Undo2, tone: "warn", onConfirm: () => run(() => undoImportBatchAction(r.id)) })}><Undo2 size={14} aria-hidden /> Desfazer</button> : null}
            {editing === r.id && (
                <div className="basis-full space-y-3 rounded-xl border border-line bg-sunk/50 p-3">
                  <label className="block text-xs font-semibold text-muted">Nome da importação<input className={`${inputCls} mt-1`} value={f.name} maxLength={160} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
                  {(r.kind === "leads" || r.kind === "inativos") && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-muted">Tipo de todos os leads desta importação<select className={`${inputCls} mt-1`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="">Não mudar</option><option value="prospect">Prospecção (novos)</option><option value="inativo">Inativo (já clientes)</option></select></label>
                      <label className="block text-xs font-semibold text-muted">Origem dos leads (campo “source”)<input className={`${inputCls} mt-1`} placeholder="Não mudar" value={f.source} maxLength={80} onChange={(e) => setF({ ...f, source: e.target.value, changeSource: true })} /></label>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" disabled={pending || !f.name.trim()} className={btnPrimary} onClick={() => run(() => editImportBatchAction({ id: r.id, fileName: f.name, leadKind: (f.kind || null) as "prospect" | "inativo" | null, source: f.changeSource ? f.source : null }), "Importação atualizada.", () => setEditing(null))}>Salvar</button>
                    <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </section>
  );
}
