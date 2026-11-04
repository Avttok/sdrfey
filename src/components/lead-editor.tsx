"use client";

import { Ban, Copy, Plus, Trash2, UnlockKeyhole } from "lucide-react";
import { useState } from "react";
import { AttendButton } from "@/components/attend-button";
import { TagChip } from "@/components/tag-chip";
import { useToast } from "@/components/toast";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtCnpj, fmtDate, fmtPhone } from "@/lib/format";
import { addChannelAction, markWrongAction, removeChannelAction } from "@/modules/leads/actions";
import { addPersonAction, cancelVisitAction, changeTagAction, forceReleaseAction, removePersonAction, updateLeadAction } from "@/modules/leads/edit";
import type { LeadView, TagCatalog } from "@/modules/leads/view";

export function LeadEditor({ lead, catalog, owners, canEdit, canRelease, lockedByName }: { lead: LeadView; catalog: TagCatalog; owners: { id: number; name: string }[]; canEdit: boolean; canRelease: boolean; lockedByName: string | null }) {
  const toast = useToast();
  const { run, pending } = useRun();
  const [f, setF] = useState({ company: lead.company, tradeName: lead.tradeName ?? "", city: lead.city ?? "", uf: lead.uf ?? "", ownerId: lead.ownerId, notes: lead.notes ?? "" });
  const [on, setOn] = useState(new Set(lead.tags.map((t) => `${t.groupKey}:${t.key}`)));
  const [newCh, setNewCh] = useState("");
  const [p, setP] = useState({ name: "", roleTitle: "", extension: "" });

  const toggleTag = (g: string, k: string, exclusive: boolean) => {
    const ref = `${g}:${k}`;
    const has = on.has(ref);
    const next = new Set(on);
    if (has) next.delete(ref);
    else { if (exclusive) for (const x of [...next]) if (x.startsWith(`${g}:`)) next.delete(x); next.add(ref); }
    setOn(next);
    run(() => changeTagAction(lead.id, has ? { remove: [{ group: g, key: k }] } : { add: [{ group: g, key: k }] }), "Tag atualizada.");
  };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast("info", `Copiado: ${t}`); } catch { toast("warn", "Não consegui copiar."); } };
  const input = (k: keyof typeof f, label: string, wide = false) => <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1 block text-muted">{label}</span><input className={inputCls} disabled={!canEdit} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-2xl sm:text-3xl">{lead.tradeName ?? lead.company}</h1>
        <span className="text-sm text-muted">{fmtCnpj(lead.cnpj)}</span>
        <span className="flex-1" />
        {lockedByName ? <span className="text-sm text-muted">Em atendimento: {lockedByName}</span> : <AttendButton leadId={lead.id} />}
        {lockedByName && canRelease && <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => forceReleaseAction(lead.id))}><UnlockKeyhole size={15} aria-hidden /> Liberar lead</button>}
      </div>

      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="display text-xl">Dados</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("company", "Razão social", true)}{input("tradeName", "Nome fantasia")}{input("city", "Cidade")}{input("uf", "UF")}
          <label className="block text-sm"><span className="mb-1 block text-muted">Responsável</span><select className={inputCls} disabled={!canEdit} value={f.ownerId ?? ""} onChange={(e) => setF({ ...f, ownerId: e.target.value ? Number(e.target.value) : null })}><option value="">Sem responsável</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label className="block text-sm sm:col-span-2"><span className="mb-1 block text-muted">Observação</span><textarea className={`${inputCls} min-h-24`} disabled={!canEdit} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <p className="text-xs text-muted">Situação cadastral: {lead.registrationStatus ?? "sem informação"}{lead.enrichedAt ? ` · consultada em ${fmtDate(lead.enrichedAt)}` : ""}</p>
        {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateLeadAction(lead.id, { company: f.company, tradeName: f.tradeName || null, city: f.city || null, uf: f.uf || null, ownerId: f.ownerId, notes: f.notes || null }))}>Salvar dados</button>}
      </section>

      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="display text-xl">Tags</h2>
        {catalog.filter((g) => g.tags.length).map((g) => (
          <div key={g.key}><p className="mb-1.5 text-sm font-medium">{g.name}</p>
            <div className="flex flex-wrap gap-1.5">{g.tags.map((t) => <TagChip key={t.key} label={t.label} color={t.color} on={on.has(`${g.key}:${t.key}`)} onClick={canEdit ? () => toggleTag(g.key, t.key, g.exclusive) : undefined} />)}</div></div>
        ))}
      </section>

      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="display text-xl">Contatos</h2>
        <ul className="space-y-1.5">
          {lead.channels.map((c) => (
            <li key={c.id} className={`flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm ${c.wrong ? "line-through opacity-60" : ""}`}>
              <span className="flex-1 break-all">{c.kind === "phone" ? fmtPhone(c.value) : c.value} <span className="text-xs text-muted">{c.origin !== "import" ? c.origin : ""}</span></span>
              <button type="button" aria-label="Copiar" onClick={() => copy(c.value)}><Copy size={15} /></button>
              {canEdit && <><button type="button" aria-label="Marcar como errado" onClick={() => run(() => markWrongAction(lead.id, c.id, !c.wrong))}><Ban size={15} /></button>
              <button type="button" aria-label="Remover" onClick={() => run(() => removeChannelAction(lead.id, c.id), "Contato removido.")}><Trash2 size={15} /></button></>}
            </li>
          ))}
          {lead.channels.length === 0 && <li className="text-sm text-muted">Nenhum contato.</li>}
        </ul>
        {canEdit && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = newCh.trim(); if (v) run(() => addChannelAction(lead.id, v.includes("@") ? "email" : "phone", v), undefined, () => setNewCh("")); }}><input className={inputCls} placeholder="Novo telefone ou e-mail" value={newCh} onChange={(e) => setNewCh(e.target.value)} /><button type="submit" className={btnGhost} disabled={pending}><Plus size={15} aria-hidden /> Adicionar</button></form>}
      </section>

      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="display text-xl">Pessoas e visitas</h2>
        <ul className="space-y-1.5">
          {lead.people.map((x) => <li key={x.id} className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm"><span className="flex-1">{x.name}{x.roleTitle ? ` · ${x.roleTitle}` : ""}{x.extension ? ` · ramal ${x.extension}` : ""}</span>{canEdit && <button type="button" aria-label="Remover pessoa" onClick={() => run(() => removePersonAction(lead.id, x.id))}><Trash2 size={15} /></button>}</li>)}
          {lead.people.length === 0 && <li className="text-sm text-muted">Nenhuma pessoa cadastrada.</li>}
        </ul>
        {canEdit && <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run(() => addPersonAction(lead.id, { name: p.name, roleTitle: p.roleTitle || null, extension: p.extension || null }), undefined, () => setP({ name: "", roleTitle: "", extension: "" })); }}><input className={inputCls} placeholder="Nome" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /><input className={inputCls} placeholder="Cargo" value={p.roleTitle} onChange={(e) => setP({ ...p, roleTitle: e.target.value })} /><input className={inputCls} placeholder="Ramal" value={p.extension} onChange={(e) => setP({ ...p, extension: e.target.value })} /><button type="submit" className={btnGhost} disabled={pending}><Plus size={15} aria-hidden /> Adicionar pessoa</button></form>}
        <ul className="space-y-1 text-sm">{lead.visits.map((v) => <li key={v.at} className="flex items-center gap-2"><span className="rounded-md bg-sunk px-2 py-0.5 text-xs">{v.code}</span>{fmtDate(v.at)}{v.canceled ? " (cancelada)" : canEdit && <button type="button" className="text-danger underline" onClick={() => run(() => cancelVisitAction(lead.id, v.code))}>cancelar</button>}</li>)}</ul>
      </section>
    </div>
  );
}
