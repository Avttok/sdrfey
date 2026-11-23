"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VocallConfig } from "@/modules/vocall/config";
import { hintLastCall } from "@/lib/touch-bus";
import { PhoneDock } from "@/components/phone-dock";
import { qualificationUrl, type EoxRef } from "@/modules/vocall/eox";

export type VocallState = "off" | "idle" | "connecting" | "online" | "error";
export type VocallCall = { telefone: string; empresa: string | null; estado: string | null; since: number; /** Momento em que a chamada acabou (congela o cronômetro). */ endedAt?: number; /** Formulário de Atendimento da EOX para qualificar esta ligação. */ qualUrl?: string | null; /** Procurando a qualificação pendente na central. */ qualLooking?: boolean };
type Ctx = { configured: boolean; /** Painel do telefone aberto. */ panel: boolean; setPanel: (open: boolean) => void; /** Texto colocado antes do número ao discar (para reconhecer o lead na chamada). */ prefix: string; state: VocallState; call: VocallCall | null; /** Liga: conecta ao VocallAgent só agora, pede a chamada e resolve true quando o VocallPhone confirma; false se não conectou ou não confirmou (aí vale copiar e colar no app). A conexão é cortada quando a chamada termina. */ dial: (phone: string, label?: string | null, eox?: EoxRef | null) => Promise<boolean>; /** Fecha o aviso da ligação que acabou. */ dismiss: () => void };
const VocallCtx = createContext<Ctx>({ configured: false, panel: false, setPanel: () => {}, prefix: "", state: "off", call: null, dial: async () => false, dismiss: () => {} });
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
  const [panel, setPanel] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const logged = useRef(false);
  const timers = useRef<{ ping?: ReturnType<typeof setInterval>; idle?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout>; qual?: ReturnType<typeof setTimeout> }>({});
  const loginWait = useRef<((ok: boolean) => void)[]>([]);
  const callWait = useRef<((ok: boolean) => void)[]>([]);
  const alive = useRef(true);
  /** Quando a chamada foi atendida (para saber duração) e se o painel de resultado já foi avisado. */
  const answeredAt = useRef<number | null>(null);
  const hinted = useRef(true);
  /** A central disse que esta chamada não tem qualificação (retorno "Desconhecido"). */
  const noQual = useRef(false);
  /** Nome mostrado na chamada (a central não recebe mais o cliente). */
  const dialLabel = useRef<string | null>(null);
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
      if (j.id && /^\d+$/.test(j.id) && !noQual.current && eoxRef.current?.origin) url = qualificationUrl(eoxRef.current, j.id);
    } catch { /* sem link: o painel só avisa que acabou */ }
    hangup("idle");
    if (!alive.current) return;
    setCall((c) => (c ? { ...c, qualUrl: url, qualLooking: false } : c));
    dismissIn(url ? QUAL_KEEP_MS : GONE_MS);
  }, [hangup, dismissIn]);

  const finish = useCallback((estado: string) => {
    if (!hinted.current) { hinted.current = true; const a = answeredAt.current; hintLastCall(a != null, a != null ? Math.round((Date.now() - a) / 1000) : null); }
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
        if (/^atendid/i.test(d.estado ?? "") && !answeredAt.current) answeredAt.current = Date.now();
        clearTimeout(timers.current.idle); clearTimeout(timers.current.clear);
        callWait.current.splice(0).forEach((r) => r(true));
        setCall((c) => ({ telefone: String(d.telefone ?? c?.telefone ?? ""), empresa: (d.cliente && typeof d.cliente === "object" ? d.cliente.label : null) ?? c?.empresa ?? dialLabel.current, estado: d.estado ?? null, since: c && c.telefone === d.telefone ? c.since : Date.now() }));
        if (d.estado === "Finalizado") finish("Finalizado");
      } else if (m.action === "retorno_qualificacao") {
        const id = String((m.data as { id_qualificacao_pendente?: unknown } | undefined)?.id_qualificacao_pendente ?? "");
        if (!/^\d+$/.test(id)) { noQual.current = true; setCall((c) => (c ? { ...c, qualUrl: null } : c)); }
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
      if (!hinted.current) { hinted.current = true; const a = answeredAt.current; hintLastCall(a != null, a != null ? Math.round((Date.now() - a) / 1000) : null); }
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
    eoxRef.current = eox ?? null; answeredAt.current = null; hinted.current = false; noQual.current = false; dialLabel.current = label ?? null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return false;
    setPanel(true); // ligou: o discador abre sozinho; se a pessoa minimizar, o botão flutuante mostra a chamada
    const s = await connect();
    if (!s || s.readyState !== 1) return false;
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const waiter = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
      callWait.current.push(waiter);
      // o VocallPhone não confirmou: tira da fila e não deixa a conexão aberta à toa
      timer = setTimeout(() => { const i = callWait.current.indexOf(waiter); if (i >= 0) { callWait.current.splice(i, 1); resolve(false); hangup("idle"); } }, CONFIRM_MS);
      // Só o número, como o VocallPhone faz: sem "cliente" a central não cria qualificação para número que a EOX não conhece
      // (retorno "Desconhecido"). Com "cliente" ela criava e a EOX abria o formulário com parent_id=undefined (erro 500).
      s.send(JSON.stringify({ action: "discar", data: { telefone: `${prefix}${digits}` } }));
    });
  }, [connect, hangup, prefix]);

  const value = useMemo(() => ({ configured: true, panel, setPanel, prefix, state, call, dial, dismiss: () => { clearTimeout(timers.current.clear); setCall(null); } }), [panel, prefix, state, call, dial]);
  return <VocallCtx.Provider value={value}>{children}<PhoneDock /></VocallCtx.Provider>;
}
