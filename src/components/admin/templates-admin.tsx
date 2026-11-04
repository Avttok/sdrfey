"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { TEMPLATE_VARIABLES } from "@/modules/email/render";
import { deleteTemplateAction, saveTemplateAction } from "@/modules/admin/config";

export type TplRow = { id?: number; name: string; subject: string; body: string; active: boolean };

function Card({ t, isNew }: { t: TplRow; isNew?: boolean }) {
  const [f, setF] = useState(t);
  const { run, pending } = useRun();
  return (
    <li className={`${panelCls} space-y-2 p-4`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Nome<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="text-sm">Assunto<input className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
      </div>
      <label className="block text-sm">Texto<textarea className={`${inputCls} min-h-36`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo</label>
        <span className="flex-1" />
        <button type="button" className={isNew ? btnPrimary : btnGhost} disabled={pending} onClick={() => run(() => saveTemplateAction({ ...f, id: t.id }), undefined, () => isNew && setF(t))}>{isNew ? <><Plus size={15} aria-hidden /> Criar modelo</> : "Salvar"}</button>
        {!isNew && <button type="button" aria-label="Excluir modelo" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => { if (confirm(`Excluir o modelo ${t.name}?`)) run(() => deleteTemplateAction(t.id!)); }}><Trash2 size={15} /></button>}
      </div>
    </li>
  );
}

export function TemplatesAdmin({ rows }: { rows: TplRow[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Variáveis: {TEMPLATE_VARIABLES.map((v) => `{${v}}`).join(" ")}. Com alternativa para quando faltar o dado: <code>{"{contato|tudo bem}"}</code>.</p>
      <ul className="space-y-3">{rows.map((t) => <Card key={t.id} t={t} />)}<Card isNew t={{ name: "", subject: "", body: "", active: true }} /></ul>
    </div>
  );
}
