"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { ChevronDown, Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { RichEditor } from "@/components/rich-editor";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { htmlToText, TEMPLATE_VARIABLES } from "@/modules/email/render";
import { deleteTemplateAction, saveTemplateAction } from "@/modules/admin/config";

export type TplRow = { id?: number; name: string; subject: string; body: string; bodyHtml: string | null; active: boolean };

function Card({ t, isNew }: { t: TplRow; isNew?: boolean }) {
  const [f, setF] = useState(t);
  const [rk, setRk] = useState(0);
  const [open, setOpen] = useState(!!isNew);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  return (
    <li className={`${panelCls} overflow-hidden ${f.active ? "" : "opacity-70"}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-grad-soft text-accent">{isNew ? <Plus size={18} aria-hidden /> : <Mail size={18} aria-hidden />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{isNew ? "Novo modelo" : f.name || "Sem nome"}</span><span className="block truncate text-xs text-muted">{isNew ? "Clique para criar um modelo de e-mail" : f.subject || "Sem assunto"}</span></span>
        {!isNew && !f.active && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">Inativo</span>}
        <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && <div className="space-y-2 border-t border-line p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Nome<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="text-sm">Assunto<input className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
      </div>
      <div className="text-sm"><p className="mb-1">Texto do e-mail</p>
        <RichEditor key={rk} value={f.bodyHtml ?? f.body.split("\n").map((l) => `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "<br>"}</div>`).join("")} onChange={(h) => setF((c) => ({ ...c, bodyHtml: h, body: htmlToText(h) }))} />
        <p className="mt-1 text-xs text-muted">Negrito, fontes, cores, tamanhos e imagens valem ao usar “Copiar e-mail formatado” no atendimento. O botão “Abrir e-mail” usa só o texto (limite do e-mail pelo navegador).</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativo</label>
        <span className="flex-1" />
        <button type="button" className={isNew ? btnPrimary : btnGhost} disabled={pending} onClick={() => run(() => saveTemplateAction({ ...f, id: t.id }), undefined, () => { if (isNew) { setF(t); setRk((n) => n + 1); } })}>{isNew ? <><Plus size={15} aria-hidden /> Criar modelo</> : "Salvar"}</button>
        {!isNew && <button type="button" aria-label="Excluir modelo" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir este modelo?", body: `O modelo "${t.name}" será excluído e não poderá mais ser usado nos atendimentos.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteTemplateAction(t.id!)) })}><Trash2 size={15} /></button>}
      </div>
      </div>}
      {dialog}
    </li>
  );
}

export function TemplatesAdmin({ rows }: { rows: TplRow[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Variáveis: {TEMPLATE_VARIABLES.map((v) => `{${v}}`).join(" ")}. Com alternativa para quando faltar o dado: <code>{"{contato|tudo bem}"}</code>.</p>
      <ul className="space-y-3">{rows.map((t) => <Card key={t.id} t={t} />)}<Card isNew t={{ name: "", subject: "", body: "", bodyHtml: "", active: true }} /></ul>
    </div>
  );
}
