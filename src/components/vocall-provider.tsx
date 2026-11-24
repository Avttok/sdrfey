"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VocallConfig } from "@/modules/vocall/config";
import { hintLastCall } from "@/lib/touch-bus";
import { PhoneDock } from "@/components/phone-dock";
import { qualificationLink, type EoxRef } from "@/modules/vocall/eox";

export type VocallState = "off" | "idle" | "connecting" | "online" | "error";
export type VocallCall = { telefone: string; empresa: string | null; estado: string | null; since: number; /** Momento em que a chamada acabou (congela o cronômetro). */ endedAt?: number; /** Formulário de Atendimento da EOX para qualificar esta ligação. */ qualUrl?: string | null; /** Procurando a qualificação pendente na central. */ qualLooking?: boolean };
type Ctx = { configured: boolean; /** Chamada acabou e o sistema ainda confere se há qualificação: nada de nova ligação até acabar. */ checking: boolean; /** Quantas consultas seguidas do ramal falharam (muitas = algo prendendo o VocallPhone). */ fails: number; /** Roteiro durante a ligação liberado (chave do Adm + permissão). */ roteiroOn: boolean; /** O VocallPhone está livre para ligar (consulta automática a cada 3 s). null = ainda consultando; false = ocupado ou liberando a última chamada. */ ready: boolean | null; /** Painel do telefone aberto. */ panel: boolean; setPanel: (open: boolean) => void; /** Texto colocado antes do número ao discar (para reconhecer o lead na chamada). */ prefix: string; state: VocallState; call: VocallCall | null; /** Liga: conecta ao VocallAgent só agora, pede a chamada e resolve true quando o VocallPhone confirma; false se não conectou ou não confirmou (aí vale copiar e colar no app). A conexão é cortada quando a chamada termina. */ dial: (phone: string, label?: string | null, eox?: EoxRef | null) => Promise<boolean>; /** Fecha o aviso da ligação que acabou. */ dismiss: () => void };
const VocallCtx = createContext<Ctx>({ configured: false, checking: false, fails: 0, roteiroOn: true, ready: null, panel: false, setPanel: () => {}, prefix: "", state: "off", call: null, dial: async () => false, dismiss: () => {} });
export const useVocall = () => useContext(VocallCtx);

export const vocallUrl = (c: Pick<VocallConfig, "host" | "port" | "secure">) => `${c.secure ? "wss" : "ws"}://${c.host}:${c.port}/vocallagent`;

/** Estado do ramal que o VocallAgent informa em `livre`: false ou "Waiting" = livre, esperando chamada (é o que a página da EOX também considera livre). */
const isFree = (st: string | false | null | undefined) => st === false || st === null || (typeof st === "string" && /^waiting$/i.test(st));
const LOGIN_MS = 8_000;   // espera pela resposta do login
const CONFIRM_MS = 6_000; // espera pela confirmação de que a chamada começou
const IDLE_MS = 25_000;   // conectado sem nenhuma chamada: corta
const MAX_CALL_MS = 3 * 60 * 60_000; // trava de segurança: nenhuma conexão passa disso
const QUAL_WAIT_MS = 6_000;  // chamada terminou e a central não pediu qualificação: corta
const QUAL_KEEP_MS = 15 * 60_000; // o botão Qualificar fica no painel por até 15 min
/** Resultado enviado à central quando o número não tem cadastro na EOX (libera o ramal sem abrir atendimento). */
const NO_RECORD_QUAL = "Caixa postal";
const GONE_MS = 8_000;        // sem nada a qualificar, o aviso de "encerrada" some

/**
 * Fala com o servidor do VocallAgent pelo mesmo canal (WebSocket) que a página da EOX usa.
 * A conexão NÃO fica aberta: abre quando a pessoa clica em ligar, entra com o agente e o ramal, manda "discar",
 * acompanha o andamento e fecha assim que a chamada termina (ou se algo não andar).
 */
export function VocallProvider({ cfg, agentId, ramal, eoxBase, roteiroOn = true, children }: { roteiroOn?: boolean; /** Endereço da EOX: de onde sai o link da qualificação. */ eoxBase?: string; cfg: Pick<VocallConfig, "host" | "port" | "secure" | "dac" | "senha" | "prefix">; agentId: string; ramal: string; children: React.ReactNode }) {
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
  /** Id da chamada na central (id_chamada) = sourceuuid do formulário de qualificação da EOX. */
  const srcId = useRef<string | null>(null);
  const dialDigits = useRef<string>("");
  /** Último estado do ramal informado pelo VocallAgent (undefined = ainda não informou). false = livre. */
  const livre = useRef<string | false | null | undefined>(undefined);
  /** O VocallPhone está livre? Consulta própria, fora da conexão da chamada. */
  const [ready, setReady] = useState<boolean | null>(null);
  const [fails, setFails] = useState(0);
  const checkingRef = useRef(false);
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

  /**
   * A central avisou que há (ou não) qualificação. Com o id (sourceuuid) em mãos o link da EOX sai direto; sem ele, pergunta ao
   * qualificacao.php. "Desconhecido" = a EOX decidiu que não há qualificação: não mostra nada. A conexão é cortada em seguida.
   */
  const askQual = useCallback(async (knownId?: string) => {
    clearTimeout(timers.current.qual);
    setCall((c) => (c ? { ...c, qualLooking: true } : c));
    let id: string | null = knownId && /^\d+$/.test(knownId) ? knownId : srcId.current;
    let parent: string | null = null, base = "", empresa: string | null = null;
    if (!id || !eoxRef.current) {
      try {
        const r = await fetch("/api/vocall/qualificacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefone: dialDigits.current }), cache: "no-store" });
        const j = (await r.json()) as { id: string | null; parent?: string | null; eoxBase?: string | null; empresa?: string | null };
        parent = j.parent ?? null; base = j.eoxBase ?? ""; empresa = j.empresa ?? null;
        if (j.id && /^\d+$/.test(j.id)) id = id ?? j.id;
      } catch { /* sem link: o painel só avisa que acabou */ }
    }
    const origin = eoxRef.current?.origin || base || eoxBase || "";
    const ref = eoxRef.current ?? (parent ? { crmid: parent, setype: "Accounts" } : null);
    const url = id && origin && ref?.crmid ? qualificationLink(origin, ref, id) : null; // número sem cadastro na EOX: sem link
    // número sem cadastro na EOX: não há atendimento a registrar. Avisa a central que está tudo certo para o ramal voltar a "Disponível".
    const sock = ws.current;
    if (!url && id && sock && sock.readyState === 1) {
      try { sock.send(JSON.stringify({ action: "qualificar", data: { id_qualificacao_pendente: id, qualificacao: NO_RECORD_QUAL } })); await new Promise((r) => setTimeout(r, 1_500)); } catch { /* segue: a conexão é fechada logo abaixo */ }
    }
    hangup("idle");
    if (!alive.current) return;
    setCall((c) => (c ? { ...c, qualUrl: url, qualLooking: false } : c));
    dismissIn(url ? QUAL_KEEP_MS : GONE_MS);
  }, [hangup, dismissIn, eoxBase]);

  const finish = useCallback((estado: string) => {
    if (!hinted.current) { hinted.current = true; const a = answeredAt.current; hintLastCall(a != null, a != null ? Math.round((Date.now() - a) / 1000) : null); }
    setReady(false); // acabou: o VocallPhone leva de 15 a 20 s para liberar a próxima; a consulta automática avisa quando liberar
    // a chamada acabou: o cronômetro para; a central costuma pedir a qualificação logo em seguida
    setCall((c) => (c ? { ...c, estado, endedAt: c.endedAt ?? Date.now() } : c));
    clearTimeout(timers.current.clear);
    clearTimeout(timers.current.qual);
    timers.current.qual = setTimeout(() => void askQual(), 800); // o id da chamada já é o sourceuuid: o botão Qualificar sai logo
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
        const d = m.data as { telefone?: string; estado?: string; id_chamada?: string | number; cliente?: { label?: string } | false };
        if (/^\d+$/.test(String(d.id_chamada ?? ""))) srcId.current = String(d.id_chamada);
        if (/^atendid/i.test(d.estado ?? "") && !answeredAt.current) answeredAt.current = Date.now();
        clearTimeout(timers.current.idle); clearTimeout(timers.current.clear);
        callWait.current.splice(0).forEach((r) => r(true));
        setCall((c) => ({ telefone: String(d.telefone ?? c?.telefone ?? ""), empresa: (d.cliente && typeof d.cliente === "object" ? d.cliente.label : null) ?? c?.empresa ?? dialLabel.current, estado: d.estado ?? null, since: c && c.telefone === d.telefone ? c.since : Date.now() }));
        if (d.estado === "Finalizado") finish("Finalizado");
      } else if (m.action === "livre") {
        const st = (m.data as { state?: unknown } | undefined)?.state;
        livre.current = typeof st === "string" ? st : false;
      } else if (m.action === "retorno_qualificacao") {
        // a EOX respondeu: id numérico = há qualificação (é o sourceuuid); "Desconhecido" = não há
        const id = String((m.data as { id_qualificacao_pendente?: unknown } | undefined)?.id_qualificacao_pendente ?? "");
        clearTimeout(timers.current.idle);
        const pend = String((m.data as { pendentes?: unknown } | undefined)?.pendentes ?? "");
        if (/^\d+$/.test(id)) void askQual(id); else { if (pend === "0") noQual.current = true; void askQual(); }
      } else if (m.action === "aguardando_qualificacao") {
        clearTimeout(timers.current.idle);
        // espera a resposta da EOX (retorno_qualificacao); se não vier em 3 s, pergunta direto à central
        clearTimeout(timers.current.qual);
        timers.current.qual = setTimeout(() => void askQual(), 3_000);
      }
    };
    sock.onerror = () => { clearTimeout(giveUp); if (ws.current === sock) hangup("error"); };
    sock.onclose = () => {
      clearTimeout(giveUp);
      if (ws.current !== sock) return;
      // caiu no meio da chamada: o aviso não pode ficar preso na tela
      if (!hinted.current) { hinted.current = true; const a = answeredAt.current; hintLastCall(a != null, a != null ? Math.round((Date.now() - a) / 1000) : null); }
      setCall((c) => (c && c.estado !== "Finalizado" ? { ...c, estado: "Conexão encerrada", endedAt: Date.now(), qualLooking: false } : c));
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

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  /** Espera o VocallAgent informar o estado do ramal. */
  const waitLivre = useCallback(async (ms: number) => { const end = Date.now() + ms; while (livre.current === undefined && Date.now() < end && ws.current) await sleep(100); return livre.current; }, []);

  /** Uma tentativa: entra e pede a chamada. */
  const attempt = useCallback(async (digits: string): Promise<boolean> => {
    livre.current = undefined;
    const s = await connect();
    if (!s || s.readyState !== 1) return false;
    await waitLivre(1_500);
    if (s.readyState !== 1) return false;
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const waiter = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
      callWait.current.push(waiter);
      timer = setTimeout(() => { const i = callWait.current.indexOf(waiter); if (i >= 0) { callWait.current.splice(i, 1); resolve(false); hangup("idle"); } }, CONFIRM_MS);
      // Igual à página da EOX: com o cadastro conhecido vai o "cliente" completo (tipo + Código EOX); sem cadastro vai só o número.
      const eox = eoxRef.current;
      const cliente = eox ? { label: (dialLabel.current ?? "").replace(/\|/g, "").slice(0, 80), setype: eox.setype, crmid: eox.crmid, ...(eox.setype !== "Contacts" ? { id_contato: 0 } : {}) } : null;
      s.send(JSON.stringify({ action: "discar", data: { telefone: `${prefix}${digits}`, ...(cliente ? { cliente } : {}) } }));
    });
  }, [connect, hangup, prefix, waitLivre]);

  const dial = useCallback(async (phone: string, label?: string | null, eox?: EoxRef | null) => {
    eoxRef.current = eox ?? null; srcId.current = null; dialDigits.current = phone.replace(/\D/g, ""); answeredAt.current = null; hinted.current = false; noQual.current = false; dialLabel.current = label ?? null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || checkingRef.current) return false;
    setPanel(true); // ligou: o discador abre sozinho; se a pessoa minimizar, o botão flutuante mostra a chamada
    setReady(false);
    let ok = await attempt(digits);
    if (!ok) { hangup("idle"); await sleep(700); ok = await attempt(digits); } // não confirmou: entra de novo do zero uma vez
    if (!ok) hangup("idle");
    return ok;
  }, [attempt, hangup]);

  /** Consulta única: entra no VocallAgent só para ler o estado do ramal e sai. true = livre. Não mexe na conexão da chamada. */
  const probe = useCallback(() => new Promise<boolean>((resolve) => {
    let sock: WebSocket | null = null; let done = false; let t: ReturnType<typeof setTimeout> | undefined;
    const end = (ok: boolean) => { if (done) return; done = true; clearTimeout(t); if (sock) { sock.onopen = sock.onmessage = sock.onerror = sock.onclose = null; try { sock.close(1000); } catch { /* já fechou */ } } resolve(ok); };
    try { sock = new WebSocket(vocallUrl({ host, port, secure })); } catch { return resolve(false); }
    t = setTimeout(() => end(false), 4_000);
    sock.onopen = () => sock?.send(JSON.stringify({ action: "login", data: { id: agentId, ramal, dac, senha } }));
    sock.onmessage = (ev) => {
      let m: { action?: string; data?: { state?: unknown }; erro?: unknown };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.action === "login" && m.erro) end(false);
      else if (m.action === "livre") end(isFree(typeof m.data?.state === "string" ? m.data.state : false));
    };
    sock.onerror = () => end(false);
    sock.onclose = () => end(false);
  }), [host, port, secure, agentId, ramal, dac, senha]);

  // painel aberto: começa do zero (o estado de antes pode ter mudado)
  useEffect(() => { if (panel) { setReady((r) => (r === true ? null : r)); setFails(0); } }, [panel]);
  // consulta a cada 3 s, em silêncio, enquanto o discador está aberto (ou o VocallPhone ainda libera a última chamada), até achar o ramal livre
  const busy = state !== "idle" || (!!call && !call.endedAt);
  useEffect(() => {
    if (ready === true || busy || !(panel || ready === false)) return;
    let stop = false; let timer: ReturnType<typeof setTimeout>; let n = 0;
    // cada consulta é um login no VocallAgent (o ramal pode apitar): espaça aos poucos e não consulta com a aba escondida
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) { timer = setTimeout(() => void tick(), 5_000); return; }
      const ok = await probe();
      if (stop || !alive.current) return;
      if (ok) { setReady(true); setFails(0); } else { setFails((f) => f + 1); timer = setTimeout(() => void tick(), Math.min(3_000 + n++ * 3_000, 15_000)); }
    };
    timer = setTimeout(() => void tick(), ready === null ? 0 : 3_000);
    return () => { stop = true; clearTimeout(timer); };
  }, [ready, busy, panel, probe]);

  const checking = !!call?.endedAt && call.qualLooking !== false;
  checkingRef.current = checking;
  const value = useMemo(() => ({ configured: true, checking, fails, roteiroOn, ready: checking ? false : ready, panel, setPanel, prefix, state, call, dial, dismiss: () => { clearTimeout(timers.current.clear); setCall(null); } }), [roteiroOn, ready, checking, fails, panel, prefix, state, call, dial]);
  return <VocallCtx.Provider value={value}>{children}<PhoneDock /></VocallCtx.Provider>;
}
