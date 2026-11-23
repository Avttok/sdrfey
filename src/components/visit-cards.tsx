"use client";

import Link from "next/link";
import { RoteiroLink } from "@/components/roteiro-link";
import { CalendarCheck, LayoutGrid, List, Check, CheckCircle2, Clock, Globe, Users, Mail, MapPin, Pencil, Phone, Save, StickyNote, UserRound, UserRoundCheck, X } from "lucide-react";
import { useState } from "react";
import { BrandLink, SalesforceIcon } from "@/components/brand-icons";
import { PersonBubble } from "@/components/person-bubble";
import { VisitCodeChip, VisitStatusChip } from "@/components/visit-row";
import { Modal } from "@/components/modal";
import { Pill, Segmented } from "@/components/filter-ui";
import { DateInput } from "@/components/date-input";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { setVisitStatusAction, updateVisitAction } from "@/modules/leads/edit";
import { fmtDate, fmtDateTime } from "@/lib/format";

export type VisitCard = {
  id: number; code: string; status: "pendente" | "confirmada" | "realizada" | "cancelada"; canceled: boolean; kind: "rep" | "seller";
  visitDate: string | null; link: string | null; at: string; note: string | null; confirmedAt: string | null;
  repName: string | null; repSap: string | null; repCity: string | null; repKm: number | null; sellerName: string | null;
  leadId: number; company: string; city: string | null; uf: string | null; sfUrl: string | null; eoxUrl: string | null;
  by: { name: string; hex: string } | null;
  isPublic: boolean; /** Como a visita chegou até quem está olhando. */ relation: "mine" | "public" | "shared" | "team";
  cnpj: string | null; phones: string[]; email: string | null; contactName: string | null; roleTitle: string | null; canManage: boolean;
};

const STRIP = { pendente: "bg-warn", confirmada: "bg-accent", realizada: "bg-ok", cancelada: "bg-danger" } as const;

/** Agrupa por urgência: hoje, amanhã, próximas, atrasadas (ainda abertas), realizadas e canceladas. */
function bucket(list: VisitCard[]) {
  const defs = [
    { key: "today", title: "Hoje", dot: "bg-accent", items: [] as VisitCard[] },
    { key: "tomorrow", title: "Amanhã", dot: "bg-accent", items: [] as VisitCard[] },
    { key: "next", title: "Próximas", dot: "bg-ok", items: [] as VisitCard[] },
    { key: "late", title: "Atrasadas (ainda abertas)", dot: "bg-warn", items: [] as VisitCard[] },
    { key: "nodate", title: "Sem data informada", dot: "bg-muted", items: [] as VisitCard[] },
    { key: "done", title: "Realizadas", dot: "bg-ok", items: [] as VisitCard[] },
    { key: "canceled", title: "Canceladas", dot: "bg-danger", items: [] as VisitCard[] },
  ];
  const by = Object.fromEntries(defs.map((g) => [g.key, g]));
  for (const c of list) {
    if (c.canceled) { by.canceled.items.push(c); continue; }
    if (c.status === "realizada") { by.done.items.push(c); continue; }
    if (!c.visitDate) { by.nodate.items.push(c); continue; }
    const d = dayDiff(c.visitDate);
    (d === 0 ? by.today : d === 1 ? by.tomorrow : d > 1 ? by.next : by.late).items.push(c);
  }
  by.next.items.sort((a, b) => (a.visitDate ?? "").localeCompare(b.visitDate ?? ""));
  return defs.filter((g) => g.items.length);
}

/** Lista de visitas em cartões; clicar abre o popup com tudo da visita (sem sair da tela). */
export function VisitCards({ list, openId }: { list: VisitCard[]; openId?: number | null }) {
  const [open, setOpen] = useState<number | null>(openId ?? null);
  const v = list.find((x) => x.id === open) ?? null;
  const set = (id: number | null) => {
    setOpen(id);
    try { const u = new URL(location.href); id ? u.searchParams.set("v", String(id)) : u.searchParams.delete("v"); history.replaceState(null, "", u); } catch { /* sem URL */ }
  };
  const [st, setSt] = useState<"" | VisitCard["status"]>("");
  const [view, setView] = useState<"grupos" | "lista">("grupos");
  const statusOf = (c: VisitCard): VisitCard["status"] => (c.canceled ? "cancelada" : c.status);
  const counts = { "": list.length, pendente: 0, confirmada: 0, realizada: 0, cancelada: 0 } as Record<string, number>;
  for (const c of list) counts[statusOf(c)]++;
  const shown = st ? list.filter((c) => statusOf(c) === st) : list;
  const groups = view === "lista" ? [{ key: "all", title: "Todas as visitas", dot: "bg-accent", items: [...shown].sort((a, b) => (b.visitDate ?? "").localeCompare(a.visitDate ?? "")) }].filter((g) => g.items.length) : bucket(shown);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-label="Andamento da visita" className="flex flex-wrap gap-1.5">
          {([["", "Todas"], ["pendente", "Aguardando"], ["confirmada", "Confirmadas"], ["realizada", "Realizadas"], ["cancelada", "Canceladas"]] as const).map(([k, l]) => (counts[k] > 0 || k === "") && <Pill key={k} on={st === k} count={counts[k]} onClick={() => setSt(k)}>{l}</Pill>)}
        </div>
        <span className="flex-1" />
        <Segmented label="Jeito de ver" value={view} onChange={setView} options={[["grupos", "Por data", <LayoutGrid key="g" size={14} aria-hidden />], ["lista", "Lista", <List key="l" size={14} aria-hidden />]] as const} />
      </div>
      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nenhuma visita com esse andamento.</p>}
      <div className="space-y-7">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <h2 className="mb-3 flex items-center gap-2.5 text-sm font-bold">
              <span className={`size-2.5 rounded-full ${g.dot}`} aria-hidden />{g.title}
              <span className="figure rounded-full bg-sunk px-2 py-0.5 text-xs font-semibold text-muted">{g.items.length}</span>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((c, i) => {
                const d = c.visitDate ? new Date(`${c.visitDate}T12:00:00`) : null;
                const st = c.canceled ? "cancelada" : c.status;
                return (
                  <li key={c.id} style={{ "--i": i % 12 } as React.CSSProperties} className="card-in">
                    <button type="button" onClick={() => set(c.id)} className={`${panelCls} lift group relative flex h-full w-full gap-4 overflow-hidden p-4 text-left ${c.canceled ? "opacity-60" : ""}`}>
                      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${STRIP[st]}`} />
                      <span aria-hidden className="ml-1 flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-grad text-on-accent shadow-md">
                        {d ? <><span className="text-[10px] font-bold uppercase leading-none tracking-wider opacity-85">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span><span className="figure text-2xl font-bold leading-none">{d.getDate()}</span><span className="text-[10px] font-medium uppercase leading-none opacity-85">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span></> : <CalendarCheck size={24} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <VisitCodeChip code={c.code} />
                          <span className="flex flex-wrap items-center gap-1.5">
                            {c.isPublic && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent"><Globe size={11} aria-hidden /> Pública</span>}
                            {c.relation === "shared" && !c.isPublic && <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok"><Users size={11} aria-hidden /> Compartilhada</span>}
                            <VisitStatusChip status={st} />
                          </span>
                        </div>
                        <p className="mt-2 font-semibold leading-snug">{c.company}</p>
                        {(c.city || c.uf) && <p className="text-sm text-muted">{[c.city, c.uf].filter(Boolean).join(" / ")}</p>}
                        {!c.visitDate && <p className="mt-1 flex items-center gap-1.5 text-sm font-medium"><CalendarCheck size={15} className="text-accent" aria-hidden /> Data da visita não informada</p>}
                        {c.kind === "seller" && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted"><UserRoundCheck size={13} className="mt-0.5 shrink-0" aria-hidden /><span>Vendedores SDR: <b className="font-medium text-ink">{c.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce</span></p>}
                        {c.repName && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden /><span>Representante: <b className="font-medium text-ink">{c.repName}</b>{c.repKm != null ? ` · ${c.repKm} km` : ""}{c.repCity ? ` · ${c.repCity}` : ""}</span></p>}
                        {c.link && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#0070d2" }}><SalesforceIcon size={12} /> Tem link do Salesforce</span>}
                        {c.note && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.note}</p>}
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                          {c.by ? <span className="flex min-w-0 items-center gap-2"><span className="text-muted/80">Agendada por</span><PersonBubble name={c.by.name} hex={c.by.hex} /></span> : <span />}
                          <span className="shrink-0 whitespace-nowrap">em {fmtDateTime(c.at)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
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

const dayDiff = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(new Date().toDateString() + " 12:00:00").getTime()) / 86_400_000);
const fmtCnpj = (d: string) => (d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d);
const fmtPhone = (d: string) => (d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : d.length === 10 ? d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : d);

/** Popup da visita: tudo sobre a visita e o cliente; quem pode, edita e confirma sem sair da tela. */
function VisitDialog({ v, onClose }: { v: VisitCard; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "", note: v.note ?? "", pub: v.isPublic });
  const { run, pending } = useRun();
  const status = v.canceled ? "cancelada" : v.status;
  const next = v.status === "pendente" ? "confirmada" : v.status === "confirmada" ? "realizada" : null;
  const d = v.visitDate ? dayDiff(v.visitDate) : null;
  const when = d === null ? null : d === 0 ? { t: "Hoje", cls: "text-accent" } : d === 1 ? { t: "Amanhã", cls: "text-accent" } : d > 1 ? { t: `Em ${d} dias`, cls: "text-ink" } : { t: `${-d} ${-d === 1 ? "dia" : "dias"} atrás`, cls: v.status === "realizada" ? "text-muted" : "text-warn" };
  const steps = [
    { k: "Agendada", at: v.at, done: true },
    { k: "Confirmada", at: v.confirmedAt, done: v.status === "confirmada" || v.status === "realizada" },
    { k: "Realizada", at: null, done: v.status === "realizada" },
  ];
  return (
    <Modal onClose={onClose} locked={editing} size="lg" label={`Visita ${v.code}`} title={v.company}
      subtitle={[v.city && v.uf ? `${v.city} / ${v.uf}` : v.city || v.uf, v.cnpj ? `CNPJ ${fmtCnpj(v.cnpj)}` : null].filter(Boolean).join(" · ")}
      badges={<><VisitCodeChip code={v.code} /><VisitStatusChip status={status} />{when && <span className={`text-sm font-semibold ${when.cls}`}>{when.t}</span>}</>}
      footer={!editing ? <>

        {next && <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => setVisitStatusAction(v.leadId, v.id, next), undefined, onClose)}><CheckCircle2 size={16} aria-hidden /> {next === "confirmada" ? "Confirmar visita" : "Marcar como realizada"}</button>}
        {v.status !== "pendente" && <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => setVisitStatusAction(v.leadId, v.id, "pendente"), undefined, onClose)}>Voltar para aguardando</button>}
        <button type="button" className={btnGhost} onClick={() => setEditing(true)}><Pencil size={15} aria-hidden /> Editar visita</button>
        <span className="flex-1" />
        <RoteiroLink leadId={v.leadId} area="sdr" />
        <Link href={`/leads/${v.leadId}`} className={v.canManage && !v.canceled ? btnGhost : btnPrimary}>Ir para o perfil do cliente</Link>
      </> : undefined}>
      <div className="space-y-4">
        {!v.canceled && (
          <ol className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-sunk/40 p-3 text-center text-xs">
            {steps.map((st) => (
              <li key={st.k} className={st.done ? "text-ink" : "text-muted"}>
                <span className={`mx-auto mb-1 grid size-7 place-items-center rounded-full ${st.done ? "bg-ok text-white" : "bg-sunk"}`}>{st.done ? <Check size={14} aria-hidden /> : <Clock size={13} aria-hidden />}</span>
                <b className="block font-semibold">{st.k}</b>
                <span className="block text-muted">{st.at ? fmtDateTime(st.at) : st.done ? "" : "—"}</span>
              </li>
            ))}
          </ol>
        )}

        {editing ? (
          <div className="space-y-3 rounded-xl border-2 border-accent/40 bg-sunk p-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-muted">Código</span><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
              <div className="block"><span className="mb-1 block text-muted">Data da visita</span><DateInput label="Data da visita" value={f.date} onChange={(x) => setF({ ...f, date: x })} /></div>
              <label className="block sm:col-span-2"><span className="mb-1 block text-muted">Link da visita (Salesforce, opcional)</span><input className={inputCls} placeholder="https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel p-3 sm:col-span-2"><input type="checkbox" className="mt-0.5" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} /><span><span className="flex items-center gap-1.5 font-semibold"><Globe size={14} aria-hidden /> Visita pública</span><span className="text-xs text-muted">Todos os usuários, de qualquer cargo, veem esta visita.</span></span></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-muted">Observação</span><textarea className={`${inputCls} min-h-24`} maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => updateVisitAction(v.leadId, v.id, { code: f.code, visitDate: f.date, link: f.link || null, note: f.note, isPublic: f.pub }), "Visita atualizada.", () => { setEditing(false); onClose(); })}><Save size={15} aria-hidden /> Salvar alterações</button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => { setEditing(false); setF({ code: v.code, date: v.visitDate ?? "", link: v.link ?? "", note: v.note ?? "", pub: v.isPublic }); }}><X size={15} aria-hidden /> Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <dl className="divide-y divide-line rounded-xl border border-line bg-sunk/40 px-3.5">
              <Row icon={CalendarCheck} label="Data da visita"><b className="font-semibold">{v.visitDate ? fmtDate(v.visitDate) : "Não informada"}</b></Row>
              <Row icon={UserRound} label="Agendada">{fmtDateTime(v.at)}{v.by && <> <span className="text-muted">por</span> <PersonBubble name={v.by.name} hex={v.by.hex} /></>}</Row>
              {v.kind === "seller" && <Row icon={UserRoundCheck} label="Vendedores SDR"><b className="font-semibold">{v.sellerName ?? "Grupo dos vendedores"}</b> entra pelo Salesforce e confirma</Row>}
              {v.repName && <Row icon={MapPin} label="Representante"><b className="font-semibold">{v.repName}</b>{v.repSap ? ` · SAP ${v.repSap}` : ""}{v.repCity ? ` · ${v.repCity}` : ""}{v.repKm != null ? ` · ${v.repKm} km` : ""}</Row>}
              {v.confirmedAt && !v.canceled && <Row icon={UserRoundCheck} label="Confirmada">{fmtDateTime(v.confirmedAt)}</Row>}
              <Row icon={StickyNote} label="Observação">{v.note ? <span className="whitespace-pre-wrap">{v.note}</span> : <span className="text-muted">Sem observação</span>}</Row>
            </dl>
            <dl className="divide-y divide-line rounded-xl border border-line bg-sunk/40 px-3.5">
              <Row icon={UserRound} label="Contato">{v.contactName ? <><b className="font-semibold">{v.contactName}</b>{v.roleTitle ? <span className="text-muted"> · {v.roleTitle}</span> : null}</> : <span className="text-muted">Sem contato cadastrado</span>}</Row>
              <Row icon={Phone} label="Telefones">{v.phones.length ? <span className="flex flex-wrap gap-x-3 gap-y-1">{v.phones.slice(0, 4).map((t) => <a key={t} href={`tel:+55${t}`} className="font-medium hover:underline">{fmtPhone(t)}</a>)}</span> : <span className="text-muted">—</span>}</Row>
              <Row icon={Mail} label="E-mail">{v.email ? <a href={`mailto:${v.email}`} className="break-all font-medium hover:underline">{v.email}</a> : <span className="text-muted">—</span>}</Row>
              <Row icon={MapPin} label="Local">{[v.city, v.uf].filter(Boolean).join(" / ") || "—"}</Row>
            </dl>
          </div>
        )}

        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            {v.link && <BrandLink kind="sf" href={v.link} label="Abrir visita" />}
            {v.sfUrl && <BrandLink kind="sf" href={v.sfUrl} label="Perfil no Salesforce" />}
            {v.eoxUrl && <BrandLink kind="eox" href={v.eoxUrl} />}
          </div>
        )}

      </div>
    </Modal>
  );
}
