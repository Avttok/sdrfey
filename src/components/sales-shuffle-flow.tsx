"use client";

import { LeadLinks } from "@/components/lead-links";
import { Building2, Check, ExternalLink, Mail, MessageCircle, Pause, SkipForward, ThumbsDown, PhoneOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EoxIcon, SalesforceIcon } from "@/components/brand-icons";
import { ClientHistoryView } from "@/components/deals/client-history";
import { SectionCard } from "@/components/section-card";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { MailAction, PhoneActions } from "@/components/channel-actions";
import type { ClientHistory } from "@/modules/deals/history";
import { finishSalesShuffleAction, openDealFromShuffleAction, startSalesShuffleAction } from "@/modules/sales/actions";

/** Lead inativo na mão do vendedor: dados de contato, histórico completo e o que fazer com ele. */
export function SalesShuffleFlow({ shuffleId, h }: { shuffleId: number; h: ClientHistory }) {
  const { run, pending } = useRun();
  const router = useRouter();
  const [note, setNote] = useState("");
  const l = h.lead;
  const next = (outcome: "no_answer" | "no_interest" | "skipped") => run(async () => { const r = await finishSalesShuffleAction(shuffleId, outcome, note); if (r.ok) await startSalesShuffleAction(); return r; });
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <section className={`${panelCls} space-y-4 p-5`}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent"><Building2 size={22} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h1 className="display break-words text-xl leading-tight sm:text-[22px]">{l.company}</h1>
              <p className="text-sm text-muted">{[l.tradeName, l.city && `${l.city}/${l.uf}`, l.contactName, l.sapCode && `SAP ${l.sapCode}`].filter(Boolean).join(" · ") || "Sem dados de contato"}</p>
            </div>
            <span className="rounded-full bg-accent/12 px-3 py-1 text-xs font-semibold text-accent">Inativo</span>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Telefones</p>
              {l.phones.length === 0 && <p className="text-muted">Nenhum telefone.</p>}
              {l.phones.map((p) => (
                <p key={p}><PhoneActions lead={{ id: l.id, eoxUrl: l.eoxUrl }} value={p} label={l.tradeName ?? l.company} /></p>
              ))}
              {l.email && <p className="pt-1"><MailAction leadId={l.id} email={l.email} label={l.tradeName ?? l.company} /></p>}
            </div>
            <div className="grid grid-cols-2 content-start gap-2">
              <div className="col-span-2"><LeadLinks lead={l} compact={false} /></div>
              <a href={`/leads/${l.id}`} target="_blank" rel="noreferrer" className={`${btnGhost} col-span-2 w-full`}><ExternalLink size={15} aria-hidden /> Abrir o lead completo</a>
            </div>
          </div>
        </section>
        <SectionCard icon={Building2} title="Histórico do cliente"><ClientHistoryView h={h} /></SectionCard>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <SectionCard icon={Check} title="E aí?">
          <textarea className={`${inputCls} min-h-28`} aria-label="Anotação" placeholder="Anotação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={pending} onClick={() => run(async () => { const r = await openDealFromShuffleAction(shuffleId, note); if (r.ok && r.dealId) router.push(`/negociacoes/${r.dealId}`); return r; })}><Check size={16} aria-hidden /> Abrir negociação</button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnGhost} disabled={pending} onClick={() => next("no_answer")}><PhoneOff size={15} aria-hidden /> Sem contato</button>
            <button type="button" className={btnGhost} disabled={pending} onClick={() => next("no_interest")}><ThumbsDown size={15} aria-hidden /> Sem interesse</button>
            <button type="button" className={btnGhost} disabled={pending} onClick={() => next("skipped")}><SkipForward size={15} aria-hidden /> Pular</button>
            <button type="button" className={btnGhost} disabled={pending} onClick={() => run(async () => { const r = await finishSalesShuffleAction(shuffleId, "released", note); if (r.ok) { router.replace("/shuffler-vendas"); router.refresh(); } return r; })}><Pause size={15} aria-hidden /> Pausar</button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
