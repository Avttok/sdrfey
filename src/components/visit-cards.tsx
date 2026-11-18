"use client";

import Link from "next/link";
import { CalendarCheck, MapPin, UserRound, UserRoundCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandLink, SalesforceIcon } from "@/components/brand-icons";
import { PersonBubble } from "@/components/person-bubble";
import { VisitCodeChip, VisitStatusChip } from "@/components/visit-row";
import { btnPrimary, panelCls } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";

export type VisitCard = {
  id: number; code: string; status: "pendente" | "confirmada" | "realizada" | "cancelada"; canceled: boolean; kind: "rep" | "seller";
  visitDate: string | null; link: string | null; at: string; note: string | null; confirmedAt: string | null;
  repName: string | null; repSap: string | null; repCity: string | null; repKm: number | null; sellerName: string | null;
  leadId: number; company: string; city: string | null; uf: string | null; sfUrl: string | null; eoxUrl: string | null;
  by: { name: string; hex: string } | null;
};

/** Lista de visitas em cartões; clicar abre o popup com tudo da visita (sem sair da tela). */
export function VisitCards({ list, openId }: { list: VisitCard[]; openId?: number | null }) {
  const [open, setOpen] = useState<number | null>(openId ?? null);
  const v = list.find((x) => x.id === open) ?? null;
  const set = (id: number | null) => {
    setOpen(id);
    try { const u = new URL(location.href); id ? u.searchParams.set("v", String(id)) : u.searchParams.delete("v"); history.replaceState(null, "", u); } catch { /* sem URL */ }
  };
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => set(c.id)} className={`${panelCls} group relative block h-full w-full overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg ${c.canceled ? "opacity-60" : ""}`}>
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-grad" />
              <div className="flex items-center justify-between gap-3">
                <VisitCodeChip code={c.code} />
                <VisitStatusChip status={c.canceled ? "cancelada" : c.status} />
              </div>
              <p className="mt-3 font-semibold leading-snug">{c.company}</p>
              {(c.city || c.uf) && <p className="text-sm text-muted">{[c.city, c.uf].filter(Boolean).join(" / ")}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium"><CalendarCheck size={15} className="text-accent" aria-hidden /> {c.visitDate ? `Visita em ${fmtDate(c.visitDate)}` : "Data da visita não informada"}</p>
              {c.kind === "seller" && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted"><UserRoundCheck size={13} className="mt-0.5 shrink-0" aria-hidden /><span>Vendedores SDR: <b className="font-medium text-ink">{c.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce</span></p>}
              {c.repName && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden /><span>Representante: <b className="font-medium text-ink">{c.repName}</b>{c.repKm != null ? ` · ${c.repKm} km` : ""}{c.repCity ? ` · ${c.repCity}` : ""}</span></p>}
              {c.link && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#0070d2" }}><SalesforceIcon size={12} /> Tem link do Salesforce</span>}
              {c.note && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.note}</p>}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                {c.by ? <span className="flex min-w-0 items-center gap-2"><span className="text-muted/80">Agendada por</span><PersonBubble name={c.by.name} hex={c.by.hex} /></span> : <span />}
                <span className="shrink-0 whitespace-nowrap">em {fmtDateTime(c.at)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {v && <VisitDialog v={v} onClose={() => set(null)} />}
    </>
  );
}

function Row({ icon: I, label, children }: { icon: typeof UserRound; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 py-2 text-sm">
      <dt className="inline-flex items-center gap-1.5 text-muted"><I size={14} aria-hidden /> {label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function VisitDialog({ v, onClose }: { v: VisitCard; onClose: () => void }) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Visita ${v.code}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><VisitCodeChip code={v.code} /><VisitStatusChip status={v.canceled ? "cancelada" : v.status} /></div>
            <h2 className="display break-words text-xl">{v.company}</h2>
            {(v.city || v.uf) && <p className="text-sm text-muted">{[v.city, v.uf].filter(Boolean).join(" / ")}</p>}
          </div>
          <button type="button" aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-sunk" onClick={onClose}><X size={18} /></button>
        </div>
        <dl className="divide-y divide-line rounded-xl border border-line bg-sunk/40 px-3.5">
          <Row icon={CalendarCheck} label="Data da visita"><b className="font-semibold">{v.visitDate ? fmtDate(v.visitDate) : "Não informada"}</b></Row>
          <Row icon={UserRound} label="Agendada">{fmtDateTime(v.at)}{v.by && <> <span className="text-muted">por</span> <PersonBubble name={v.by.name} hex={v.by.hex} /></>}</Row>
          {v.kind === "seller" && <Row icon={UserRoundCheck} label="Vendedores SDR"><b className="font-semibold">{v.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce e confirma</Row>}
          {v.repName && <Row icon={MapPin} label="Representante"><b className="font-semibold">{v.repName}</b>{v.repSap ? ` · SAP ${v.repSap}` : ""}{v.repCity ? ` · ${v.repCity}` : ""}{v.repKm != null ? ` · ${v.repKm} km` : ""}</Row>}
          {v.confirmedAt && !v.canceled && <Row icon={UserRoundCheck} label="Confirmada">{fmtDateTime(v.confirmedAt)}</Row>}
          {v.note && <Row icon={UserRound} label="Observação"><span className="whitespace-pre-wrap">{v.note}</span></Row>}
        </dl>
        <div className="flex flex-wrap gap-2">
          {v.link && <BrandLink kind="sf" href={v.link} label="Abrir visita" />}
          {v.sfUrl && <BrandLink kind="sf" href={v.sfUrl} label="Perfil no Salesforce" />}
          {v.eoxUrl && <BrandLink kind="eox" href={v.eoxUrl} />}
        </div>
        <Link href={`/leads/${v.leadId}`} className={`${btnPrimary} w-full`}>Ir para o perfil do cliente</Link>
      </div>
    </div>
  );
}
