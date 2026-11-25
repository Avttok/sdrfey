"use client";

import { Ban, Check, ChevronDown, Clock, ClipboardCheck, MessageSquareOff, MailX, PhoneForwarded, PhoneMissed, UserCheck, Voicemail, Eye, EyeOff, Reply } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHANNELS, type Outcome, type TouchChannel } from "@/config/touches";

const ICON: Record<string, typeof Check> = {
  atendeu: UserCheck, recado: PhoneForwarded, nao_atendeu: PhoneMissed, caixa_postal: Voicemail, ocupado: Clock, numero_errado: Ban,
  respondeu: Reply, recebida: Eye, ignorada: EyeOff, sem_whatsapp: MessageSquareOff, recebido: Eye, ignorado: EyeOff, voltou: MailX,
};
const TONE: Record<Outcome["tone"], string> = { ok: "text-ok", info: "text-accent", warn: "text-warn", bad: "text-danger" };
const RETRY: [number, string][] = [[0, "não"], [1, "amanhã"], [3, "em 3 dias"]];

export type ResultPick = { outcome: string; personId: number | null; retryDays: number | null };

/**
 * Botão "Resultado" com seta, igual para ligação, WhatsApp e e-mail: todas as respostas que a janela "Como foi?" tinha,
 * mais "Com quem?" e "Tentar de novo". Um toque em um resultado já registra. Depois da ação feita e sem resultado,
 * o botão pulsa para lembrar de dizer como foi; com resultado, mostra qual foi.
 */
export function ResultMenu({ channel, onPick, onInvalid, current, pulse, suggest, people = [], linkedId = null, disabled }: {
  channel: TouchChannel; onPick: (p: ResultPick) => void; /** Marca o e-mail/número como inválido (aparece no fim do menu). */ onInvalid?: () => void; /** Resultado já registrado (chave). */ current?: string | null; /** A ação foi feita e falta dizer como foi. */ pulse?: boolean;
  /** Resultado sugerido (ex.: pela duração da ligação). */ suggest?: string | null; people?: { id: number; name: string; role?: string | null }[]; linkedId?: number | null; disabled?: boolean;
}) {
  const cfg = CHANNELS[channel];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const [who, setWho] = useState<number | null>(linkedId);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => { setWho(linkedId); }, [linkedId]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  const sel = current ? cfg.outcomes.find((o) => o.key === current) : null;
  const SelIcon = sel ? ICON[sel.key] ?? Check : ClipboardCheck;
    return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 120), right: Math.max(8, window.innerWidth - r.right) }); setOpen((o) => !o); }}
        className={`inline-flex min-h-10 w-48 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-3 text-sm font-bold transition active:scale-[0.97] disabled:opacity-50 ${sel ? `border-current bg-panel ${TONE[sel.tone]}` : pulse ? "hint-pulse border-accent bg-accent/10 text-accent" : "border-line bg-panel text-ink hover:bg-sunk"}`}>
        <SelIcon size={15} aria-hidden /><span className="min-w-0 flex-1 truncate text-left">{sel ? sel.label : pulse ? "Como foi?" : "Resultado"}</span><ChevronDown size={14} aria-hidden className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && host && createPortal(
        <div ref={menu} role="menu" style={{ position: "fixed", top: pos.top, right: pos.right, maxHeight: `calc(100dvh - ${pos.top + 12}px)` }} className="z-[80] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-line bg-panel py-1.5 shadow-2xl">
          <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted">{cfg.question}</p>
          <div className="space-y-2 border-b border-line px-3 pb-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold text-muted">Tentar de novo:</span>
              {RETRY.map(([d, l]) => <button key={d} type="button" aria-pressed={retry === d} onClick={() => setRetry(d)} className={`rounded-full border px-2.5 py-0.5 font-semibold ${retry === d ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-ink"}`}>{l}</button>)}
            </div>
            {people.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold text-muted">Com quem?</span>
                {people.map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} onClick={() => setWho(p.id)} className={`rounded-full border px-2.5 py-0.5 font-semibold ${who === p.id ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-ink"}`}>{p.name}</button>)}
                <button type="button" aria-pressed={who == null} onClick={() => setWho(null)} className={`rounded-full border px-2.5 py-0.5 ${who == null ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-ink"}`}>Ninguém</button>
              </div>
            )}
          </div>
          {cfg.outcomes.map((o) => {
            const I = ICON[o.key] ?? Check;
            return (
              <button key={o.key} type="button" role="menuitem" onClick={() => { setOpen(false); onPick({ outcome: o.key, personId: o.reached ? who : null, retryDays: !o.reached && !o.wrong && retry ? retry : null }); }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/10 ${current === o.key ? "bg-accent/10" : ""}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg bg-sunk ${TONE[o.tone]}`}><I size={16} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-tight">{o.label}{suggest === o.key && <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 text-[10px] font-bold text-accent">sugerido</span>}</span>{o.hint && <span className="block text-[11px] leading-snug text-muted">{o.hint}</span>}</span>
                {current === o.key && <Check size={15} className="shrink-0 text-accent" aria-hidden />}
              </button>
            );
          })}
          {onInvalid && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onInvalid(); }} className="flex w-full items-center gap-3 border-t border-line px-3 py-2 text-left hover:bg-danger/10">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger"><Ban size={16} aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-tight text-danger">Inválido</span><span className="block text-[11px] leading-snug text-muted">{channel === "email" ? "Marca este e-mail como inválido" : "Marca este número como inválido"}</span></span>
            </button>
          )}
        </div>, host)}
    </div>
  );
}
