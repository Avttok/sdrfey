"use client";

import { Ban, Building2, CalendarClock, Clock, Copy, Delete, ExternalLink, History, Loader2, Mail, MapPin, MessageCircle, Phone, PhoneCall, PhoneOff, ScrollText, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { callNumber } from "@/components/call-number";
import { estadoLabel, Timer } from "@/components/call-ui";
import { ClientIds } from "@/components/client-ids";
import { EoxInfoCard } from "@/components/eox-info";
import { useToast } from "@/components/toast";
import { OutcomeChip } from "@/components/touch-timeline";
import { useVocall } from "@/components/vocall-provider";
import { dueFromDays, toLocalInput } from "@/config/tasks";
import { chatproUrl, fmtPhone } from "@/lib/format";
import { lastCallTouch, trackTouch } from "@/lib/touch-bus";
import { createTaskAction } from "@/modules/tasks/actions";
import { lookupPhoneAction, type PhoneLead } from "@/modules/vocall/lookup";

const KEYS: [string, string][] = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
const STAGE: Record<string, string> = { novo: "Negociação nova", contato: "Em contato", cotacao: "Cotação enviada" };
const RECENT_KEY = "fey:phone-recent";
type Recent = { digits: string; label: string };
type Tab = "dial" | "lead" | "recent";

const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "#";
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`; };

/** Reconhece o lead pelo número: espera a pessoa parar de digitar, evita pedidos repetidos e descarta resposta velha. */
function useLead(digits: string) {
  const [state, setState] = useState<{ key: string; leads: PhoneLead[] } | null>(null);
  const seq = useRef(0);
  const key = digits.length >= 8 ? digits : "";
  useEffect(() => {
    if (!key) return;
    const n = ++seq.current;
    const t = setTimeout(() => { lookupPhoneAction(key).then((r) => { if (n === seq.current) setState({ key, leads: r }); }).catch(() => { if (n === seq.current) setState({ key, leads: [] }); }); }, 350);
    return () => clearTimeout(t);
  }, [key]);
  const ready = !!key && state?.key === key;
  return { leads: ready ? state!.leads : [], loading: !!key && !ready };
}

const Chip = ({ tone, children }: { tone: "accent" | "ok" | "danger" | "muted"; children: React.ReactNode }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${{ accent: "bg-accent/12 text-accent", ok: "bg-ok/15 text-ok", danger: "bg-danger/15 text-danger", muted: "bg-sunk text-muted" }[tone]}`}>{children}</span>
);

/** Faixa compacta do lead reconhecido, na aba Discar. */
function LeadStrip({ lead, onOpen }: { lead: PhoneLead; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-sunk/60 p-2.5 text-left transition hover:border-accent">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-grad text-sm font-black text-on-accent">{initials(lead.tradeName ?? lead.company)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold leading-tight">{lead.tradeName ?? lead.company}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip tone="accent">{lead.kind === "inativo" ? "Cliente" : "Prospecção"}</Chip>
          {lead.person && <Chip tone="ok">{lead.person.name.split(" ")[0]}{lead.person.role ? ` · ${lead.person.role}` : ""}</Chip>}
          {lead.touch && <span className="text-[11px] text-muted">{lead.touch.attempts}× · {lead.touch.lastOutcome ? "" : "sem resultado · "}{ago(lead.touch.lastAt)}</span>}
        </span>
      </span>
      <span className="text-xs font-semibold text-accent">Ficha</span>
    </button>
  );
}

/** Ficha completa do lead: dados, todos os números (com ligar e WhatsApp), tarefas e Ids. */
function LeadSheet({ lead, others, onPick, onDial }: { lead: PhoneLead; others: PhoneLead[]; onPick: (l: PhoneLead) => void; onDial: (digits: string, personName: string | null) => void }) {
  const { roteiroOn } = useVocall();
  const place = [lead.city, lead.uf].filter(Boolean).join(" / ");
  const row = "flex items-start gap-2 text-sm";
  const phones = lead.channels.filter((c) => c.kind === "phone");
  const emails = lead.channels.filter((c) => c.kind === "email" && !c.wrong);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad text-base font-black text-on-accent">{initials(lead.tradeName ?? lead.company)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{lead.tradeName ?? lead.company}</p>
          {lead.tradeName && <p className="truncate text-xs text-muted" title={lead.company}>{lead.company}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5"><Chip tone="accent">{lead.kind === "inativo" ? "Cliente (Vendas)" : "Prospecção"}</Chip>{lead.dealStage && <Chip tone="ok">{STAGE[lead.dealStage] ?? lead.dealStage}</Chip>}</div>
        </div>
      </div>
      {lead.person && <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm"><UserRound size={15} className="shrink-0 text-ok" aria-hidden /><span><b>{lead.person.name}</b>{lead.person.role && <span className="text-muted"> · {lead.person.role}</span>}<span className="text-muted"> · costuma atender neste número</span></span></p>}
      {lead.touch && <p className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"><History size={15} className="shrink-0 text-muted" aria-hidden /><span>Este número: <b>{lead.touch.attempts}</b> ligação(ões)</span><OutcomeChip channel="call" outcome={lead.touch.lastOutcome} /><span className="text-xs text-muted">{ago(lead.touch.lastAt)}</span></p>}
      <EoxInfoCard info={lead.eoxInfo} compact />
      <div className="space-y-1">
        {place && <p className={row}><MapPin size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />{place}</p>}
        {lead.contactName && <p className={row}><UserRound size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span>{lead.contactName}{lead.roleTitle && <span className="text-muted"> · {lead.roleTitle}</span>}</span></p>}
        <p className={row}><History size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span className="text-muted">{lead.timesServed ? `Já atendido ${lead.timesServed}×` : "Ainda não atendido"}{lead.ownerName && ` · Responsável: ${lead.ownerName.split(" ")[0]}`}</span></p>
      </div>
      {phones.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted">Números e contatos</p>
          {phones.map((p) => (
            <div key={p.value} className={`flex items-center gap-2 rounded-xl border border-line px-2.5 py-1.5 ${p.wrong ? "opacity-50" : ""}`}>
              <span className="min-w-0 flex-1"><span className={`figure block text-sm font-semibold ${p.wrong ? "line-through" : ""}`}>{fmtPhone(p.value)}</span>{p.person && <span className="block truncate text-xs text-muted">{p.person}</span>}</span>
              {!p.wrong && <>
                <button type="button" onClick={() => onDial(p.value, p.person)} aria-label={`Ligar para ${fmtPhone(p.value)}`} className="grid size-8 place-items-center rounded-lg bg-ok/15 text-ok hover:brightness-110"><Phone size={15} aria-hidden /></button>
                <a href={chatproUrl(p.value)} target="_blank" rel="noreferrer" onClick={() => void trackTouch({ leadId: lead.id, channel: "whatsapp", target: p.value, label: lead.tradeName ?? lead.company })} aria-label="WhatsApp" className="grid size-8 place-items-center rounded-lg bg-accent/12 text-accent hover:brightness-110"><MessageCircle size={15} aria-hidden /></a>
              </>}
            </div>
          ))}
        </div>
      )}
      {emails.length > 0 && <div className="space-y-1">{emails.map((m) => <a key={m.value} href={`mailto:${m.value}`} onClick={() => void trackTouch({ leadId: lead.id, channel: "email", target: m.value, label: lead.tradeName ?? lead.company })} className={`${row} hover:text-accent`}><Mail size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span className="truncate">{m.value}</span>{m.person && <span className="shrink-0 text-xs text-muted">· {m.person}</span>}</a>)}</div>}
      {lead.tasks.length > 0 && <div className="space-y-1 rounded-xl border border-dashed border-line p-2.5"><p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><CalendarClock size={13} aria-hidden /> Suas tarefas neste lead</p>{lead.tasks.map((t) => <p key={t.id} className="text-sm">{t.title}{t.dueAt && <span className="text-xs text-muted"> · {new Date(t.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}</p>)}</div>}
      {lead.notes && <p className="line-clamp-3 rounded-xl border border-dashed border-line bg-panel px-3 py-2 text-xs italic text-muted">“{lead.notes}”</p>}
      <ClientIds leadId={lead.id} eoxId={lead.eoxId} eoxCode={lead.eoxCode} sfId={lead.sfId} eoxUrl={lead.eoxUrl} canEdit={false} compact />
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/leads/${lead.id}`} target="_blank" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel text-sm font-semibold hover:border-accent"><ExternalLink size={14} aria-hidden /> Abrir lead</Link>
        {roteiroOn && <Link href={`/roteiro/${lead.id}${lead.kind === "inativo" ? "?area=vendas" : "?area=sdr&goal=sdr"}`} target="_blank" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel text-sm font-semibold hover:border-accent"><ScrollText size={14} aria-hidden /> Roteiro</Link>}
      </div>
      {others.length > 0 && (
        <div className="space-y-1 border-t border-line pt-2">
          <p className="text-xs text-muted">Este número também está em:</p>
          {others.map((o) => <button key={o.id} type="button" onClick={() => onPick(o)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/10"><Building2 size={14} className="shrink-0 text-muted" aria-hidden /><span className="truncate">{o.tradeName ?? o.company}</span></button>)}
        </div>
      )}
    </div>
  );
}

/** Telefone do sistema: botão flutuante que abre o painel com teclado, ficha do lead reconhecido, ligação pelo VocallPhone e atalhos pós-chamada. */
export function PhoneDock() {
  const vocall = useVocall();
  const toast = useToast();
  const [num, setNum] = useState("");
  const [dialing, setDialing] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [pinned, setPinned] = useState<PhoneLead | null>(null);
  const [tab, setTab] = useState<Tab>("dial");
  const [retried, setRetried] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { panel: open, setPanel: setOpen, call, prefix } = vocall;

  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); if (Array.isArray(r)) setRecent(r.filter((x) => x && typeof x.digits === "string").slice(0, 8)); } catch { /* sem armazenamento */ } }, []);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, setOpen]);
  useEffect(() => { if (open && !call && tab === "dial") inputRef.current?.focus(); }, [open, call, tab]);
  const digits = num.replace(/\D/g, "");
  const inCall = !!call;
  const callDigits = call ? call.telefone.replace(/\D/g, "").replace(prefix ? new RegExp(`^${prefix.replace(/\D/g, "")}`) : /^$/, "") : "";
  const found = useLead(inCall ? callDigits : digits);
  const lead = pinned && found.leads.some((l) => l.id === pinned.id) ? pinned : found.leads[0] ?? null;
  const others = found.leads.filter((l) => l.id !== lead?.id);
  const ended = !!call?.endedAt;
  const live = inCall && !ended;
  const label = estadoLabel(call?.estado ?? null, ended);
  // terminou qualquer ligação: o número digitado sai da caixa
  useEffect(() => { if (ended) { setNum(""); setPinned(null); } }, [ended]);

  const press = useCallback((k: string) => { if (/\d/.test(k)) { setNum((n) => (n.replace(/\D/g, "").length >= 13 ? n : n.replace(/\D/g, "") + k)); setPinned(null); } }, []);
  const remember = (d: string, l: string) => {
    const next = [{ digits: d, label: l }, ...recent.filter((r) => r.digits !== d)].slice(0, 8);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ok */ }
  };
  const dialTo = async (d: string, personName?: string | null) => {
    if (d.length < 8 || dialing) return;
    setDialing(true);
    const l = lead && lead.channels.some((c) => c.value.replace(/\D/g, "").slice(-8) === d.slice(-8)) ? lead : null;
    const lbl = l ? (l.tradeName ?? l.company) : fmtPhone(d);
    const personId = null as number | null;
    void personName;
    try {
      await callNumber(d, lbl, toast, vocall, l ? { id: l.id, eoxUrl: l.eoxUrl, eoxInfo: l.eoxInfo } : undefined, personId);
      remember(d, lbl);
    } finally { setDialing(false); }
  };
  const retry = async (days: number) => {
    if (!lead) return;
    const r = await createTaskAction({ area: lead.kind === "inativo" ? "vendas" : "sdr", kind: "ligar", title: `Ligar de novo: ${lead.tradeName ?? lead.company}`, due: toLocalInput(dueFromDays(days)), leadId: lead.id }).catch(() => ({ ok: false }));
    if (r.ok) { setRetried(days === 1 ? "amanhã" : `em ${days} dias`); toast("ok", "Tarefa de ligação criada."); } else toast("bad", "Não consegui criar a tarefa.");
  };
  const script = lead && vocall.roteiroOn ? `/roteiro/${lead.id}?${lead.kind === "inativo" ? "area=vendas" : "area=sdr&goal=sdr"}${lastCallTouch() ? `&evento=${lastCallTouch()}` : ""}` : null;
  const shownTab: Tab = inCall ? "lead" : tab;

  return (
    <>
      <div className="fixed bottom-5 left-5 z-[64] flex max-w-[calc(100vw-6rem)] items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Fechar o telefone" : inCall ? `Abrir o telefone: ${call!.empresa ?? fmtPhone(callDigits)}, ${label}` : "Abrir o telefone"} aria-expanded={open} title="Telefone"
          className={`group relative flex h-14 min-w-14 items-center justify-center rounded-full border border-white/20 text-white shadow-xl transition hover:shadow-2xl active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${!open && inCall ? "gap-3 pl-4 pr-5" : "size-14 hover:scale-105"}`}
          style={{ background: live ? "linear-gradient(135deg,#16a34a,#15803d)" : inCall ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#7c3aed,#5b21b6)" }}>
          {live && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" aria-hidden />}
          {open ? <X size={22} aria-hidden className="relative" /> : inCall ? (ended ? <PhoneOff size={21} aria-hidden className="relative shrink-0" /> : <PhoneCall size={21} aria-hidden className="relative shrink-0 script-shake" />) : <Phone size={22} aria-hidden className="relative" />}
          {!open && inCall && (
            <span className="relative min-w-0 text-left" role="status" aria-live="polite">
              <span className="block max-w-[16rem] truncate text-sm font-bold leading-tight">{lead ? (lead.tradeName ?? lead.company) : call!.empresa ?? fmtPhone(callDigits)}</span>
              <span className="block max-w-[16rem] truncate text-xs text-white/75">{lead || call!.empresa ? `${fmtPhone(callDigits)} · ` : ""}{label}</span>
            </span>
          )}
          {!open && inCall && <span className="relative text-sm"><Timer since={call!.since} endedAt={call!.endedAt} /></span>}
        </button>
        {!open && ended && call!.qualUrl && <a href={call!.qualUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-slate-900 shadow-xl transition hover:bg-amber-200"><ExternalLink size={15} aria-hidden /> Qualificar</a>}
      </div>

      {open && (
        <section role="dialog" aria-label="Telefone" className="card-in fixed bottom-24 left-5 z-[66] flex max-h-[min(44rem,calc(100dvh-7.5rem))] w-[24rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl">
          <header className="relative overflow-hidden px-4 pb-3 pt-3.5 text-white" style={{ background: live ? "linear-gradient(135deg,#15803d,#166534)" : "linear-gradient(135deg,#6d28d9,#4c1d95)" }}>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">{live ? <PhoneCall size={19} aria-hidden className="script-shake" /> : <Phone size={19} aria-hidden />}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{live ? "Em chamada" : ended ? "Ligação encerrada" : "Telefone"}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-white/80"><span className={`size-1.5 rounded-full ${live || vocall.ready ? "bg-emerald-300" : "animate-pulse bg-amber-300"}`} />{live ? label : "VocallPhone"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid size-8 place-items-center rounded-lg text-white/80 hover:bg-white/15"><X size={16} aria-hidden /></button>
            </div>
            {!inCall && (
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1" role="tablist">
                {([["dial", "Discar"], ["lead", lead ? "Ficha" : "Ficha"], ["recent", "Recentes"]] as [Tab, string][]).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} disabled={k === "lead" && !lead} onClick={() => setTab(k)} className={`min-h-8 rounded-lg text-xs font-bold transition disabled:opacity-40 ${tab === k ? "bg-white text-violet-900 shadow" : "text-white/85 hover:bg-white/10"}`}>{l}{k === "recent" && recent.length ? ` · ${recent.length}` : ""}</button>
                ))}
              </div>
            )}
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {inCall && (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-1.5 py-1 text-center" role="status" aria-live="polite">
                  <span className={`relative grid size-[4.5rem] place-items-center rounded-full text-white ${ended ? "bg-slate-600" : "bg-emerald-600"}`}>
                    {!ended && <><span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" aria-hidden /><span className="absolute -inset-1.5 rounded-full border-2 border-emerald-500/30" aria-hidden /></>}
                    {ended ? <PhoneOff size={28} aria-hidden /> : <PhoneCall size={28} aria-hidden className="relative script-shake" />}
                  </span>
                  <p className="max-w-full truncate text-lg font-bold">{lead ? (lead.tradeName ?? lead.company) : call!.empresa ?? fmtPhone(callDigits)}</p>
                  <p className="figure text-sm text-muted">{fmtPhone(callDigits)}{lead?.person ? ` · ${lead.person.name}` : ""}</p>
                  <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ended ? "bg-slate-500/15 text-muted" : "bg-ok/15 text-ok"}`}>{label}</span><Timer since={call!.since} endedAt={call!.endedAt} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {!vocall.roteiroOn ? null : script ? <Link href={script} target="_blank" className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-sunk/60 text-xs font-bold hover:border-accent"><ScrollText size={17} className="text-accent" aria-hidden />Roteiro</Link> : <span className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-xs text-muted"><ScrollText size={17} aria-hidden />Roteiro</span>}
                  {lead ? <Link href={`/leads/${lead.id}`} target="_blank" className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-sunk/60 text-xs font-bold hover:border-accent"><ExternalLink size={17} className="text-accent" aria-hidden />Lead</Link> : <span className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-xs text-muted"><ExternalLink size={17} aria-hidden />Lead</span>}
                  <button type="button" onClick={() => { void navigator.clipboard?.writeText(callDigits); toast("info", "Número copiado."); }} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-sunk/60 text-xs font-bold hover:border-accent"><Copy size={17} className="text-accent" aria-hidden />Copiar</button>
                </div>
                {ended && (
                  <>
                    {call!.qualUrl
                      ? <a href={call!.qualUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-grad text-base font-bold text-on-accent shadow-lg transition hover:brightness-110 active:scale-[0.98]"><ExternalLink size={17} aria-hidden /> Qualificar na EOX</a>
                      : call!.qualLooking && <p className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Procurando a qualificação…</p>}
                    {lead && <div className="space-y-1.5"><p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Clock size={13} aria-hidden /> Ligar de novo</p>{retried ? <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Tarefa criada para {retried}.</p> : <div className="grid grid-cols-3 gap-1.5">{[[1, "Amanhã"], [3, "3 dias"], [7, "1 semana"]].map(([d, l]) => <button key={d} type="button" onClick={() => void retry(d as number)} className="min-h-9 rounded-lg border border-line text-xs font-semibold hover:border-accent">{l}</button>)}</div>}</div>}
                    <button type="button" onClick={() => { vocall.dismiss(); setPinned(null); setRetried(null); setNum(""); setTab("dial"); }} className="min-h-10 w-full rounded-xl border border-line text-sm font-semibold hover:border-accent">Nova ligação</button>
                  </>
                )}
              </div>
            )}

            {!inCall && shownTab === "dial" && (
              <>
                <div className="relative">
                  <input ref={inputRef} aria-label="Número para ligar" type="tel" inputMode="numeric" autoComplete="off" placeholder="(00) 00000-0000" value={digits ? fmtPhone(digits) : ""}
                    onChange={(e) => { setNum(e.target.value.replace(/\D/g, "").slice(0, 13)); setPinned(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void dialTo(digits); } }}
                    onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 13); setNum(t); setPinned(null); }}
                    className="figure w-full rounded-2xl border border-line bg-sunk/60 px-4 py-3.5 pr-12 text-center text-[1.7rem] font-bold tracking-wide outline-none transition focus:border-accent focus:bg-panel" />
                  {digits && <button type="button" onClick={() => { setNum(digits.slice(0, -1)); setPinned(null); }} aria-label="Apagar último dígito" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-accent/10 hover:text-ink"><Delete size={18} aria-hidden /></button>}
                </div>
                {digits.length >= 8 && (found.loading
                  ? <p className="flex items-center justify-center gap-2 py-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" aria-hidden /> Procurando o lead…</p>
                  : lead ? <LeadStrip lead={lead} onOpen={() => setTab("lead")} />
                  : <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-center text-xs text-muted">Número sem lead cadastrado. A ligação sai, sem ficha.</p>)}
                <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Teclado">
                  {KEYS.map(([k, sub]) => (
                    <button key={k} type="button" onClick={() => press(k)} aria-label={k} className="flex h-[3.25rem] flex-col items-center justify-center rounded-2xl border border-line bg-sunk/60 transition hover:border-accent hover:bg-accent/10 active:scale-95">
                      <span className="text-xl font-semibold leading-none">{k}</span>{sub && <span className="mt-0.5 text-[9px] font-bold tracking-widest text-muted">{sub}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {!inCall && shownTab === "lead" && lead && <LeadSheet lead={lead} others={others} onPick={(l) => { setPinned(l); }} onDial={(d, p) => { setNum(d); setTab("dial"); void dialTo(d, p); }} />}

            {!inCall && shownTab === "recent" && (
              recent.length === 0 ? <p className="py-6 text-center text-sm text-muted">As ligações que você fizer por aqui aparecem aqui.</p>
                : <div className="space-y-1.5">{recent.map((r) => <button key={r.digits} type="button" onClick={() => { setNum(r.digits); setPinned(null); setTab("dial"); }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-left text-sm hover:border-accent"><span className="truncate font-medium">{r.label}</span><span className="figure shrink-0 text-xs text-muted">{fmtPhone(r.digits)}</span></button>)}</div>
            )}
          </div>

          {!inCall && shownTab === "dial" && (
            <footer className="space-y-1.5 border-t border-line bg-panel p-3">
              <button type="button" onClick={() => void dialTo(digits)} disabled={digits.length < 8 || dialing || !vocall.ready} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                {dialing || !vocall.ready ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Phone size={20} aria-hidden />} {dialing ? "Ligando…" : !vocall.ready ? "Conectando…" : "Ligar"}
              </button>
            </footer>
          )}
        </section>
      )}
    </>
  );
}
