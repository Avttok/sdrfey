"use client";

import { PhoneCall, PhoneOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VocallConfig } from "@/modules/vocall/config";

export type VocallState = "off" | "connecting" | "online" | "error";
export type VocallCall = { telefone: string; empresa: string | null; estado: string | null; since: number };
type Ctx = { configured: boolean; state: VocallState; call: VocallCall | null; /** Pede a ligação. Resolve true quando o VocallPhone confirma a chamada; false se não confirmou em 6s (aí vale copiar e colar no app). */ dial: (phone: string, label?: string | null) => Promise<boolean> };
const VocallCtx = createContext<Ctx>({ configured: false, state: "off", call: null, dial: async () => false });
export const useVocall = () => useContext(VocallCtx);

export const vocallUrl = (c: Pick<VocallConfig, "host" | "port" | "secure">) => `${c.secure ? "wss" : "ws"}://${c.host}:${c.port}/vocallagent`;

/**
 * Fala com o servidor do VocallAgent pelo mesmo canal (WebSocket) que a página da EOX usa:
 * entra com o agente e o ramal, manda "discar" e recebe o andamento da chamada.
 */
export function VocallProvider({ cfg, agentId, ramal, children }: { cfg: Pick<VocallConfig, "host" | "port" | "secure" | "dac" | "senha" | "prefix">; agentId: string; ramal: string; children: React.ReactNode }) {
  const [state, setState] = useState<VocallState>("connecting");
  const [call, setCall] = useState<VocallCall | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const waiting = useRef<((ok: boolean) => void)[]>([]);
  const { host, port, secure, dac, senha, prefix } = cfg;

  useEffect(() => {
    let closed = false, retry = 0, ping: ReturnType<typeof setInterval> | undefined, timer: ReturnType<typeof setTimeout> | undefined, clear: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      if (closed) return;
      setState("connecting");
      let sock: WebSocket;
      try { sock = new WebSocket(vocallUrl({ host, port, secure })); } catch { setState("error"); return; }
      ws.current = sock;
      sock.onopen = () => sock.send(JSON.stringify({ action: "login", data: { id: agentId, ramal, dac, senha } }));
      sock.onmessage = (ev) => {
        let m: { action?: string; data?: Record<string, unknown>; erro?: unknown };
        try { m = JSON.parse(String(ev.data)); } catch { return; }
        if (m.action === "login") { retry = 0; setState("online"); clearInterval(ping); ping = setInterval(() => { if (sock.readyState === 1) sock.send(JSON.stringify({ action: "ping", data: {} })); }, 10_000); }
        else if (m.action === "chamada" && m.data) {
          const d = m.data as { telefone?: string; estado?: string; cliente?: { label?: string } | false };
          clearTimeout(clear);
          waiting.current.splice(0).forEach((r) => r(true));
          setCall((c) => ({ telefone: String(d.telefone ?? c?.telefone ?? ""), empresa: (d.cliente && typeof d.cliente === "object" ? d.cliente.label : null) ?? c?.empresa ?? null, estado: d.estado ?? null, since: c && c.telefone === d.telefone ? c.since : Date.now() }));
          if (d.estado === "Finalizado") clear = setTimeout(() => setCall(null), 5_000);
        }
      };
      sock.onerror = () => setState("error");
      sock.onclose = () => {
        clearInterval(ping); ws.current = null;
        if (closed) return;
        setState("error"); retry++;
        timer = setTimeout(open, Math.min(30_000, 2_000 * 2 ** Math.min(retry, 4)));
      };
    };
    open();
    return () => { closed = true; clearInterval(ping); clearTimeout(timer); clearTimeout(clear); ws.current?.close(1000); ws.current = null; };
  }, [host, port, secure, dac, senha, agentId, ramal]);

  const dial = useCallback((phone: string, label?: string | null) => new Promise<boolean>((resolve) => {
    const s = ws.current;
    const digits = phone.replace(/\D/g, "");
    if (!s || s.readyState !== 1 || digits.length < 8) return resolve(false);
    waiting.current.push(resolve);
    setTimeout(() => { const i = waiting.current.indexOf(resolve); if (i >= 0) { waiting.current.splice(i, 1); resolve(false); } }, 6_000);
    s.send(JSON.stringify({ action: "discar", data: { telefone: `${prefix}${digits}`, cliente: { label: (label ?? "").replace(/\|/g, "").slice(0, 80) } } }));
  }), [prefix]);

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
  const ended = call.estado === "Finalizado";
  return (
    <div role="status" className="fixed left-1/2 top-3 z-[65] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-xl card-in" style={{ background: ended ? "#475569" : "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
      {ended ? <PhoneOff size={16} aria-hidden /> : <PhoneCall size={16} aria-hidden className="script-shake" />}
      <span className="truncate">{call.empresa ?? call.telefone}</span>
      <Timer since={call.since} />
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{call.estado ?? "Em ligação"}</span>
    </div>
  );
}
