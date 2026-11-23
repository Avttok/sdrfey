"use client";

import { ExternalLink, Loader2, PhoneCall, PhoneOff, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VocallConfig } from "@/modules/vocall/config";
import { qualificationUrl, type EoxRef } from "@/modules/vocall/eox";

export type VocallState = "off" | "idle" | "connecting" | "online" | "error";
export type VocallCall = { telefone: string; empresa: string | null; estado: string | null; since: number; /** Momento em que a chamada acabou (congela o cronômetro). */ endedAt?: number; /** Formulário de Atendimento da EOX para qualificar esta ligação. */ qualUrl?: string | null; /** Procurando a qualificação pendente na central. */ qualLooking?: boolean };
type Ctx = { configured: boolean; state: VocallState; call: VocallCall | null; /** Liga: conecta ao VocallAgent só agora, pede a chamada e resolve true quando o VocallPhone confirma; false se não conectou ou não confirmou (aí vale copiar e colar no app). A conexão é cortada quando a chamada termina. */ dial: (phone: string, label?: string | null, eox?: EoxRef | null) => Promise<boolean> };
const VocallCtx = createContext<Ctx>({ configured: false, state: "off", call: null, dial: async () => false });
export const useVocall = () => useContext(VocallCtx);

export const vocallUrl = (c: Pick<VocallConfig, "host" | "port" | "secure">) => `${c.secure ? "wss" : "ws"}://${c.host}:${c.port}/vocallagent`;

const LOGIN_MS = 8_000;   // espera pela resposta do login
const CONFIRM_MS = 6_000; // espera pela confirmação de que a chamada começou
const IDLE_MS = 25_000;   // conectado sem nenhuma chamada: corta
const MAX_CALL_MS = 3 * 60 * 60_000; // trava de segurança: nenhuma conexão passa disso
const QUAL_WAIT_MS = 6_000;  // chamada terminou e a central não pediu qualificação: corta
const QUAL_KEEP_MS = 15 * 60_000; // o botão Qualificar fica no painel por até 15 min
const GONE_MS = 8_000;        // sem nada a qualificar, o aviso de "encerrada" some

/**
 * Fala com o servidor do VocallAgent pelo mesmo canal (WebSocket) que a página da EOX usa.
 * A conexão NÃO fica aberta: abre quando a pessoa clica em ligar, entra com o agente e o ramal, manda "discar",
 * acompanha o andamento e fecha assim que a chamada termina (ou se algo não andar).
 */
export function VocallProvider({ cfg, agentId, ramal, children }: { cfg: Pick<VocallConfig, "host" | "port" | "secure" | "dac" | "senha" | "prefix">; agentId: string; ramal: string; children: React.ReactNode }) {
  const [state, setState] = useState<VocallState>("idle");
  const [call, setCall] = useState<VocallCall | null>(null);
  const eoxRef = useRef<EoxRef | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const logged = useRef(false);
  const timers = useRef<{ ping?: ReturnType<typeof setInterval>; idle?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout>; qual?: ReturnType<typeof setTimeout> }>({});
  const loginWait = useRef<((ok: boolean) => void)[]>([]);
  const callWait = useRef<((ok: boolean) => void)[]>([]);
  const alive = useRef(true);
  const { host, port, secure, dac, senha, prefix } = cfg;

  /** Corta a conexão e solta quem estava esperando. Pode ser chamada quantas vezes quiser. */
  const hangup = useCallback((next: VocallState = "idle") => {
    const t = timers.current;
    clearInterval(t.ping); clearTimeout(t.idle); clearTimeout(t.max); clearTimeout(t.qual);
    const s = ws.current; ws.current = null; logged.current = false;
    if (s) { s.onopen = s.onmessage = s.onerror = s.onclose = null; try { s.close(1000); } catch { /* já fechou */ } }
    loginWait.current.splice(0).forEach((r) => r(false));
    callWait.current.splice(0).forEach((r) => r(false));
    if (alive.current) setState(next);
  }, []);

  /** Tira o painel depois de um tempo. */
  const dismissIn = useCallback((ms: number) => {
    clearTimeout(timers.current.clear);
    timers.current.clear = setTimeout(() => setCall(null), ms);
  }, []);

  /** Pergunta à central qual ligação espera qualificação e monta o link do Atendimento da EOX. A conexão é cortada em seguida. */
  const askQual = useCallback(async () => {
    clearTimeout(timers.current.qual);
    setCall((c) => (c ? { ...c, qualLooking: true } : c));
    let url: string | null = null;
    try {
      const r = await fetch("/api/vocall/qualificacao", { method: "POST", cache: "no-store" });
      const j = (await r.json()) as { id: string | null };
      if (j.id && eoxRef.current?.origin) url = qualificationUrl(eoxRef.current, j.id);
    } catch { /* sem link: o painel só avisa que acabou */ }
    hangup("idle");
    if (!alive.current) return;
    setCall((c) => (c ? { ...c, qualUrl: url, qualLooking: false } : c));
    dismissIn(url ? QUAL_KEEP_MS : GONE_MS);
  }, [hangup, dismissIn]);

  const finish = useCallback((estado: string) => {
    // a chamada acabou: o cronômetro para; a central costuma pedir a qualificação logo em seguida
    setCall((c) => (c ? { ...c, estado, endedAt: c.endedAt ?? Date.now() } : c));
    clearTimeout(timers.current.clear);
    clearTimeout(timers.current.qual);
    timers.current.qual = setTimeout(() => void askQual(), QUAL_WAIT_MS); // se ela não pedir, procura mesmo assim e corta
  }, [askQual]);

  /** Garante uma conexão com login feito. Devolve o socket pronto ou null. */
  const connect = useCallback((): Promise<WebSocket | null> => new Promise((resolve) => {
    if (ws.current && logged.current && ws.current.readyState === 1) return resolve(ws.current);
    if (ws.current) { loginWait.current.push((ok) => resolve(ok ? ws.current : null)); return; } // já está conectando
    let sock: WebSocket;
    try { sock = new WebSocket(vocallUrl({ host, port, secure })); } catch { setState("error"); return resolve(null); }
    ws.current = sock; logged.current = false;
    setState("connecting");
    loginWait.current.push((ok) => resolve(ok ? sock : null));
    const giveUp = setTimeout(() => { if (ws.current === sock && !logged.current) hangup("error"); }, LOGIN_MS);
    timers.current.max = setTimeout(() => hangup("idle"), MAX_CALL_MS);
    sock.onopen = () => sock.send(JSON.stringify({ action: "login", data: { id: agentId, ramal, dac, senha } }));
    sock.onmessage = (ev) => {
      let m: { action?: string; data?: Record<string, unknown>; erro?: unknown };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.action === "login") {
        clearTimeout(giveUp);
        if (m.erro) return hangup("error");
        logged.current = true; setState("online");
        loginWait.current.splice(0).forEach((r) => r(true));
        clearInterval(timers.current.ping);
        timers.current.ping = setInterval(() => { if (sock.readyState === 1) sock.send(JSON.stringify({ action: "ping", data: {} })); }, 10_000);
        // conectou mas ninguém ligou: não deixa aberto
        clearTimeout(timers.current.idle); timers.current.idle = setTimeout(() => hangup("idle"), IDLE_MS);
      } else if (m.action === "chamada" && m.data) {
        const d = m.data as { telefone?: string; estado?: string; cliente?: { label?: string } | false };
        clearTimeout(timers.current.idle); clearTimeout(timers.current.clear);
        callWait.current.splice(0).forEach((r) => r(true));
        setCall((c) => ({ telefone: String(d.telefone ?? c?.telefone ?? ""), empresa: (d.cliente && typeof d.cliente === "object" ? d.cliente.label : null) ?? c?.empresa ?? null, estado: d.estado ?? null, since: c && c.telefone === d.telefone ? c.since : Date.now() }));
        if (d.estado === "Finalizado") finish("Finalizado");
      } else if (m.action === "aguardando_qualificacao") {
        clearTimeout(timers.current.idle);
        void askQual();
      }
    };
    sock.onerror = () => { clearTimeout(giveUp); if (ws.current === sock) hangup("error"); };
    sock.onclose = () => {
      clearTimeout(giveUp);
      if (ws.current !== sock) return;
      // caiu no meio da chamada: o aviso não pode ficar preso na tela
      setCall((c) => (c && c.estado !== "Finalizado" ? { ...c, estado: "Conexão encerrada", endedAt: Date.now() } : c));
      dismissIn(GONE_MS);
      hangup("idle");
    };
  }), [host, port, secure, dac, senha, agentId, ramal, hangup, finish, askQual, dismissIn]);

  // mudou a configuração, saiu da página ou fechou a aba: nada fica conectado
  useEffect(() => {
    alive.current = true;
    const bye = () => hangup("idle");
    window.addEventListener("pagehide", bye);
    return () => { alive.current = false; window.removeEventListener("pagehide", bye); hangup("idle"); clearTimeout(timers.current.clear); };
  }, [hangup, host, port, secure, dac, senha, agentId, ramal]);

  const dial = useCallback(async (phone: string, label?: string | null, eox?: EoxRef | null) => {
    eoxRef.current = eox ?? null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return false;
    const s = await connect();
    if (!s || s.readyState !== 1) return false;
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const waiter = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
      callWait.current.push(waiter);
      // o VocallPhone não confirmou: tira da fila e não deixa a conexão aberta à toa
      timer = setTimeout(() => { const i = callWait.current.indexOf(waiter); if (i >= 0) { callWait.current.splice(i, 1); resolve(false); hangup("idle"); } }, CONFIRM_MS);
      s.send(JSON.stringify({ action: "discar", data: { telefone: `${prefix}${digits}`, cliente: { label: (label ?? "").replace(/\|/g, "").slice(0, 80), ...(eox ? { setype: eox.setype, crmid: eox.crmid, ...(eox.setype !== "Contacts" ? { id_contato: 0 } : {}) } : {}) } } }));
    });
  }, [connect, hangup, prefix]);

  const value = useMemo(() => ({ configured: true, state, call, dial }), [state, call, dial]);
  return <VocallCtx.Provider value={value}>{children}{call && <CallPill call={call} onClose={() => { clearTimeout(timers.current.clear); setCall(null); }} />}</VocallCtx.Provider>;
}

function Timer({ since, endedAt }: { since: number; endedAt?: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    if (endedAt) return;
    setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t);
  }, [endedAt]);
  const s = Math.max(0, Math.floor(((endedAt ?? now) - since) / 1000));
  return <span className="figure text-lg font-bold tabular-nums">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

/** Painel flutuante da ligação, embaixo e no centro: durante a chamada mostra quem e há quanto tempo; ao fim oferece "Qualificar". */
function CallPill({ call, onClose }: { call: VocallCall; onClose: () => void }) {
  const ended = !!call.endedAt;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-4 z-[65] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 p-2.5 pr-3 text-white shadow-2xl card-in" style={{ background: ended ? "linear-gradient(135deg,#1e293b,#0f172a)" : "linear-gradient(135deg,#5b21b6,#3b0f8c)" }}>
        <span className={`relative grid size-11 shrink-0 place-items-center rounded-xl ${ended ? "bg-white/10" : "bg-white/15"}`}>
          {ended ? <PhoneOff size={20} aria-hidden /> : <><span className="absolute inset-0 animate-ping rounded-xl bg-white/20" aria-hidden /><PhoneCall size={20} aria-hidden className="relative script-shake" /></>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{call.empresa ?? call.telefone}</p>
          <p className="truncate text-xs text-white/70">{call.empresa ? `${call.telefone} · ` : ""}{ended ? (call.estado === "Finalizado" ? "Ligação encerrada" : call.estado) : (call.estado ?? "Em ligação")}</p>
        </div>
        <Timer since={call.since} endedAt={call.endedAt} />
        {ended && call.qualLooking && <span className="flex items-center gap-1.5 text-xs text-white/70"><Loader2 size={14} className="animate-spin" aria-hidden /> Buscando…</span>}
        {ended && call.qualUrl && <a href={call.qualUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-slate-900 transition hover:bg-amber-200"><ExternalLink size={15} aria-hidden /> Qualificar</a>}
        {ended && <button type="button" onClick={onClose} aria-label="Fechar painel da ligação" className="grid size-9 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"><X size={16} aria-hidden /></button>}
      </div>
    </div>
  );
}
