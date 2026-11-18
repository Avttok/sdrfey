"use client";

import { ArrowLeft, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { STAGE_META, fmtBRL } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import { fmtCnpj, fmtDateTime } from "@/lib/format";
import { deleteRecordAction } from "@/modules/admin/purge";
import type { LeadHit, LeadRecords } from "@/modules/admin/purge-data";
import type { RecordKind } from "@/modules/admin/purge-spec";
import { CONFIRM_WORD } from "@/modules/admin/purge-spec";
import { TypedConfirm } from "./purge-confirm";

const base = "/admin/apagar?tab=registro";

export function LeadSearch({ q, hits }: { q: string; hits: LeadHit[] }) {
  return (
    <div className="space-y-4">
      <form method="get" action="/admin/apagar" className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="registro" />
        <label className="min-w-60 flex-1"><span className="sr-only">Buscar lead</span>
          <input name="q" defaultValue={q} className={inputCls} placeholder="Nome da empresa, CNPJ ou cidade" autoComplete="off" /></label>
        <button type="submit" className={btnPrimary}><Search size={16} aria-hidden /> Buscar</button>
      </form>
      {q && hits.length === 0 && <p className="rounded-xl bg-sunk px-4 py-6 text-center text-sm text-muted">Nenhum lead encontrado para “{q}”.</p>}
      {!q && <p className="rounded-xl bg-sunk px-4 py-6 text-center text-sm text-muted">Busque um lead para ver e apagar cada registro dele: negociações, cotações, visitas, interações, contatos e tags. Cobre também apagar o lead inteiro.</p>}
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.id}>
            <Link href={`${base}&q=${encodeURIComponent(q)}&lead=${h.id}`} className={`${panelCls} flex flex-wrap items-center gap-x-4 gap-y-1 p-3 transition-colors hover:bg-sunk`}>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.company}{h.isTest && <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">teste</span>}</span>
                <span className="block text-xs text-muted">{fmtCnpj(h.cnpj)}{h.city ? ` · ${h.city}${h.uf ? `/${h.uf}` : ""}` : ""}</span></span>
              <span className="text-xs text-muted">{h.deals} negoc. · {h.visits} visitas · {h.interactions} interações</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Row = { kind: RecordKind; id: number; id2?: number; title: string; sub?: string };

export function LeadRecordsView({ data, q }: { data: LeadRecords; q: string }) {
  const router = useRouter();
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const [wipe, setWipe] = useState(false);
  const [withHistory, setWithHistory] = useState(false);
  const stage = (s: string) => STAGE_META[s as DealStage]?.label ?? s;

  const del = (r: Row) => ask({ title: "Apagar este registro?", body: <>{r.title}{r.sub ? ` · ${r.sub}` : ""}. Fica uma cópia dele no Registro.</>, label: "Sim, apagar", icon: Trash2, onConfirm: () => run(() => deleteRecordAction({ kind: r.kind, id: r.id, id2: r.id2 }), undefined, () => router.refresh(), "Apagando…") });

  const sections: { title: string; note?: string; rows: Row[] }[] = [
    { title: "Negociações", note: "Leva junto cotações e andamentos.", rows: data.deals.map((d) => ({ kind: "deal", id: d.id, title: `${stage(d.stage)}${d.valueCents ? ` · ${fmtBRL(d.valueCents)}` : ""}`, sub: `vendedor ${d.seller ?? "—"} · SDR ${d.sdr ?? "—"} · ${fmtDateTime(d.at)}` })) },
    { title: "Cotações", rows: data.quotes.map((x) => ({ kind: "quote", id: x.id, title: `Cotação ${x.number ?? "s/n"}${x.totalCents ? ` · ${fmtBRL(x.totalCents)}` : ""}`, sub: fmtDateTime(x.at) })) },
    { title: "Visitas", rows: data.visits.map((v) => ({ kind: "visit", id: v.id, title: `${v.code}${v.date ? ` · ${v.date.split("-").reverse().join("/")}` : ""}`, sub: `${v.canceled ? "cancelada" : v.status}${v.by ? ` · por ${v.by}` : ""}` })) },
    { title: "Interações", rows: data.interactions.map((i) => ({ kind: "interaction", id: i.id, title: `${i.channel} · ${fmtDateTime(i.at)}`, sub: [i.by ? `por ${i.by}` : null, i.note].filter(Boolean).join(" · ") || undefined })) },
    { title: "Atendimentos (sessões)", rows: data.sessions.map((s) => ({ kind: "session", id: s.id, title: fmtDateTime(s.at), sub: `${s.by ?? "—"} · ${s.outcome ?? "em aberto"}` })) },
    { title: "Tags", rows: data.tags.map((t) => ({ kind: "tag", id: data.lead.id, id2: t.tagId, title: t.label, sub: t.group })) },
    { title: "Telefones e e-mails", rows: data.channels.map((c) => ({ kind: "channel", id: c.id, title: c.value, sub: c.kind === "phone" ? "telefone" : "e-mail" })) },
    { title: "Pessoas de contato", rows: data.people.map((p) => ({ kind: "person", id: p.id, title: p.name, sub: p.role ?? undefined })) },
  ];

  return (
    <div className="space-y-5">
      <Link href={`${base}&q=${encodeURIComponent(q)}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"><ArrowLeft size={15} aria-hidden /> Voltar à busca</Link>
      <header className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
        <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{data.lead.company}</h2>
          <p className="text-sm text-muted">{fmtCnpj(data.lead.cnpj)}{data.lead.city ? ` · ${data.lead.city}${data.lead.uf ? `/${data.lead.uf}` : ""}` : ""}</p></div>
        <button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={pending} onClick={() => setWipe(true)}><Trash2 size={15} aria-hidden /> Apagar lead inteiro</button>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title} className={`${panelCls} space-y-2 p-4`}>
            <h3 className="flex items-baseline gap-2 text-sm font-semibold">{s.title}<span className="rounded-full bg-sunk px-2 py-0.5 text-xs font-normal text-muted">{s.rows.length}</span></h3>
            {s.note && <p className="text-xs text-muted">{s.note}</p>}
            {s.rows.length === 0 ? <p className="text-sm text-muted">Nada aqui.</p> : (
              <ul className="max-h-72 divide-y divide-line overflow-auto rounded-xl border border-line">
                {s.rows.map((r) => (
                  <li key={`${r.kind}-${r.id}-${r.id2 ?? ""}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.title}</span>{r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}</span>
                    <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg text-danger transition-colors hover:bg-danger/10" disabled={pending} aria-label={`Apagar: ${r.title}`} onClick={() => del(r)}><Trash2 size={16} aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {dialog}
      <TypedConfirm open={wipe} word={CONFIRM_WORD} busy={pending} label="Apagar lead" title={`Apagar ${data.lead.company}?`} onCancel={() => setWipe(false)}
        onConfirm={() => { setWipe(false); run(() => deleteRecordAction({ kind: "lead", id: data.lead.id, withHistory }), undefined, () => router.replace(`${base}&q=${encodeURIComponent(q)}`), "Apagando…"); }}>
        <p>O cadastro e tudo ligado a ele serão apagados: {data.deals.length} negociação(ões), {data.quotes.length} cotação(ões), {data.visits.length} visita(s), {data.interactions.length} interação(ões), tags, contatos e atendimentos.</p>
        <label className="flex items-center gap-2 text-ink"><input type="checkbox" className="size-4" checked={withHistory} onChange={(e) => setWithHistory(e.target.checked)} /> Apagar também o histórico (Registro) deste lead</label>
        <p>Não dá para desfazer.</p>
      </TypedConfirm>
    </div>
  );
}
