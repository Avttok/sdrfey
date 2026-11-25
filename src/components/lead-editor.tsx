"use client";

import { PersonBubble } from "@/components/person-bubble";
import { RoteiroLink } from "@/components/roteiro-link";

import { ClientIds } from "@/components/client-ids";
import { EoxInfoCard } from "@/components/eox-info";
import { StatLine, TouchTimeline } from "@/components/touch-timeline";
import { ArrowLeft, Ban, CalendarCheck, Copy, ExternalLink, Handshake, Link2, MapPin, Pencil, Phone, Plus, Tag, Trash2, RotateCcw, UnlockKeyhole, Users } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { FlashTag, TagDeck } from "@/components/attend-final";
import { useState } from "react";
import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { AttendButton } from "@/components/attend-button";
import { LeadInfoPanel } from "@/components/lead-info-panel";
import { TagChip } from "@/components/tag-chip";
import { useToast } from "@/components/toast";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { VisitRow } from "@/components/visit-row";
import { DateInput } from "@/components/date-input";
import { fmtCnpj, fmtDate, fmtDateTime, fmtPhone } from "@/lib/format";
import { addChannelAction, markWrongAction, removeChannelAction } from "@/modules/leads/actions";
import { addPersonAction, addVisitAction, deleteVisitAction, changeTagAction, forceReleaseAction, removePersonAction, setPersonStatusAction, resetLeadFromPageAction, updateLeadAction } from "@/modules/leads/edit";
import type { LeadView, TagCatalog } from "@/modules/leads/view";

export function LeadEditor({ touchCounts, adminDelete, kpis, records, afterLeft, afterRight, lead, catalog, owners, canEdit, canRelease, lockedBy, showMap, meId, sellerView, dealId, inDeal, dealSeller }: { /** Total de contatos por meio já feitos com o lead (todas as pessoas). */ touchCounts?: Partial<Record<"ligacao" | "whatsapp" | "email", number>>; adminDelete?: React.ReactNode; kpis?: React.ReactNode; records?: React.ReactNode; afterLeft?: React.ReactNode; afterRight?: React.ReactNode; dealSeller?: { name: string; hex: string } | null; inDeal?: boolean; sellerView?: boolean; dealId?: number | null; showMap: boolean; meId: number; lead: LeadView; catalog: TagCatalog; owners: { id: number; name: string }[]; canEdit: boolean; canRelease: boolean; lockedBy: { name: string; hex: string } | null }) {
  const toast = useToast();
  const active = lead.registrationStatus ? lead.registrationStatus.toUpperCase() === "ATIVA" : null;
  const name0 = lead.tradeName ?? lead.company;
  const initials = name0.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name0[0];
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const [f, setF] = useState({ company: lead.company, tradeName: lead.tradeName ?? "", city: lead.city ?? "", uf: lead.uf ?? "", ownerId: lead.ownerId, notes: lead.notes ?? "" });
  const [on, setOn] = useState(new Set(lead.tags.map((t) => `${t.groupKey}:${t.key}`)));
  const [newCh, setNewCh] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [vis, setVis] = useState({ code: "", date: "", link: "" });
  const [delVisit, setDelVisit] = useState<number | null>(null);
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
      <div className="flex flex-wrap items-center justify-between gap-2"><Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden /> Voltar para Leads</Link>{adminDelete}</div>
      <header className={`${panelCls} relative overflow-hidden p-5 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4">
          <span aria-hidden className={`grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold ${active === null ? "bg-sunk text-muted" : active ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{initials}</span>
          <div className="min-w-0 flex-1">
            <h1 className="display text-2xl leading-tight sm:text-3xl">{lead.tradeName ?? lead.company}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{fmtCnpj(lead.cnpj)}</span>
              {lead.city && <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden />{lead.city}/{lead.uf}</span>}
              {lead.registrationStatus && <b className={active ? "text-ok" : "text-danger"}>{lead.registrationStatus.toUpperCase()}</b>}
              {lead.isTest && <span className="rounded-md bg-sunk px-2 py-0.5 text-xs font-semibold">MODO TESTE</span>}
            </p>
            {lead.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{lead.tags.map((t) => <TagChip key={t.id} label={t.label} color={t.color} />)}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!sellerView && !lockedBy && inDeal && (dealSeller ? <PersonBubble name={dealSeller.name} hex={dealSeller.hex} /> : <span className="rounded-full bg-accent/12 px-3 py-1.5 text-sm font-semibold text-accent">Vendas</span>)}
            {sellerView ? (dealId ? <Link href={`/negociacoes/${dealId}`} className={btnPrimary}><Handshake size={16} aria-hidden /> Abrir negociação</Link> : null) : lockedBy ? <PersonBubble name={lockedBy.name} hex={lockedBy.hex} prefix="Em atendimento" /> : inDeal ? null : <><AttendButton leadId={lead.id} />{dealId ? <Link href={`/negociacoes/${dealId}`} className={btnGhost}><Handshake size={16} aria-hidden /> Abrir negociação</Link> : null}</>}
            <RoteiroLink leadId={lead.id} />
            {!sellerView && inDeal && !lockedBy && dealId ? <Link href={`/negociacoes/${dealId}`} className={btnGhost}><Handshake size={16} aria-hidden /> Abrir negociação</Link> : null}
            {!sellerView && canEdit && !lockedBy && <button type="button" className={`${btnGhost} !border-danger !bg-danger !text-white hover:brightness-110`} disabled={pending} onClick={() => setConfirmReset(true)}><RotateCcw size={15} aria-hidden /> Resetar lead</button>}
            {lockedBy && canRelease && <button type="button" className={btnGhost} disabled={pending} onClick={() => ask({ title: "Liberar este lead?", body: `${lockedBy?.name ?? "A pessoa"} perde o atendimento em andamento e o lead volta ao estoque.`, label: "Sim, liberar", tone: "warn", icon: UnlockKeyhole, onConfirm: () => run(() => forceReleaseAction(lead.id)) })}><UnlockKeyhole size={15} aria-hidden /> Liberar lead</button>}
          </div>
        </div>
      </header>

      {kpis}
      {dialog}
      <ConfirmDialog open={confirmReset} tone="danger" icon={RotateCcw} busy={pending} title="Resetar este lead?" confirmLabel="Sim, resetar" cancelLabel="Cancelar" onCancel={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); run(() => resetLeadFromPageAction(lead.id)); }}>
        Apaga tags (menos porte e capital), observação, interações e visitas, e devolve o lead ao estoque como novo. Os dados da empresa continuam salvos. Fica tudo registrado.
      </ConfirmDialog>
      <div className={`${panelCls} p-5 sm:p-6`}><LeadInfoPanel lead={lead} wide showMap={showMap} /></div>

      <div className="gap-5 lg:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
      <SectionCard icon={Pencil} title="Editar dados">
        <div className="grid gap-3 sm:grid-cols-2">
          {input("company", "Razão social", true)}{input("tradeName", "Nome fantasia")}{input("city", "Cidade")}{input("uf", "UF")}
          {!sellerView && (<label className="block text-sm"><span className="mb-1 block text-muted">Responsável</span><select className={inputCls} disabled={!canEdit} value={f.ownerId ?? ""} onChange={(e) => setF({ ...f, ownerId: e.target.value ? Number(e.target.value) : null })}><option value="">Sem responsável</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}
          <label className="block text-sm sm:col-span-2"><span className="mb-1 block text-muted">Observação</span><textarea className={`${inputCls} min-h-24`} disabled={!canEdit} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        </div>
        <p className="text-xs text-muted">Situação cadastral: {lead.registrationStatus ?? "sem informação"}{lead.enrichedAt ? ` · consultada em ${fmtDate(lead.enrichedAt)}` : ""}</p>
        {canEdit && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateLeadAction(lead.id, { company: f.company, tradeName: f.tradeName || null, city: f.city || null, uf: f.uf || null, ownerId: f.ownerId, notes: f.notes || null }))}>Salvar dados</button>}
      </SectionCard>


      {afterLeft}
      <SectionCard icon={Link2} title="Na EOX"><EoxInfoCard info={lead.eoxInfo} syncedAt={lead.eoxSyncedAt} /></SectionCard>
      <SectionCard icon={Link2} title="Ids do cliente"><ClientIds leadId={lead.id} eoxId={lead.eoxId} eoxCode={lead.eoxCode} sfId={lead.sfId} eoxUrl={lead.eoxUrl} /></SectionCard>

      <SectionCard icon={Phone} title="Contatos feitos"><TouchTimeline rows={lead.touches.rows} /></SectionCard>

      <SectionCard icon={Phone} title="Contatos">
        <ul className="space-y-1.5">
          {lead.channels.map((c) => (
            <li key={c.id} className={`flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm ${c.wrong ? "line-through opacity-60" : ""}`}>
              <span className="flex-1 break-all">{c.kind === "phone" ? fmtPhone(c.value) : c.value} <span className="text-xs text-muted">{c.origin !== "import" ? c.origin : ""}</span><br />{lead.touches.stats.filter((x) => x.target === (c.kind === "phone" ? c.value.replace(/\D/g, "") : c.value.toLowerCase()) && (c.kind === "email") === (x.channel === "email")).map((x) => <span key={x.channel} className="mr-2"><StatLine stat={x} /></span>)}</span>
              <button type="button" aria-label="Copiar" onClick={() => copy(c.value)}><Copy size={15} /></button>
              {canEdit && <><button type="button" aria-label="Marcar como errado" onClick={() => run(() => markWrongAction(lead.id, c.id, !c.wrong))}><Ban size={15} /></button>
              <button type="button" aria-label="Remover" onClick={() => ask({ title: "Remover este contato?", body: `${c.kind === "phone" ? fmtPhone(c.value) : c.value} será removido do cadastro do lead.`, label: "Sim, remover", icon: Trash2, onConfirm: () => run(() => removeChannelAction(lead.id, c.id), "Contato removido.") })}><Trash2 size={15} /></button></>}
            </li>
          ))}
          {lead.channels.length === 0 && <li className="text-sm text-muted">Nenhum contato.</li>}
        </ul>
        {canEdit && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = newCh.trim(); if (v) run(() => addChannelAction(lead.id, v.includes("@") ? "email" : "phone", v), undefined, () => setNewCh("")); }}><input className={inputCls} placeholder="Novo telefone ou e-mail" value={newCh} onChange={(e) => setNewCh(e.target.value)} /><button type="submit" className={btnGhost} disabled={pending}><Plus size={15} aria-hidden /> Adicionar</button></form>}
      </SectionCard>

      <SectionCard icon={Users} title="Pessoas">
        <ul className="space-y-1.5">
          {lead.people.map((x) => <li key={x.id} className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm"><span className="flex-1">{x.name}{x.roleTitle ? ` · ${x.roleTitle}` : ""}{x.extension ? ` · ramal ${x.extension}` : ""}{x.status !== "ativo" && <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold">{x.status === "saiu" ? "Não trabalha mais lá" : "Contato inválido"}</span>}</span>{canEdit && <select aria-label={`Situação de ${x.name}`} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" value={x.status} onChange={(e) => run(() => setPersonStatusAction(lead.id, x.id, e.target.value as "ativo" | "saiu" | "invalido"))}><option value="ativo">Ativo</option><option value="saiu">Não trabalha mais lá</option><option value="invalido">Número/e-mail inválido</option></select>}{canEdit && <button type="button" aria-label="Remover pessoa" onClick={() => ask({ title: "Remover esta pessoa?", body: `${x.name} será removida dos contatos deste lead.`, label: "Sim, remover", icon: Trash2, onConfirm: () => run(() => removePersonAction(lead.id, x.id)) })}><Trash2 size={15} /></button>}</li>)}
          {lead.people.length === 0 && <li className="text-sm text-muted">Nenhuma pessoa cadastrada.</li>}
        </ul>
        {canEdit && <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run(() => addPersonAction(lead.id, { name: p.name, roleTitle: p.roleTitle || null, extension: p.extension || null }), undefined, () => setP({ name: "", roleTitle: "", extension: "" })); }}><input className={inputCls} placeholder="Nome" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /><input className={inputCls} placeholder="Cargo" value={p.roleTitle} onChange={(e) => setP({ ...p, roleTitle: e.target.value })} /><input className={inputCls} placeholder="Ramal" value={p.extension} onChange={(e) => setP({ ...p, extension: e.target.value })} /><button type="submit" className={btnGhost} disabled={pending}><Plus size={15} aria-hidden /> Adicionar</button></form>}
      </SectionCard>
      {!sellerView && <SectionCard icon={CalendarCheck} title={`Visitas${lead.visits.length ? ` (${lead.visits.length})` : ""}`}>
        <ul className="space-y-2">
          {lead.visits.map((v) => <VisitRow key={v.id} leadId={lead.id} v={v} canManage={canEdit || v.byUserId === meId} onDelete={() => setDelVisit(v.id)} />)}
          {lead.visits.length === 0 && <li className="text-sm text-muted">Nenhuma visita agendada para este lead.</li>}
        </ul>
        {(
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addVisitAction(lead.id, { code: vis.code, visitDate: vis.date, link: vis.link || null }), undefined, () => setVis({ code: "", date: "", link: "" })); }}>
            <label className="block min-w-36 flex-1 text-sm"><span className="mb-1 block text-muted">Código</span><input className={inputCls} placeholder="V-12345" value={vis.code} onChange={(e) => setVis({ ...vis, code: e.target.value })} /></label>
            <div className="block w-44 text-sm"><span className="mb-1 block text-muted">Data da visita</span><DateInput label="Data da visita" value={vis.date} onChange={(d) => setVis({ ...vis, date: d })} /></div>
            <label className="block min-w-48 flex-[2] text-sm"><span className="mb-1 block text-muted">Link da visita (opcional)</span><input className={inputCls} placeholder="https://…" value={vis.link} onChange={(e) => setVis({ ...vis, link: e.target.value })} /></label>
            <button type="submit" className={btnGhost} disabled={pending}><Plus size={15} aria-hidden /> Adicionar visita</button>
          </form>
        )}
      </SectionCard>}
      <ConfirmDialog open={delVisit !== null} tone="danger" icon={Trash2} busy={pending} title="Apagar esta visita?" confirmLabel="Sim, apagar" cancelLabel="Cancelar" onCancel={() => setDelVisit(null)}
        onConfirm={() => { const id = delVisit!; setDelVisit(null); run(() => deleteVisitAction(lead.id, id)); }}>
        O registro da visita é removido do lead e da aba Visitas. A ação fica no Registro de atividades.
      </ConfirmDialog>
      {afterRight}
      </div>
      <SectionCard icon={Tag} title="Tags">
        {!(canEdit && !sellerView) && <p className="text-xs text-muted">Somente leitura: quem atende o lead ou a gestão altera as tags.</p>}
        {catalog.filter((g) => g.tags.length).map((g) => {
          const n = g.tags.filter((t) => on.has(`${g.key}:${t.key}`)).length;
          return (
            <TagDeck key={g.key} title={g.name} hint={g.exclusive ? "escolha 1" : "marque o que se aplica"} count={n} total={g.tags.length}>
              {g.tags.map((t) => <FlashTag key={t.key} label={t.label} color={t.color} on={on.has(`${g.key}:${t.key}`)} times={touchCounts && t.key in touchCounts ? touchCounts[t.key as "ligacao"] ?? 0 : undefined} disabled={!(canEdit && !sellerView) || pending} onClick={() => toggleTag(g.key, t.key, g.exclusive)} />)}
            </TagDeck>
          );
        })}
      </SectionCard>
      {records}
    </div>
  );
}
