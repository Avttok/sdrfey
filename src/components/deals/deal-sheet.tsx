"use client";

import { Building2, CalendarClock, ChevronDown, ExternalLink, FileText, Mail, MapPin, MessageCircle, Phone, StickyNote, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtBRL, OPEN_STAGES, STAGE_META } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import { fmtDate, fmtPhone } from "@/lib/format";
import { claimDealAction, logContactAction, setStageAction } from "@/modules/deals/actions";
import type { DealRow } from "@/modules/deals/queries";
import { AlertChip, StageChip } from "./deal-ui";

type Kind = "ligacao" | "whatsapp" | "email" | "nota";
const KINDS: [Kind, string, typeof Phone][] = [["ligacao", "Ligação", Phone], ["whatsapp", "WhatsApp", MessageCircle], ["email", "E-mail", Mail], ["nota", "Nota", StickyNote]];
const isOpen = (d: DealRow) => d.stage !== "ganho" && d.stage !== "perdido";

/** Uma negociação como "linha" da planilha: tudo à vista e editável ali mesmo, mas em cartão. */
function Row({ d, meId, canClaim }: { d: DealRow; meId: number; canClaim: boolean }) {
  const { run, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [kinds, setKinds] = useState<Kind[]>(["ligacao"]);
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const editable = isOpen(d);
  const stageList: DealStage[] = OPEN_STAGES.includes(d.stage) ? OPEN_STAGES : [...OPEN_STAGES, d.stage];
  const send = () => run(() => logContactAction(d.id, { kinds, note, nextAt: next || null, nextNote: null }), undefined, () => { setOpen(false); setNote(""); setNext(""); });
  return (
    <li className="rounded-2xl border border-line/70 bg-panel/80 transition hover:border-accent/40" style={d.color ? { background: `color-mix(in srgb, ${d.color} 10%, var(--panel))` } : undefined}>
      <div className="grid items-center gap-x-3 gap-y-2 p-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)_7.5rem_8rem_auto]">
        <div>{editable ? <select aria-label="Etapa" disabled={pending} value={d.stage} onChange={(e) => run(() => setStageAction(d.id, e.target.value as DealStage))} className={`${inputCls} !py-1.5 !text-sm font-semibold`} style={{ borderColor: STAGE_META[d.stage].color }}>{stageList.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}</select> : <StageChip stage={d.stage} />}</div>
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-x-3 text-sm"><span className="figure inline-flex items-center gap-1 font-medium"><FileText size={13} aria-hidden className="text-muted" />{d.quoteNumber ? `Cot. ${d.quoteNumber}` : "Sem cotação"}</span>{d.quoteDate && <span className="text-xs text-muted">{fmtDate(d.quoteDate)}</span>}{d.paymentTerms && <span className="rounded-md bg-sunk px-1.5 py-0.5 text-xs text-muted">{d.paymentTerms}</span>}{d.freight && <span className="rounded-md bg-sunk px-1.5 py-0.5 text-xs font-semibold text-muted">{d.freight}</span>}</p>
          {(d.alerts.length > 0) && <span className="flex flex-wrap gap-1">{d.alerts.map((a) => <AlertChip key={a.kind} a={a} />)}</span>}
        </div>
        <p className="figure text-right text-base font-bold text-accent sm:text-lg">{d.mainCents ? fmtBRL(d.mainCents) : <span className="text-sm font-normal text-muted">sem valor</span>}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted" title={d.nextActionNote ?? undefined}>{d.nextActionAt ? <><CalendarClock size={13} aria-hidden className="shrink-0" />{fmtDate(d.nextActionAt)}</> : <span>Sem próximo passo</span>}</p>
        <div className="flex items-center justify-end gap-1.5">
          {!d.sellerId && canClaim && editable && <button type="button" disabled={pending} onClick={() => run(() => claimDealAction(d.id))} className={`${btnPrimary} !px-2.5 !py-1.5 !text-xs`}><UserPlus size={13} aria-hidden /> Assumir</button>}
          {editable && <button type="button" aria-expanded={open} aria-label="Registrar contato" onClick={() => setOpen(!open)} className={`${btnGhost} !px-2.5 !py-1.5`}><StickyNote size={14} aria-hidden /><ChevronDown size={13} aria-hidden className={`transition ${open ? "rotate-180" : ""}`} /></button>}
          <Link href={`/negociacoes/${d.id}`} aria-label="Abrir negociação" className={`${btnGhost} !px-2.5 !py-1.5`}><ExternalLink size={14} aria-hidden /></Link>
        </div>
      </div>
      {open && (
        <div className="card-in space-y-2 border-t border-line/60 p-2.5">
          <div className="flex flex-wrap gap-1.5">{KINDS.map(([k, l, Icon]) => <button key={k} type="button" aria-pressed={kinds.includes(k)} onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${kinds.includes(k) ? "border-accent bg-accent/15 text-accent" : "border-line bg-sunk/60 text-muted"}`}><Icon size={13} aria-hidden />{l}</button>)}</div>
          <div className="flex flex-wrap gap-2"><input aria-label="Anotação" className={`${inputCls} !w-auto min-w-48 flex-1`} placeholder="O que foi falado?" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /><input aria-label="Próximo passo em" type="date" className={`${inputCls} !w-auto`} value={next} onChange={(e) => setNext(e.target.value)} /><button type="button" className={btnPrimary} disabled={pending || kinds.length === 0} onClick={send}>Registrar</button></div>
        </div>
      )}
    </li>
  );
}

/** Planilha em cards: o cliente vira um painel horizontal e as negociações dele ficam empilhadas como linhas. */
export function DealSheet({ deals, meId, canClaim }: { deals: DealRow[]; meId: number; canClaim: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<number, DealRow[]>();
    for (const d of deals) m.set(d.leadId, [...(m.get(d.leadId) ?? []), d]);
    return [...m.values()].map((list) => ({ list, total: list.filter(isOpen).reduce((a, d) => a + (d.mainCents ?? 0), 0), alert: list.some((d) => d.alerts.some((a) => a.tone === "danger")) })).sort((a, b) => Number(b.alert) - Number(a.alert) || b.total - a.total);
  }, [deals]);
  if (!groups.length) return <p className={`${panelCls} p-8 text-center text-sm text-muted`}>Nenhuma negociação nesta visão.</p>;
  return (
    <ul className="space-y-4">
      {groups.map(({ list, total }) => {
        const h = list[0];
        return (
          <li key={h.leadId} className={`${panelCls} card-in space-y-2.5 p-3`}>
            <header className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
              <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-grad-soft text-accent"><Building2 size={17} /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold" title={h.company}>{h.company}</p><p className="flex flex-wrap gap-x-3 text-xs text-muted">{h.city && <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden />{h.city}/{h.uf}</span>}{h.phone && <span className="inline-flex items-center gap-1"><Phone size={11} aria-hidden />{fmtPhone(h.phone)}</span>}{h.contactName && <span>{h.contactName}</span>}<span className="figure">{h.cnpj}</span></p></div>
              <p className="text-right text-xs text-muted"><b className="figure block text-base text-ink">{total ? fmtBRL(total) : "—"}</b>{list.length} {list.length === 1 ? "negociação" : "negociações"} · {h.sellerId === meId ? "você" : h.sellerName ?? "sem vendedor"}</p>
            </header>
            <ul className="space-y-1.5">{list.map((d) => <Row key={d.id} d={d} meId={meId} canClaim={canClaim} />)}</ul>
          </li>
        );
      })}
    </ul>
  );
}
