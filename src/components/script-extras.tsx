"use client";

import { Check, Mic, NotebookPen, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";

/** Com quem se fala agora, sempre à vista: dá para corrigir o nome a qualquer momento (digitou errado na correria). */
export function SpeakerRow({ name, canFixSaved, onRename }: { name: string; /** o nome está guardado como contato do lead: oferece corrigir lá também */ canFixSaved: boolean; onRename: (name: string, alsoSaved: boolean) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  const [also, setAlso] = useState(true);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!edit) setV(name); }, [name, edit]);
  useEffect(() => { if (edit) ref.current?.select(); }, [edit]);
  const done = () => { const n = v.trim(); if (n && n !== name.trim()) onRename(n, canFixSaved && also); setEdit(false); };
  if (!edit) return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-sunk px-3 py-2 text-sm">
      <Mic size={14} aria-hidden className="text-accent" />
      <span className="text-muted">Falando com</span>
      <b className="min-w-0 truncate">{name.trim() || "ninguém ainda"}</b>
      <button type="button" onClick={() => setEdit(true)} className={`${btnGhost} !min-h-8 !px-2.5 !py-1 !text-xs`}><Pencil size={13} aria-hidden /> {name.trim() ? "Corrigir nome" : "Informar nome"}</button>
    </div>
  );
  return (
    <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent/5 p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={ref} value={v} maxLength={80} autoFocus aria-label="Nome de quem está falando" className={`${inputCls} min-w-40 flex-1`} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } if (e.key === "Escape") setEdit(false); }} />
        <button type="button" onClick={done} className={`${btnPrimary} !min-h-9 !px-3`}><Check size={15} aria-hidden /> Salvar</button>
        <button type="button" onClick={() => setEdit(false)} className={`${btnGhost} !min-h-9 !px-3`} aria-label="Cancelar"><X size={15} aria-hidden /></button>
      </div>
      {canFixSaved && <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} /> Corrigir também o contato guardado no lead (desmarque se for outra pessoa)</label>}
    </div>
  );
}

/** Formulário da observação livre: entra na observação do lead e no histórico do roteiro. */
export function ObservationForm({ onAdd, onClose }: { onAdd: (text: string) => void; onClose: () => void }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim().slice(0, 200); if (!t) return; onAdd(t); setV(""); };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-sunk/50 p-2.5">
      <NotebookPen size={15} aria-hidden className="shrink-0 text-muted" />
      <input autoFocus value={v} maxLength={200} aria-label="Observação" placeholder="Ex.: pediu retorno às 15h, o dono é o Carlos" className={`${inputCls} min-w-40 flex-1`} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") onClose(); }} />
      <button type="button" onClick={add} disabled={!v.trim()} className={`${btnPrimary} !min-h-9 !px-3`}><Plus size={15} aria-hidden /> Adicionar</button>
      <button type="button" onClick={onClose} className={`${btnGhost} !min-h-9 !px-3`} aria-label="Fechar"><X size={15} aria-hidden /></button>
    </div>
  );
}

/** Observação livre a qualquer momento da conversa (versão com botão próprio, para telas sem o painel de contatos). */
export function ObservationBox({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className={btnGhost} onClick={() => setOpen(true)}><NotebookPen size={15} aria-hidden /> Anotar observação</button>;
  return <ObservationForm onAdd={onAdd} onClose={() => setOpen(false)} />;
}
