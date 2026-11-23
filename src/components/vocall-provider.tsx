"use client";

import { PhoneCall, PhoneOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VocallConfig } from "@/modules/vocall/config";
import type { EoxRef } from "@/modules/vocall/eox";

type Qual = { id: string; telefone: string | null; empresa: string | null; atendida: boolean };

export type VocallState = "off" | "idle" | "connecting" | "online" | "error";
export type VocallCall = { telefone: string; empresa: string | null; estado: string | null; since: number };
type Ctx = { configured: boolean; state: VocallState; call: VocallCall | null; /** Liga: conecta ao VocallAgent só agora, pede a chamada e resolve true quando o VocallPhone confirma; false se não conectou ou não confirmou (aí vale copiar e colar no app). A conexão é cortada quando a chamada termina. */ dial: (phone: string, label?: string | null, eox?: EoxRef | null) => Promise<boolean> };
const VocallCtx = createContext<Ctx>({ configured: false, state: "off", call: null, dial: async () => false });
export const useVocall = () => useContext(VocallCtx);

export const vocallUrl = (c: Pick<VocallConfig, "host" | "port" | "secure">) => `${c.secure ? "wss" : "ws"}://${c.host}:${c.port}/vocallagent`;

const LOGIN_MS = 8_000;   // espera pela resposta do login
const CONFIRM_MS = 6_000; // espera pela confirmação de que a chamada começou
const IDLE_MS = 25_000;   // conectado sem nenhuma chamada: corta
const MAX_CALL_MS = 3 * 60 * 60_000; // trava de segurança: nenhuma conexão passa disso
const QUAL_WAIT_MS = 5_000;  // chamada terminou e a central não pediu qualificação: corta
const QUAL_MAX_MS = 3 * 60_000; // ninguém qualificou: corta (a pendência fica na central, como na EOX)
const QUAL_ACK_MS = 6_000;   // espera a central confirmar a qualificação enviada

/**
 * Fala com o servidor do VocallAgent pelo mesmo canal (WebSocket) que a página da EOX usa.
 * A conexão NÃO fica aberta: abre quando a pessoa clica em ligar, entra com o agente e o ramal, manda "discar",
 * acompanha o andamento e fecha assim que a chamada termina (ou se algo não andar).
 */
export function VocallProvider({ cfg, agentId, ramal, children }: { cfg: Pick<VocallConfig, "host" | "port" | "secure" | "dac" | "senha" | "prefix" | "quals">; agentId: string; ramal: string; children: React.ReactNode }) {
  const [state, setState] = useState<VocallState>("idle");
  const [call, setCall] = useState<VocallCall | null>(null);
  const [qual, setQual] = useState<Qual | null>(null);
  const [sending, setSending] = useState(false);
  const qualId = useRef<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const logged = useRef(false);
  const timers = useRef<{ ping?: ReturnType<typeof setInterval>; idle?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout>; qual?: ReturnType<typeof setTimeout>; ack?: ReturnType<typeof setTimeout> }>({});
  const loginWait = useRef<((ok: boolean) => void)[]>([]);
  const callWait = useRef<((ok: boolean) => void)[]>([]);
  const alive = useRef(true);
  const { host, port, secure, dac, senha, prefix, quals } = cfg;

  /** Corta a conexão e solta quem estava esperando. Pode ser chamada quantas vezes quiser. */
  const hangup = useCallback((next: VocallState = "idle") => {
    const t = timers.current;
    clearInterval(t.ping); clearTimeout(t.idle); clearTimeout(t.max); clearTimeout(t.qual); clearTimeout(t.ack);
    qualId.current = null;
    const s = ws.current; ws.current = null; logged.current = false;
    if (s) { s.onopen = s.onmessage = s.onerror = s.onclose = null; try { s.close(1000); } catch { /* já fechou */ } }
    loginWait.current.splice(0).forEach((r) => r(false));
    callWait.current.splice(0).forEach((r) => r(false));
    if (alive.current) { setState(next); setQual(null); setSending(false); }
  }, []);

  const finish = useCallback((estado: string) => {
    // a chamada acabou: mostra o aviso por 5s e corta a conexão agora
    clearTimeout(timers.current.clear);
    setCall((c) => (c ? { ...c, estado } : c));
    timers.current.clear = setTimeout(() => setCall(null), 5_000);
    // a central costuma pedir a qualificação logo em seguida; se não pedir, não deixa aberto
    clearTimeout(timers.current.qual);
    if (!qualId.current) timers.current.qual = setTimeout(() => { if (!qualId.current) hangup("idle"); }, QUAL_WAIT_MS);
  }, [hangup]);

  /** Pergunta à central qual ligação está esperando qualificação e abre o painel; sem pendência, corta. */
  const askQual = useCallback(async () => {
    clearTimeout(timers.current.qual); clearTimeout(timers.current.ack);
    try {
      const r = await fetch("/api/vocall/qualificacao", { method: "POST", cache: "no-store" });
      const j = (await r.json()) as { id: string | null; telefone?: string | null; empresa?: string | null; atendida?: boolean };
      if (!ws.current) return;
      if (!j.id) return hangup("idle");
      qualId.current = j.id;
      setSending(false);
      setQual({ id: j.id, telefone: j.telefone ?? null, empresa: j.empresa ?? null, atendida: j.atendida === true });
      timers.current.qual = setTimeout(() => hangup("idle"), QUAL_MAX_MS);
    } catch { hangup("idle"); }
  }, [hangup]);

  /** Manda a qualificação escolhida e corta assim que a central confirmar. */
  const qualify = useCallback((texto: string) => {
    const s = ws.current;
    if (!s || s.readyState !== 1 || !qualId.current) return hangup("idle");
    s.send(JSON.stringify({ action: "qualificar", data: { id_qualificacao_pendente: qualId.current, qualificacao: texto } }));
    setSending(true);
    clearTimeout(timers.current.qual);
    timers.current.ack = setTimeout(() => hangup("idle"), QUAL_ACK_MS);
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
      } else if (m.action === "aguardando_qualificacao") {
        clearTimeout(timers.current.idle);
        void askQual();
      } else if (m.action === "retorno_qualificacao") {
        // confirmou; se ainda sobrou outra ligação sem qualificar, pede a próxima, senão corta
        clearTimeout(timers.current.ack); qualId.current = null; setQual(null); setSending(false);
        if (Number((m.data as { pendentes?: unknown } | undefined)?.pendentes) > 0) void askQual(); else hangup("idle");
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
  }), [host, port, secure, dac, senha, agentId, ramal, hangup, finish, askQual]);

  // mudou a configuração, saiu da página ou fechou a aba: nada fica conectado
  useEffect(() => {
    alive.current = true;
    const bye = () => hangup("idle");
    window.addEventListener("pagehide", bye);
    return () => { alive.current = false; window.removeEventListener("pagehide", bye); hangup("idle"); clearTimeout(timers.current.clear); };
  }, [hangup, host, port, secure, dac, senha, agentId, ramal]);

  const dial = useCallback(async (phone: string, label?: string | null, eox?: EoxRef | null) => {
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
  return <VocallCtx.Provider value={value}>{children}{call && <CallPill call={call} />}{qual && <QualDialog qual={qual} quals={quals} sending={sending} onPick={qualify} />}</VocallCtx.Provider>;
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

/** Painel que aparece quando a ligação termina: uma escolha e pronto (a conexão é cortada em seguida). */
function QualDialog({ qual, quals, sending, onPick }: { qual: Qual; quals: VocallConfig["quals"]; sending: boolean; onPick: (texto: string) => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="qual-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-2xl card-in">
        <div>
          <h2 id="qual-title" className="text-lg font-bold">Como foi a ligação?</h2>
          <p className="text-sm text-muted">{qual.empresa ?? qual.telefone ?? "Ligação encerrada"} · escolha uma opção para liberar o telefone.</p>
        </div>
        <div className="grid gap-2">
          {quals.map((q) => (
            <button key={q.texto} type="button" disabled={sending} onClick={() => onPick(q.texto)} className="min-h-12 rounded-xl border border-line bg-sunk px-4 py-2 text-left text-sm font-semibold transition hover:border-accent hover:bg-accent/10 disabled:opacity-50">{q.label}</button>
          ))}
        </div>
        {sending && <p role="status" className="text-xs text-muted">Enviando…</p>}
      </div>
    </div>
  );
}
