"use client";

import { PhoneCall, PhoneOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VocallConfig } from "@/modules/vocall/config";

export type VocallState = "off" | "idle" | "connecting" | "online" | "error";
export type VocallCall = { telefone: string; empresa: string | null; estado: string | null; since: number };
type Ctx = { configured: boolean; state: VocallState; call: VocallCall | null; /** Liga: conecta ao VocallAgent só agora, pede a chamada e resolve true quando o VocallPhone confirma; false se não conectou ou não confirmou (aí vale copiar e colar no app). A conexão é cortada quando a chamada termina. */ dial: (phone: string, label?: string | null) => Promise<boolean> };
const VocallCtx = createContext<Ctx>({ configured: false, state: "off", call: null, dial: async () => false });
export const useVocall = () => useContext(VocallCtx);

export const vocallUrl = (c: Pick<VocallConfig, "host" | "port" | "secure">) => `${c.secure ? "wss" : "ws"}://${c.host}:${c.port}/vocallagent`;

const LOGIN_MS = 8_000;   // espera pela resposta do login
const CONFIRM_MS = 6_000; // espera pela confirmação de que a chamada começou
const IDLE_MS = 25_000;   // conectado sem nenhuma chamada: corta
const MAX_CALL_MS = 3 * 60 * 60_000; // trava de segurança: nenhuma conexão passa disso

/**
 * Fala com o servidor do VocallAgent pelo mesmo canal (WebSocket) que a página da EOX usa.
 * A conexão NÃO fica aberta: abre quando a pessoa clica em ligar, entra com o agente e o ramal, manda "discar",
 * acompanha o andamento e fecha assim que a chamada termina (ou se algo não andar).
 */
export function VocallProvider({ cfg, agentId, ramal, children }: { cfg: Pick<VocallConfig, "host" | "port" | "secure" | "dac" | "senha" | "prefix">; agentId: string; ramal: string; children: React.ReactNode }) {
  const [state, setState] = useState<VocallState>("idle");
  const [call, setCall] = useState<VocallCall | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const logged = useRef(false);
  const timers = useRef<{ ping?: ReturnType<typeof setInterval>; idle?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> }>({});
  const loginWait = useRef<((ok: boolean) => void)[]>([]);
  const callWait = useRef<((ok: boolean) => void)[]>([]);
  const alive = useRef(true);
  const { host, port, secure, dac, senha, prefix } = cfg;

  /** Corta a conexão e solta quem estava esperando. Pode ser chamada quantas vezes quiser. */
  const hangup = useCallback((next: VocallState = "idle") => {
    const t = timers.current;
    clearInterval(t.ping); clearTimeout(t.idle); clearTimeout(t.max);
    const s = ws.current; ws.current = null; logged.current = false;
    if (s) { s.onopen = s.onmessage = s.onerror = s.onclose = null; try { s.close(1000); } catch { /* já fechou */ } }
    loginWait.current.splice(0).forEach((r) => r(false));
    callWait.current.splice(0).forEach((r) => r(false));
    if (alive.current) setState(next);
  }, []);

  const finish = useCallback((estado: string) => {
    // a chamada acabou: mostra o aviso por 5s e corta a conexão agora
    clearTimeout(timers.current.clear);
    setCall((c) => (c ? { ...c, estado } : c));
    timers.current.clear = setTimeout(() => setCall(null), 5_000);
    hangup("idle");
  }, [hangup]);

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
      }
    };
    sock.onerror = () => { clearTimeout(giveUp); if (ws.current === sock) hangup("error"); };
    sock.onclose = () => {
      clearTimeout(giveUp);
      if (ws.current !== sock) return;
      // caiu no meio da chamada: o aviso não pode ficar preso na tela
      setCall((c) => (c && c.estado !== "Finalizado" ? { ...c, estado: "Conexão encerrada" } : c));
      clearTimeout(timers.current.clear); timers.current.clear = setTimeout(() => setCall(null), 5_000);
      hangup("idle");
    };
  }), [host, port, secure, dac, senha, agentId, ramal, hangup, finish]);

  // mudou a configuração, saiu da página ou fechou a aba: nada fica conectado
  useEffect(() => {
    alive.current = true;
    const bye = () => hangup("idle");
    window.addEventListener("pagehide", bye);
    return () => { alive.current = false; window.removeEventListener("pagehide", bye); hangup("idle"); clearTimeout(timers.current.clear); };
  }, [hangup, host, port, secure, dac, senha, agentId, ramal]);

  const dial = useCallback(async (phone: string, label?: string | null) => {
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
      s.send(JSON.stringify({ action: "discar", data: { telefone: `${prefix}${digits}`, cliente: { label: (label ?? "").replace(/\|/g, "").slice(0, 80) } } }));
    });
  }, [connect, hangup, prefix]);

  const value = useMemo(() => ({ configured: true, state, call, dial }), [state, call, dial]);
  return <VocallCtx.Provider value={value}>{children}{call && <CallPill call={call} />}</VocallCtx.Provider>;
}

function Timer({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <span className="figure">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

/** Faixa roxa como a da EOX: [EMPRESA] [TEMPO] [STATUS]. */
function CallPill({ call }: { call: VocallCall }) {
  const ended = call.estado === "Finalizado" || call.estado === "Conexão encerrada";
  return (
    <div role="status" className="fixed left-1/2 top-3 z-[65] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl card-in" style={{ background: ended ? "#475569" : "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
      {ended ? <PhoneOff size={16} aria-hidden /> : <PhoneCall size={16} aria-hidden className="script-shake" />}
      <span className="truncate">{call.empresa ?? call.telefone}</span>
      <Timer since={call.since} />
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{call.estado ?? "Em ligação"}</span>
    </div>
  );
}
