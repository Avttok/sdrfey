"use client";

import { ArrowLeft, Ban, Building2, CalendarClock, Clock, Copy, Delete, Eraser, ExternalLink, History, Loader2, Mail, MapPin, MessageCircle, Phone, PhoneCall, PhoneOff, ScrollText, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeyMark } from "@/components/logo";
import { MorphMark } from "@/components/logo-morph";
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

const asEmbed = (u: string) => u + (u.includes("?") ? "&" : "?") + "embed=1";
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

/** Bloco da ficha: título pequeno + conteúdo em cartão. */
function Card({ title, Icon, children }: { title: string; Icon: typeof Phone; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-line bg-panel p-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Icon size={13} aria-hidden /> {title}</h3>
      {children}
    </section>
  );
}

/** Ficha do lead: cabeça com o essencial, ações rápidas, contatos, resumo e IDs, em cartões curtos. */
function LeadSheet({ lead, others, onPick, onDial, onScript, onLead }: { onScript: (url: string) => void; onLead: (id: number) => void; lead: PhoneLead; others: PhoneLead[]; onPick: (l: PhoneLead) => void; onDial: (digits: string, personName: string | null) => void }) {
  const { roteiroOn } = useVocall();
  const name = lead.tradeName ?? lead.company;
  const place = [lead.city, lead.uf].filter(Boolean).join(" / ");
  const phones = lead.channels.filter((c) => c.kind === "phone");
  const emails = lead.channels.filter((c) => c.kind === "email" && !c.wrong);
  const firstPhone = phones.find((p) => !p.wrong);
  const act = "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-sunk/60 text-xs font-bold transition hover:border-accent active:scale-95";
  const scriptUrl = `/roteiro/${lead.id}${lead.kind === "inativo" ? "?area=vendas" : "?area=sdr&goal=sdr"}`;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-grad p-4 text-center text-on-accent">
        <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/20 text-lg font-black ring-1 ring-white/30">{initials(name)}</span>
        <p className="mt-2 text-lg font-bold leading-tight">{name}</p>
        {lead.tradeName && <p className="truncate text-xs text-white/70" title={lead.company}>{lead.company}</p>}
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">{lead.kind === "inativo" ? "Cliente (Vendas)" : "Prospecção"}</span>
          {lead.dealStage && <span className="rounded-full bg-emerald-400/30 px-2 py-0.5 text-[11px] font-semibold">{STAGE[lead.dealStage] ?? lead.dealStage}</span>}
          {place && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold"><MapPin size={11} aria-hidden />{place}</span>}
        </div>
      </div>

      <div className={`grid gap-2 ${roteiroOn ? "grid-cols-4" : "grid-cols-3"}`}>
        <button type="button" disabled={!firstPhone} onClick={() => firstPhone && onDial(firstPhone.value, firstPhone.person)} className={`${act} disabled:opacity-40`}><Phone size={17} className="text-ok" aria-hidden />Ligar</button>
        {firstPhone ? <a href={chatproUrl(firstPhone.value)} target="_blank" rel="noreferrer" onClick={() => void trackTouch({ leadId: lead.id, channel: "whatsapp", target: firstPhone.value, label: name })} className={act}><MessageCircle size={17} className="text-accent" aria-hidden />WhatsApp</a> : <span className={`${act} opacity-40`}><MessageCircle size={17} aria-hidden />WhatsApp</span>}
        {roteiroOn && <button type="button" onClick={() => onScript(scriptUrl)} className={act}><ScrollText size={17} className="text-accent" aria-hidden />Roteiro</button>}
        <button type="button" onClick={() => onLead(lead.id)} className={act}><FeyMark size={17} />Lead</button>
      </div>

      {(lead.person || lead.touch) && (
        <Card title="Quem atende" Icon={UserRound}>
          {lead.person && <p className="text-sm"><b>{lead.person.name}</b>{lead.person.role && <span className="text-muted"> · {lead.person.role}</span>}<span className="block text-xs text-muted">costuma atender neste número</span></p>}
          {lead.touch && <p className="flex flex-wrap items-center gap-2 text-sm"><History size={14} className="shrink-0 text-muted" aria-hidden /><span><b>{lead.touch.attempts}</b> ligação(ões)</span><OutcomeChip channel="call" outcome={lead.touch.lastOutcome} /><span className="text-xs text-muted">{ago(lead.touch.lastAt)}</span></p>}
        </Card>
      )}

      {(phones.length > 0 || emails.length > 0) && (
        <Card title="Contatos" Icon={Phone}>
          {phones.map((p) => (
            <div key={p.value} className={`flex items-center gap-2 rounded-xl bg-sunk/60 px-2.5 py-1.5 ${p.wrong ? "opacity-50" : ""}`}>
              <span className="min-w-0 flex-1"><span className={`figure block text-sm font-semibold ${p.wrong ? "line-through" : ""}`}>{fmtPhone(p.value)}</span>{p.person && <span className="block truncate text-xs text-muted">{p.person}</span>}</span>
              {!p.wrong && <>
                <button type="button" onClick={() => onDial(p.value, p.person)} aria-label={`Ligar para ${fmtPhone(p.value)}`} className="grid size-8 place-items-center rounded-lg bg-ok/15 text-ok hover:brightness-110"><Phone size={15} aria-hidden /></button>
                <a href={chatproUrl(p.value)} target="_blank" rel="noreferrer" onClick={() => void trackTouch({ leadId: lead.id, channel: "whatsapp", target: p.value, label: name })} aria-label="WhatsApp" className="grid size-8 place-items-center rounded-lg bg-accent/12 text-accent hover:brightness-110"><MessageCircle size={15} aria-hidden /></a>
              </>}
            </div>
          ))}
          {emails.map((m) => <a key={m.value} href={`mailto:${m.value}`} onClick={() => void trackTouch({ leadId: lead.id, channel: "email", target: m.value, label: name })} className="flex items-center gap-2 rounded-xl bg-sunk/60 px-2.5 py-2 text-sm hover:text-accent"><Mail size={15} className="shrink-0 text-muted" aria-hidden /><span className="truncate">{m.value}</span>{m.person && <span className="shrink-0 text-xs text-muted">· {m.person}</span>}</a>)}
        </Card>
      )}

      <Card title="Resumo" Icon={History}>
        {lead.contactName && <p className="flex items-center gap-2 text-sm"><UserRound size={14} className="shrink-0 text-muted" aria-hidden /><span>{lead.contactName}{lead.roleTitle && <span className="text-muted"> · {lead.roleTitle}</span>}</span></p>}
        <p className="text-sm text-muted">{lead.timesServed ? `Já atendido ${lead.timesServed}×` : "Ainda não atendido"}{lead.ownerName && ` · Responsável: ${lead.ownerName.split(" ")[0]}`}</p>
        {lead.notes && <p className="line-clamp-3 rounded-lg bg-sunk/60 px-2.5 py-2 text-xs italic text-muted">“{lead.notes}”</p>}
      </Card>

      {lead.eoxInfo && <EoxInfoCard info={lead.eoxInfo} compact />}

      {lead.tasks.length > 0 && (
        <Card title="Suas tarefas" Icon={CalendarClock}>
          {lead.tasks.map((t) => <p key={t.id} className="text-sm">{t.title}{t.dueAt && <span className="text-xs text-muted"> · {new Date(t.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}</p>)}
        </Card>
      )}

      <Card title="Identificação" Icon={Building2}>
        <ClientIds leadId={lead.id} eoxId={lead.eoxId} eoxCode={lead.eoxCode} sfId={lead.sfId} eoxUrl={lead.eoxUrl} canEdit={false} compact menu={false} />
      </Card>

      {others.length > 0 && (
        <Card title="Este número também está em" Icon={Building2}>
          {others.map((o) => <button key={o.id} type="button" onClick={() => onPick(o)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/10"><Building2 size={14} className="shrink-0 text-muted" aria-hidden /><span className="truncate">{o.tradeName ?? o.company}</span></button>)}
        </Card>
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
  const pathname = usePathname();
  const [side, setSide] = useState<{ url: string; title: string } | null>(null);
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
  // roteiro dentro do próprio discador (painel se expande, discador à esquerda): não em páginas que já têm roteiro, nem em telas estreitas
  const onScriptPage = /^\/(roteiro|atender)(\/|$)/.test(pathname ?? "");
  const openSide = (url: string, title: string) => {
    if (onScriptPage || typeof window === "undefined" || window.innerWidth < 1100) { window.open(url, "_blank", "noopener"); return; }
    setSide({ url: asEmbed(url), title });
  };
  const openScript = (url: string) => openSide(url, "Roteiro");
  const openLead = (id: number) => openSide(`/leads/${id}`, "Lead");
  const wide = !!side && !onScriptPage;
  // pré-carrega o roteiro do lead reconhecido num quadro escondido: ao clicar, ele só aparece (sem esperar o carregamento)
  const [roomy, setRoomy] = useState(false);
  useEffect(() => { const f = () => setRoomy(window.innerWidth >= 1100); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const warm = open && roomy && !onScriptPage && script ? asEmbed(script) : null;
  const calling = dialing && !inCall;
  const [sheet, setSheet] = useState(false);
  const [qDone, setQDone] = useState<number | null>(null);
  const [releasing, setReleasing] = useState(false);
  useEffect(() => { if (!inCall) setSheet(false); }, [inCall]);
  // a ligação acabou: fecha o painel lateral (roteiro/lead) e volta ao tamanho normal
  useEffect(() => { if (ended) setSide(null); }, [ended]);
  const [eoxOpened, setEoxOpened] = useState(false);
  const checking = vocall.checking;
  // verde = conectado, amarelo = qualificação pendente, vermelho = em ligação, cinza = desconectado
  const status = live || calling ? { dot: "bg-red-500 animate-pulse", text: calling ? "Ligando…" : "Em ligação" }
    : checking || (ended && !!call?.qualUrl) ? { dot: "bg-yellow-400 animate-pulse", text: "Qualificação pendente" }
    : vocall.ready ? { dot: "bg-emerald-400", text: "Conectado" }
    : { dot: "bg-slate-400", text: vocall.fails >= 1 ? "Desconectado" : "Conectando…" };
  useEffect(() => { if (!open) setSide(null); }, [open]);

  const broken = !vocall.ready && !checking && vocall.fails >= 1;
  const contactName = lead?.person?.name ?? null;
  const companyName = lead ? (lead.tradeName ?? lead.company) : call?.empresa ?? null;
  const qualified = !!call && qDone === call.since;
  const needQual = ended && !!call?.qualUrl && !qualified;
  const newCall = async () => {
    if (releasing) return;
    setReleasing(true);
    let ok = false;
    try { ok = await vocall.release(); } finally { setReleasing(false); }
    if (!ok) toast("warn", "O VocallPhone não confirmou que está livre. Se continuar bloqueado, use o botão EOX no discador.");
    vocall.dismiss(); setPinned(null); setRetried(null); setNum(""); setTab("dial"); setSheet(false);
  };
  const tile = "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-sunk text-xs font-bold transition hover:bg-accent/10 active:scale-95";
  const ghostTile = "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line text-xs text-muted";

  return (
    <div className="contents embed-hide">
      {!open && (
        <div className="fixed bottom-5 left-5 z-[64] flex max-w-[calc(100vw-6rem)] items-center gap-2">
          <button type="button" onClick={() => setOpen(true)} aria-label={inCall ? `Abrir o telefone: ${companyName ?? fmtPhone(callDigits)}, ${label}` : "Abrir o telefone"} aria-expanded={false} title="SDR Phone"
            className={`group relative flex h-14 min-w-14 items-center justify-center rounded-full text-white shadow-xl ring-1 ring-white/20 transition hover:shadow-2xl active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${inCall ? "gap-3 pl-4 pr-5" : "size-14 hover:scale-105"} ${!live && !inCall ? "bg-grad text-on-accent" : ""}`}
            style={live ? { background: "linear-gradient(135deg,#16a34a,#15803d)" } : inCall ? { background: "linear-gradient(135deg,#334155,#1e293b)" } : undefined}>
            {live && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" aria-hidden />}
            {inCall ? (ended ? <PhoneOff size={21} aria-hidden className="relative shrink-0" /> : <PhoneCall size={21} aria-hidden className="relative shrink-0 script-shake" />) : <Phone size={22} aria-hidden className="relative" />}
            {inCall && (
              <span className="relative min-w-0 text-left" role="status" aria-live="polite">
                <span className="block max-w-[16rem] truncate text-sm font-bold leading-tight">{companyName ?? fmtPhone(callDigits)}</span>
                <span className="block max-w-[16rem] truncate text-xs text-white/75">{companyName ? `${fmtPhone(callDigits)} · ` : ""}{label}</span>
              </span>
            )}
            {inCall && <span className="relative text-sm"><Timer since={call!.since} endedAt={call!.endedAt} /></span>}
          </button>
        </div>
      )}

      {open && (
        <section role="dialog" aria-label="SDR Phone" className={`card-in fixed z-[66] flex overflow-hidden rounded-[1.75rem] border border-line bg-panel shadow-2xl ${wide ? "inset-x-5 bottom-5 top-5" : "bottom-5 left-5 max-h-[min(46rem,calc(100dvh-2.5rem))] w-[24rem] max-w-[calc(100vw-2.5rem)]"}`}>
          <div className={`flex min-h-0 max-w-full shrink-0 flex-col ${wide ? "w-[22rem]" : "w-[24rem]"}`}>
            <header className="bg-grad-soft px-4 pb-3 pt-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-md"><MorphMark size={25} color="currentColor" /></span>
                <div className="min-w-0 flex-1">
                  <p className="display text-lg leading-tight">SDR Phone</p>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-panel/80 px-2 py-0.5 text-xs font-semibold ring-1 ring-line" role="status"><span className={`size-2 rounded-full ${status.dot}`} />{status.text}</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-panel hover:text-ink"><X size={18} aria-hidden /></button>
              </div>
              {!inCall && !calling && (
                <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-sunk/80 p-1" role="tablist">
                  {([["dial", "Discar"], ["lead", "Ficha"], ["recent", "Recentes"]] as [Tab, string][]).map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} disabled={k === "lead" && !lead} onClick={() => setTab(k)} className={`min-h-9 rounded-xl text-xs font-bold transition disabled:opacity-40 ${tab === k ? "bg-panel text-accent shadow-sm" : "text-muted hover:text-ink"}`}>{l}{k === "recent" && recent.length ? ` · ${recent.length}` : ""}</button>
                  ))}
                </div>
              )}
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {inCall && sheet && lead && <LeadSheet lead={lead} others={others} onPick={(l) => setPinned(l)} onDial={() => toast("info", "Termine a ligação atual antes de ligar de novo.")} onScript={openScript} onLead={openLead} />}

              {inCall && !(sheet && lead) && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-1 pt-1 text-center" role="status" aria-live="polite">
                    <span className={`relative mb-2 grid size-20 place-items-center rounded-full text-white ${ended ? "bg-slate-500" : "bg-emerald-600"}`}>
                      {!ended && <><span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" aria-hidden /><span className="absolute -inset-1.5 rounded-full border-2 border-emerald-500/30" aria-hidden /></>}
                      {ended ? <PhoneOff size={30} aria-hidden /> : <PhoneCall size={30} aria-hidden className="relative script-shake" />}
                    </span>
                    {contactName && <p className="w-full break-words text-xl font-bold leading-tight">{contactName}</p>}
                    {companyName && <p className={`w-full break-words leading-snug ${contactName ? "text-sm font-semibold text-muted" : "text-xl font-bold"}`}>{companyName}</p>}
                    <p className="figure w-full break-words text-sm text-muted">{fmtPhone(callDigits)}</p>
                    <Timer since={call!.since} endedAt={call!.endedAt} className="mt-1 text-3xl font-bold" />
                    {ended && <span className="mt-1 rounded-full bg-slate-500/15 px-3 py-1 text-xs font-bold text-muted">{label}</span>}
                  </div>

                  {live && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {!vocall.roteiroOn ? null : script ? <button type="button" onClick={() => openScript(script)} className={tile}><ScrollText size={18} className="text-accent" aria-hidden />Roteiro</button> : <span className={ghostTile}><ScrollText size={18} aria-hidden />Roteiro</span>}
                        {lead ? <button type="button" onClick={() => openLead(lead.id)} className={tile}><FeyMark size={18} />Lead</button> : <span className={ghostTile}><FeyMark size={18} color="currentColor" />Lead</span>}
                        {lead ? <button type="button" onClick={() => setSheet(true)} className={tile}><UserRound size={18} className="text-accent" aria-hidden />Ficha</button> : <span className={ghostTile}><UserRound size={18} aria-hidden />Ficha</span>}
                      </div>
                      <button type="button" onClick={() => { void vocall.hangupCall(); toast("info", "Pedido de desligar enviado."); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-danger text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"><PhoneOff size={18} aria-hidden /> Desligar</button>
                    </>
                  )}

                  {ended && (
                    <div className="space-y-2.5">
                      {call!.qualUrl
                        ? <QualifyLink href={call!.qualUrl} done={qualified} onOpen={() => setQDone(call!.since)} />
                        : call!.qualLooking
                          ? null
                          : <p className="rounded-xl bg-sunk px-3 py-2 text-center text-xs text-muted">Número sem cadastro na EOX: não há qualificação para abrir.</p>}
                      <button type="button" disabled={checking || needQual || releasing} onClick={() => void newCall()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                        {checking || releasing ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Phone size={18} aria-hidden />} {checking ? "Conferindo a qualificação…" : releasing ? "Liberando o ramal…" : "Nova ligação"}
                      </button>
                      {needQual && <p className="text-center text-xs text-muted">Abra “Qualificar no EOX” uma vez para liberar a nova ligação.</p>}
                      {lead && (
                        <div className="space-y-1.5 border-t border-line pt-3">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Clock size={13} aria-hidden /> Ligar de novo</p>
                          {retried ? <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">Tarefa criada para {retried}.</p>
                            : <div className="grid grid-cols-3 gap-1.5">{[[1, "Amanhã"], [3, "3 dias"], [7, "1 semana"]].map(([d, l]) => <button key={d} type="button" onClick={() => void retry(d as number)} className="min-h-10 rounded-xl bg-sunk text-xs font-semibold transition hover:bg-accent/10">{l}</button>)}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {calling && (
                <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
                  <span className="relative grid size-24 place-items-center rounded-full bg-emerald-600 text-white">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" aria-hidden />
                    <span className="absolute -inset-2 animate-pulse rounded-full border-2 border-emerald-500/30" aria-hidden />
                    <Phone size={34} aria-hidden className="relative script-shake" />
                  </span>
                  <p className="text-xl font-bold">Ligando<span className="inline-flex w-6 justify-start"><span className="animate-pulse">.</span><span className="animate-pulse [animation-delay:.2s]">.</span><span className="animate-pulse [animation-delay:.4s]">.</span></span></p>
                  <p className="figure text-sm text-muted">{fmtPhone(digits)}</p>
                  <p className="text-xs text-muted">Conectando ao VocallPhone…</p>
                </div>
              )}

              {!inCall && !calling && shownTab === "dial" && (
                <>
                  <div className="relative rounded-3xl bg-sunk px-3 py-4 text-center transition focus-within:ring-2 focus-within:ring-accent/40">
                    <input ref={inputRef} aria-label="Número para ligar" type="tel" inputMode="numeric" autoComplete="off" placeholder="Digite o número" value={digits ? fmtPhone(digits) : ""}
                      onChange={(e) => { setNum(e.target.value.replace(/\D/g, "").slice(0, 13)); setPinned(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void dialTo(digits); } }}
                      onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 13); setNum(t); setPinned(null); }}
                      className="figure w-full appearance-none rounded-none border-0 bg-transparent px-11 text-center text-[1.75rem] font-bold tracking-wide caret-transparent shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none placeholder:text-base placeholder:font-medium placeholder:text-muted/70" />
                    {digits && <button type="button" onClick={() => { setNum(""); setPinned(null); inputRef.current?.focus(); }} aria-label="Apagar o número todo" title="Apagar tudo" className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:bg-danger/10 hover:text-danger"><Eraser size={18} aria-hidden /></button>}
                    {digits && <button type="button" onClick={() => { setNum(digits.slice(0, -1)); setPinned(null); }} aria-label="Apagar último dígito" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:bg-accent/10 hover:text-ink"><Delete size={18} aria-hidden /></button>}
                  </div>
                  {digits.length >= 8 && (found.loading
                    ? <p className="flex items-center justify-center gap-2 py-1 text-xs text-muted"><Loader2 size={13} className="animate-spin" aria-hidden /> Procurando o lead…</p>
                    : lead ? <div className="space-y-1.5"><LeadStrip lead={lead} onOpen={() => setTab("lead")} /></div>
                    : <p className="rounded-xl border border-dashed border-line px-3 py-2 text-center text-xs text-muted">Número sem lead cadastrado. A ligação sai, sem ficha.</p>)}
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado">
                    {KEYS.map(([k, sub]) => (
                      <button key={k} type="button" onClick={() => press(k)} aria-label={k} className="flex h-14 flex-col items-center justify-center rounded-2xl bg-sunk transition hover:bg-accent/10 active:scale-95 active:bg-accent/20">
                        <span className="text-xl font-semibold leading-none">{k}</span>{sub && <span className="mt-0.5 text-[9px] font-bold tracking-widest text-muted">{sub}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!inCall && !calling && shownTab === "lead" && lead && <LeadSheet lead={lead} others={others} onPick={(l) => { setPinned(l); }} onDial={(d, p) => { setNum(d); setTab("dial"); void dialTo(d, p); }} onScript={openScript} onLead={openLead} />}

              {!inCall && !calling && shownTab === "recent" && (
                recent.length === 0 ? <p className="py-8 text-center text-sm text-muted">As ligações que você fizer por aqui aparecem aqui.</p>
                  : <div className="space-y-1.5">{recent.map((r) => <button key={r.digits} type="button" onClick={() => { setNum(r.digits); setPinned(null); setTab("dial"); }} className="flex w-full items-center justify-between gap-2 rounded-2xl bg-sunk px-3.5 py-3 text-left text-sm transition hover:bg-accent/10"><span className="break-words font-medium">{r.label}</span><span className="figure shrink-0 text-xs text-muted">{fmtPhone(r.digits)}</span></button>)}</div>
              )}
            </div>

            {inCall && sheet && lead && (
              <footer className="flex items-center gap-3 border-t border-line bg-panel p-3">
                <span className={`relative grid size-10 shrink-0 place-items-center rounded-full text-white ${ended ? "bg-slate-500" : "bg-emerald-600"}`}>{ended ? <PhoneOff size={17} aria-hidden /> : <PhoneCall size={17} aria-hidden className="script-shake" />}</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold leading-tight">{contactName ?? companyName}</span><span className="block text-xs font-semibold text-muted"><Timer since={call!.since} endedAt={call!.endedAt} className="text-xs font-semibold" /></span></span>
                <button type="button" onClick={() => setSheet(false)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sunk px-3 text-sm font-semibold transition hover:bg-accent/10"><ArrowLeft size={15} aria-hidden /> Voltar</button>
              </footer>
            )}

            {!inCall && !calling && shownTab === "dial" && (
              <footer className="space-y-2 border-t border-line bg-panel p-3">
                {broken && <p role="alert" className="rounded-xl bg-warn/15 px-3 py-2 text-center text-sm font-semibold text-warn">Não consegui conectar ao VocallPhone. Por favor, feche todas as janelas do EOX no seu navegador.</p>}
                {broken ? (
                  <a href={vocall.eoxBase || "https://fey.vocallcontact.com.br/"} target="_blank" rel="noopener noreferrer" onClick={() => setEoxOpened(true)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]" style={{ background: "linear-gradient(135deg,#7a3a94,#692e81)" }}><span className="grid size-7 place-items-center rounded-md bg-white/20"><EoxMark size={20} /></span> EOX</a>
                ) : (                <button type="button" onClick={() => void dialTo(digits)} disabled={digits.length < 8 || dialing || !vocall.ready || checking} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                  {dialing || !vocall.ready ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Phone size={20} aria-hidden />} {dialing ? "Ligando…" : !vocall.ready ? "Conectando…" : "Ligar"}
                </button>)}
                {broken && eoxOpened && <p className="rounded-xl bg-sunk px-3 py-2 text-center text-xs text-muted">Quando aparecer <b>“Livre 00:01”</b> no canto superior direito do site da EOX, feche a aba da EOX.</p>}
              </footer>
            )}
          </div>

          {(side || warm) && (
            <div className={wide ? "relative hidden min-w-0 flex-1 flex-col border-l border-line bg-bg lg:flex" : "hidden"}>
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">{side?.title === "Lead" ? <FeyMark size={16} /> : <ScrollText size={16} className="text-accent" aria-hidden />}<p className="flex-1 text-sm font-bold">{side?.title}</p><button type="button" onClick={() => setSide(null)} aria-label="Fechar painel lateral" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-accent/10"><X size={16} aria-hidden /></button></div>
              <iframe src={side?.url ?? warm!} title={side?.title ?? "Roteiro"} className="min-h-0 w-full flex-1 border-0" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Logo "E" da EOX (só a letra, em traço grosso) para o botão de qualificar. */
function EoxMark({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="square" strokeLinejoin="miter"><path d="M18 4.5H7v15h11M7 12h9" /></svg>;
}

/** Abre a qualificação da ligação na EOX (nova aba). Roxo da EOX; depois do primeiro clique fica cinza. */
function QualifyLink({ href, done, onOpen }: { href: string; done: boolean; onOpen: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]" style={{ background: done ? "linear-gradient(135deg,#64748b,#475569)" : "linear-gradient(135deg,#7a3a94,#692e81)" }}>
      <span className="grid size-6 place-items-center rounded-md bg-white/20"><EoxMark size={18} /></span> {done ? "Qualificação aberta" : "Qualificar no EOX"}
    </a>
  );
}
