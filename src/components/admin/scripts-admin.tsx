"use client";

import { RotateCcw, ScrollText } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { restoreScriptsAction } from "@/modules/scripts/admin-actions";

export type AdminScriptRow = { id: number; title: string; goal: string; nodes: number; seed: boolean; edited: boolean; updatedAt: string };

export function ScriptsAdmin({ rows, version }: { rows: AdminScriptRow[]; version: number }) {
  const { run, pending } = useRun();
  const [all, setAll] = useState(false);
  const factory = rows.filter((r) => r.seed), custom = rows.filter((r) => !r.seed);
  return (
    <div className="space-y-5">
      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ScrollText size={18} aria-hidden /> Roteiros de fábrica</h2>
        <p className="text-sm text-muted">Versão dos textos de fábrica: <b>{version}</b>. {factory.length} roteiros de fábrica ({factory.filter((r) => r.edited).length} editados) e {custom.length} criados pela equipe. Roteiros que ninguém editou se atualizam sozinhos quando o sistema ganha uma versão nova.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => restoreScriptsAction("unedited"))}><RotateCcw size={15} aria-hidden /> Atualizar os não editados</button>
          <button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={pending} onClick={() => setAll(true)}><RotateCcw size={15} aria-hidden /> Restaurar todos (inclusive editados)</button>
          <Link href="/scripts" className={btnGhost}>Abrir editor de roteiros</Link>
        </div>
      </section>
      <section className={`${panelCls} p-5`}>
        <h3 className="mb-3 font-semibold">Todos os roteiros</h3>
        <ul className="divide-y divide-line/70 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"><b className="min-w-0 flex-1 truncate">{r.title}</b><span className="text-xs text-muted">{r.goal} · {r.nodes} passos</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.seed ? (r.edited ? "bg-warn/20" : "bg-ok/15 text-ok") : "bg-accent/15 text-accent"}`}>{r.seed ? (r.edited ? "Fábrica · editado" : "Fábrica") : "Da equipe"}</span></li>
          ))}
        </ul>
      </section>
      <ConfirmDialog open={all} tone="danger" icon={RotateCcw} title="Restaurar todos os roteiros de fábrica?" confirmLabel="Sim, restaurar" busy={pending} onCancel={() => setAll(false)} onConfirm={() => { setAll(false); run(() => restoreScriptsAction("all")); }}>
        Os roteiros de fábrica voltam ao texto original, inclusive os que você editou. Roteiros criados pela equipe não mudam. Fica registrado na auditoria.
      </ConfirmDialog>
    </div>
  );
}
