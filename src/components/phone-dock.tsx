"use client";

import { Building2, Delete, ExternalLink, History, Loader2, Mail, MapPin, Phone, PhoneCall, PhoneOff, ScrollText, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { callNumber } from "@/components/call-number";
import { estadoLabel, Timer } from "@/components/call-ui";
import { ClientIds } from "@/components/client-ids";
import { EoxInfoCard } from "@/components/eox-info";
import { useToast } from "@/components/toast";
import { useVocall } from "@/components/vocall-provider";
import { fmtPhone } from "@/lib/format";
import { lookupPhoneAction, type PhoneLead } from "@/modules/vocall/lookup";

const KEYS: [string, string][] = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
const STAGE: Record<string, string> = { novo: "Negociação nova", contato: "Em contato", cotacao: "Cotação enviada" };
const RECENT_KEY = "fey:phone-recent";
type Recent = { digits: string; label: string };

const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "#";

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

function LeadCard({ lead, others, onPick, inCall }: { lead: PhoneLead; others: PhoneLead[]; onPick: (l: PhoneLead) => void; inCall?: boolean }) {
  const place = [lead.city, lead.uf].filter(Boolean).join(" / ");
  const row = "flex items-start gap-2 text-sm";
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-sunk/50 p-3">
      {!inCall && <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-grad text-sm font-black text-on-accent">{initials(lead.tradeName ?? lead.company)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight" title={lead.company}>{lead.tradeName ?? lead.company}</p>
          {lead.tradeName && <p className="truncate text-xs text-muted" title={lead.company}>{lead.company}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">{lead.kind === "inativo" ? "Cliente (Vendas)" : "Prospecção"}</span>
            {lead.dealStage && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">{STAGE[lead.dealStage] ?? lead.dealStage}</span>}
          </div>
        </div>
      </div>}
      {inCall && <div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">{lead.kind === "inativo" ? "Cliente (Vendas)" : "Prospecção"}</span>{lead.dealStage && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">{STAGE[lead.dealStage] ?? lead.dealStage}</span>}</div>}
      {lead.person && <p className="flex items-center gap-2 rounded-lg bg-ok/10 px-2.5 py-1.5 text-sm"><UserRound size={15} className="shrink-0 text-ok" aria-hidden /><span><b>{lead.person.name}</b>{lead.person.role && <span className="text-muted"> · {lead.person.role}</span>}<span className="text-muted"> · é quem costuma atender neste número</span></span></p>}
      <EoxInfoCard info={lead.eoxInfo} compact />
      <div className="space-y-1">
        {place && <p className={row}><MapPin size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />{place}</p>}
        {lead.contactName && <p className={row}><UserRound size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span>{lead.contactName}{lead.roleTitle && <span className="text-muted"> · {lead.roleTitle}</span>}</span></p>}
        {lead.email && <p className={row}><Mail size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span className="truncate">{lead.email}</span></p>}
        <p className={row}><History size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden /><span className="text-muted">{lead.timesServed ? `Já atendido ${lead.timesServed}×` : "Ainda não atendido"}{lead.ownerName && ` · Responsável: ${lead.ownerName.split(" ")[0]}`}</span></p>
      </div>
      {lead.notes && <p className="line-clamp-3 rounded-xl border border-dashed border-line bg-panel px-3 py-2 text-xs italic text-muted">“{lead.notes}”</p>}
      <ClientIds leadId={lead.id} eoxId={lead.eoxId} eoxCode={lead.eoxCode} sfId={lead.sfId} eoxUrl={lead.eoxUrl} canEdit={false} compact />
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/leads/${lead.id}`} target="_blank" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel text-sm font-semibold hover:border-accent"><ExternalLink size={14} aria-hidden /> Abrir lead</Link>
        <Link href={`/roteiro/${lead.id}${lead.kind === "inativo" ? "?area=vendas" : "?area=sdr&goal=sdr"}`} target="_blank" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-panel text-sm font-semibold hover:border-accent"><ScrollText size={14} aria-hidden /> Roteiro</Link>
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

/** Telefone do sistema: botão flutuante que abre um painel com teclado, ligação pelo VocallPhone e a ficha do lead reconhecido pelo número. */
export function PhoneDock() {
  const vocall = useVocall();
  const toast = useToast();
  const [num, setNum] = useState("");
  const [dialing, setDialing] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [pinned, setPinned] = useState<PhoneLead | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { panel: open, setPanel: setOpen, call, prefix } = vocall;

  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); if (Array.isArray(r)) setRecent(r.filter((x) => x && typeof x.digits === "string").slice(0, 5)); } catch { /* sem armazenamento */ } }, []);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, setOpen]);
  useEffect(() => { if (open && !call) inputRef.current?.focus(); }, [open, call]);

  const digits = num.replace(/\D/g, "");
  const inCall = !!call;
  // na ligação o número vem do VocallAgent (com o prefixo que o sistema colocou)
  const callDigits = call ? call.telefone.replace(/\D/g, "").replace(prefix ? new RegExp(`^${prefix.replace(/\D/g, "")}`) : /^$/, "") : "";
  const found = useLead(inCall ? callDigits : digits);
  const lead = pinned && found.leads.some((l) => l.id === pinned.id) ? pinned : found.leads[0] ?? null;
  const others = found.leads.filter((l) => l.id !== lead?.id);
  const ended = !!call?.endedAt;

  const press = useCallback((k: string) => { if (/\d/.test(k)) { setNum((n) => (n.replace(/\D/g, "").length >= 13 ? n : n.replace(/\D/g, "") + k)); setPinned(null); } }, []);
  const dial = async () => {
    if (digits.length < 8 || dialing) return;
    setDialing(true);
    const l = lead ?? null;
    const label = l ? (l.tradeName ?? l.company) : fmtPhone(digits);
    try {
      await callNumber(digits, label, toast, vocall, l ? { id: l.id, eoxUrl: l.eoxUrl, eoxInfo: l.eoxInfo } : undefined);
      const next = [{ digits, label }, ...recent.filter((r) => r.digits !== digits)].slice(0, 5);
      setRecent(next);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ok */ }
    } finally { setDialing(false); }
  };

  const live = inCall && !ended;
  const label = estadoLabel(call?.estado ?? null, ended);
  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Fechar o telefone" : "Abrir o telefone"} aria-expanded={open} title="Telefone"
        className={`group fixed bottom-5 left-5 z-[64] grid size-14 place-items-center rounded-full border border-white/20 text-white shadow-xl transition hover:scale-105 hover:shadow-2xl active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
        style={{ background: live ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#7c3aed,#5b21b6)" }}>
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" aria-hidden />}
        {open ? <X size={22} aria-hidden className="relative" /> : live ? <PhoneCall size={22} aria-hidden className="relative script-shake" /> : <Phone size={22} aria-hidden className="relative" />}
      </button>

      {open && (
        <section role="dialog" aria-label="Telefone" className="card-in fixed bottom-24 left-5 z-[66] flex max-h-[min(42rem,calc(100dvh-7.5rem))] w-[22.5rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl">
          <header className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: live ? "linear-gradient(135deg,#15803d,#166534)" : "linear-gradient(135deg,#6d28d9,#4c1d95)" }}>
            <span className="grid size-9 place-items-center rounded-xl bg-white/15"><Phone size={18} aria-hidden /></span>
            <div className="min-w-0 flex-1"><p className="font-bold leading-tight">Telefone</p><p className="truncate text-xs text-white/75">{live ? label : ended ? "Ligação encerrada" : vocall.state === "connecting" ? "Conectando ao VocallPhone…" : "VocallPhone · pronto para ligar"}</p></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="grid size-8 place-items-center rounded-lg text-white/80 hover:bg-white/15"><X size={16} aria-hidden /></button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {inCall ? (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-1.5 py-1 text-center" role="status" aria-live="polite">
                  <span className={`relative grid size-16 place-items-center rounded-full text-white ${ended ? "bg-slate-600" : "bg-emerald-600"}`}>
                    {!ended && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" aria-hidden />}
                    {ended ? <PhoneOff size={26} aria-hidden /> : <PhoneCall size={26} aria-hidden className="relative script-shake" />}
                  </span>
                  <p className="max-w-full truncate text-base font-bold">{lead ? (lead.tradeName ?? lead.company) : call!.empresa ?? fmtPhone(callDigits)}</p>
                  <p className="figure text-sm text-muted">{fmtPhone(callDigits)}</p>
                  <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ended ? "bg-slate-500/15 text-muted" : "bg-ok/15 text-ok"}`}>{label}</span><Timer since={call!.since} endedAt={call!.endedAt} /></div>
                </div>
                {ended && (
                  call!.qualUrl
                    ? <a href={call!.qualUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-grad text-base font-bold text-on-accent shadow-lg transition hover:brightness-110 active:scale-[0.98]"><ExternalLink size={17} aria-hidden /> Qualificar na EOX</a>
                    : call!.qualLooking
                      ? <p className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Procurando a qualificação…</p>
                      : <p className="rounded-xl border border-dashed border-line px-3 py-2 text-center text-xs text-muted">Este número não tem Id da EOX no sistema. Qualifique pelo VocallPhone.</p>
                )}
                {ended && <button type="button" onClick={() => { vocall.dismiss(); setPinned(null); }} className="min-h-10 w-full rounded-xl border border-line text-sm font-semibold hover:border-accent">Nova ligação</button>}
              </div>
            ) : (
              <>
                <div className="relative">
                  <input ref={inputRef} aria-label="Número para ligar" type="tel" inputMode="numeric" autoComplete="off" placeholder="(00) 00000-0000" value={digits ? fmtPhone(digits) : ""}
                    onChange={(e) => { setNum(e.target.value.replace(/\D/g, "").slice(0, 13)); setPinned(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void dial(); } }}
                    onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 13); setNum(t); setPinned(null); }}
                    className="figure w-full rounded-2xl border border-line bg-sunk/60 px-4 py-3.5 pr-12 text-center text-2xl font-bold tracking-wide outline-none transition focus:border-accent focus:bg-panel" />
                  {digits && <button type="button" onClick={() => { setNum(digits.slice(0, -1)); setPinned(null); }} aria-label="Apagar último dígito" className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-accent/10 hover:text-ink"><Delete size={18} aria-hidden /></button>}
                </div>

                {digits.length >= 8 && (found.loading
                  ? <p className="flex items-center justify-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" aria-hidden /> Procurando o lead…</p>
                  : lead ? <LeadCard lead={lead} others={others} onPick={setPinned} />
                  : <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-center text-xs text-muted">Número sem lead cadastrado. A ligação sai, mas o Atendimento da EOX não abre.</p>)}

                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado">
                  {KEYS.map(([k, sub]) => (
                    <button key={k} type="button" onClick={() => press(k)} aria-label={k} className="flex h-12 flex-col items-center justify-center rounded-2xl border border-line bg-sunk/60 transition hover:border-accent hover:bg-accent/10 active:scale-95">
                      <span className="text-xl font-semibold leading-none">{k}</span>{sub && <span className="mt-0.5 text-[9px] font-bold tracking-widest text-muted">{sub}</span>}
                    </button>
                  ))}
                </div>
                {recent.length > 0 && !digits && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted">Recentes</p>
                    {recent.map((r) => <button key={r.digits} type="button" onClick={() => { setNum(r.digits); setPinned(null); }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-accent"><span className="truncate font-medium">{r.label}</span><span className="figure shrink-0 text-xs text-muted">{fmtPhone(r.digits)}</span></button>)}
                  </div>
                )}
              </>
            )}
            {inCall && lead && <LeadCard lead={lead} others={others} onPick={setPinned} inCall />}
          </div>

          {!inCall && (
            <footer className="border-t border-line bg-panel p-3">
              <button type="button" onClick={() => void dial()} disabled={digits.length < 8 || dialing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                  {dialing ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Phone size={20} aria-hidden />} {dialing ? "Ligando…" : "Ligar"}
                </button>

            </footer>
          )}
        </section>
      )}
    </>
  );
}
