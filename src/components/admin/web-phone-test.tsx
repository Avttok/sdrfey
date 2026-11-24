"use client";

import { CheckCircle2, Circle, Loader2, Mic, MicOff, PhoneCall, PhoneOff, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { vocallUrl } from "@/components/vocall-provider";
import type { VocallConfig } from "@/modules/vocall/config";

type Step = "mic" | "ramal" | "verto" | "agent" | "call" | "audio";
type St = "todo" | "run" | "ok" | "bad";
const STEPS: { k: Step; label: string; hint: string }[] = [
  { k: "mic", label: "Microfone liberado no navegador", hint: "O navegador pede permissão uma vez." },
  { k: "ramal", label: "Central aceita o ramal (verificarRamalFake + login_agente)", hint: "Mesmo pedido que o VocallPhone faz ao abrir." },
  { k: "verto", label: "Telefone do navegador registrado na central (Verto/WebRTC)", hint: "Conexão wss na porta 8082." },
  { k: "agent", label: "Agente entra no VocallAgent (porta de comandos)", hint: "O mesmo login do botão Ligar." },
  { k: "call", label: "Chamada de teste chega no navegador", hint: "O discar pede, a central toca no telefone web." },
  { k: "audio", label: "Áudio nos dois sentidos", hint: "Você confirma ouvindo e sendo ouvido." },
];

type Verto = { login: () => void; logout: () => void; hangup: () => void };
type Dialog = { state: { name: string }; answer: () => void; hangup: () => void; dtmf: (d: string) => void; setMute: (m: string) => void; params?: Record<string, unknown> };
type W = Window & { $?: { verto: new (o: Record<string, unknown>, cb: Record<string, unknown>) => Verto & { }; }; jQuery?: unknown };

const load = (src: string) => new Promise<void>((ok, bad) => {
  if (document.querySelector(`script[data-src="${src}"]`)) return ok();
  const s = document.createElement("script"); s.src = src; s.async = false; s.dataset.src = src; s.onload = () => ok(); s.onerror = () => bad(new Error(`Não carregou ${src}`)); document.body.appendChild(s);
});

/**
 * Teste de viabilidade: o sistema vira o telefone do ramal (Verto/WebRTC, o mesmo que o VocallPhone usa por dentro).
 * Admin only. A senha do ramal fica só na tela, nunca é guardada.
 */
export function WebPhoneTest({ cfg, agentId, ramal }: { cfg: Pick<VocallConfig, "host" | "port" | "secure" | "dac" | "senha" | "prefix">; agentId: string; ramal: string }) {
  const [f, setF] = useState({ dns: cfg.host, ramal, agente: agentId, senha: "", numero: "" });
  const [st, setSt] = useState<Record<Step, St>>({ mic: "todo", ramal: "todo", verto: "todo", agent: "todo", call: "todo", audio: "todo" });
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const verto = useRef<Verto | null>(null);
  const dialog = useRef<Dialog | null>(null);
  const sock = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLVideoElement>(null);

  const put = (m: string) => setLog((l) => [...l.slice(-80), `${new Date().toLocaleTimeString("pt-BR")}  ${m}`]);
  const mark = (k: Step, v: St) => setSt((s) => ({ ...s, [k]: v }));
  const stop = useCallback(() => { try { dialog.current?.hangup(); } catch { /* */ } try { verto.current?.logout(); } catch { /* */ } try { sock.current?.close(); } catch { /* */ } verto.current = null; dialog.current = null; sock.current = null; }, []);
  useEffect(() => stop, [stop]);

  async function start() {
    stop(); setBusy(true); setLog([]); setDlg(null);
    setSt({ mic: "run", ramal: "todo", verto: "todo", agent: "todo", call: "todo", audio: "todo" });
    try {
      try { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); m.getTracks().forEach((t) => t.stop()); mark("mic", "ok"); put("Microfone liberado."); }
      catch (e) { mark("mic", "bad"); put(`Microfone: ${e instanceof Error ? e.message : "negado"}`); return setBusy(false); }

      mark("ramal", "run");
      const r = await fetch("/api/vocall/ramal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dns: f.dns, ramal: f.ramal, senha: f.senha, agente: f.agente }) }).then((x) => x.json()).catch(() => ({ ok: false, message: "Sem resposta do sistema." }));
      put(`Central: ${r.message ?? ""} ${r.detail ? JSON.stringify(r.detail).slice(0, 200) : ""}`);
      if (!r.ok) { mark("ramal", "bad"); return setBusy(false); }
      mark("ramal", "ok");

      mark("verto", "run");
      await load("/vendor/verto/jquery.min.js"); await load("/vendor/verto/jquery.json.min.js"); await load("/vendor/verto/verto-min.js");
      const $ = (window as W).$!;
      let registered = false;
      const cb = {
        onWSLogin: (_v: unknown, ok: boolean) => { put(`Verto login: ${ok ? "ok" : "falhou"}`); if (ok) { registered = true; mark("verto", "ok"); void agent(); } else mark("verto", "bad"); },
        onWSClose: () => { put("Verto: conexão fechada."); if (!registered) mark("verto", "bad"); },
        onMessage: () => {},
        onDialogState: (d: Dialog) => {
          const name = String(d.state?.name ?? d.state);
          put(`Chamada: ${name}`); dialog.current = d; setDlg(name);
          if (name === "ringing") { mark("call", "ok"); put("Tocando no navegador. Use Atender."); }
          if (name === "active") put("Chamada ativa.");
          if (name === "hangup" || name === "destroy") { dialog.current = null; setDlg(null); }
        },
      };
      verto.current = new $.verto({ login: `fake_${f.ramal}@${f.dns}`, passwd: f.senha, socketUrl: `wss://${f.dns}:8082`, tag: "fey-webphone", iceServers: [{ urls: "stun:stun.l.google.com:19302" }], audioParams: { googAutoGainControl: true, googNoiseSuppression: false, googHighpassFilter: false } }, cb);
      (verto.current as unknown as { loginData: (o: unknown) => void }).loginData({ login: `fake_${f.ramal}@${f.dns}`, passwd: f.senha });
      verto.current.login();
      setTimeout(() => { if (!registered) { mark("verto", "bad"); put("Verto: sem resposta em 12 s."); setBusy(false); } }, 12_000);
    } catch (e) { put(`Erro: ${e instanceof Error ? e.message : String(e)}`); setBusy(false); }
  }

  async function agent() {
    mark("agent", "run");
    const s = new WebSocket(vocallUrl(cfg)); sock.current = s;
    s.onopen = () => s.send(JSON.stringify({ action: "login", data: { id: f.agente, ramal: f.ramal, dac: cfg.dac, senha: cfg.senha } }));
    s.onmessage = (ev) => {
      let m: { action?: string; data?: Record<string, unknown> } = {}; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.action === "login") { const ok = (m.data as { status?: unknown })?.status !== false; put(`Agente: ${ok ? "logado" : "recusado"}`); mark("agent", ok ? "ok" : "bad"); setBusy(false); }
      else if (m.action && m.action !== "pong" && m.action !== "ping") put(`Agente: ${m.action} ${JSON.stringify(m.data ?? {}).slice(0, 120)}`);
    };
    s.onerror = () => { mark("agent", "bad"); put("Agente: não conectou."); setBusy(false); };
  }

  function dial() {
    const digits = f.numero.replace(/\D/g, "");
    if (!digits || sock.current?.readyState !== 1) return put("Entre primeiro e digite um número.");
    mark("call", "run"); mark("audio", "todo");
    sock.current.send(JSON.stringify({ action: "discar", data: { telefone: `${cfg.prefix}${digits}` } }));
    put(`Discando ${digits}… (a central liga primeiro para o ramal)`);
  }

  const all = STEPS.every((s) => st[s.k] === "ok");
  const failed = STEPS.find((s) => st[s.k] === "bad");
  return (
    <div className="space-y-4">
      <section className={`${panelCls} space-y-3 p-4`}>
        <p className="text-sm text-muted">Teste para saber se o sistema pode virar o telefone do ramal, sem o app VocallPhone. Use um ramal livre e o seu agente. A senha do ramal só fica nesta tela. Use fones, para o áudio não voltar no microfone.</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {([["dns", "Servidor (DNS)"], ["ramal", "Ramal"], ["agente", "Agente"], ["senha", "Senha do ramal"]] as const).map(([k, l]) => (
            <label key={k} className="text-xs font-semibold text-muted">{l}<input type={k === "senha" ? "password" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={`${inputCls} mt-1`} autoComplete="off" /></label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !f.dns || !f.ramal || !f.agente || !f.senha} onClick={() => void start()} className={btnPrimary}>{busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <PhoneCall size={15} aria-hidden />} Iniciar teste</button>
          <button type="button" onClick={() => { stop(); setSt({ mic: "todo", ramal: "todo", verto: "todo", agent: "todo", call: "todo", audio: "todo" }); setBusy(false); }} className={btnGhost}>Parar</button>
        </div>
      </section>

      <section className={`${panelCls} p-4`}>
        <ol className="space-y-2">
          {STEPS.map((s) => (
            <li key={s.k} className="flex items-start gap-2.5">
              {st[s.k] === "ok" ? <CheckCircle2 size={18} className="mt-0.5 text-ok" aria-hidden /> : st[s.k] === "bad" ? <XCircle size={18} className="mt-0.5 text-danger" aria-hidden /> : st[s.k] === "run" ? <Loader2 size={18} className="mt-0.5 animate-spin text-accent" aria-hidden /> : <Circle size={18} className="mt-0.5 text-muted" aria-hidden />}
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{s.label}</span><span className="block text-xs text-muted">{s.hint}</span></span>
              {s.k === "audio" && st.call === "ok" && st.audio !== "ok" && <span className="flex gap-1.5"><button type="button" onClick={() => mark("audio", "ok")} className={btnGhost}>Funcionou</button><button type="button" onClick={() => mark("audio", "bad")} className={btnGhost}>Sem áudio</button></span>}
            </li>
          ))}
        </ol>
      </section>

      <section className={`${panelCls} space-y-3 p-4`}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-muted">Número para o teste (com DDD)<input value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} inputMode="tel" className={`${inputCls} mt-1 w-56`} placeholder="seu celular" /></label>
          <button type="button" disabled={st.agent !== "ok"} onClick={dial} className={btnPrimary}><PhoneCall size={15} aria-hidden /> Ligar (discar)</button>
          <button type="button" disabled={dlg !== "ringing"} onClick={() => dialog.current?.answer()} className={btnGhost}>Atender</button>
          <button type="button" disabled={!dlg} onClick={() => dialog.current?.hangup()} className={btnGhost}><PhoneOff size={15} aria-hidden /> Desligar</button>
          <button type="button" disabled={dlg !== "active"} onClick={() => { dialog.current?.setMute("toggle"); setMuted((m) => !m); }} className={btnGhost}>{muted ? <MicOff size={15} aria-hidden /> : <Mic size={15} aria-hidden />} {muted ? "Ativar microfone" : "Silenciar"}</button>
          {["1", "2", "3"].map((d) => <button key={d} type="button" disabled={dlg !== "active"} onClick={() => dialog.current?.dtmf(d)} className={btnGhost}>{d}</button>)}
        </div>
        <video id="fey-webphone" ref={audioRef} autoPlay playsInline className="hidden" />
        <pre className="max-h-64 overflow-auto rounded-xl bg-sunk p-3 text-xs leading-relaxed">{log.length ? log.join("\n") : "O registro do teste aparece aqui."}</pre>
      </section>

      <section className={`${panelCls} p-4 text-sm`} aria-live="polite">
        <p className="font-bold">{all ? "Viável: o navegador conseguiu ser o telefone." : failed ? `Parou em: ${failed.label}.` : "Resultado aparece ao terminar os passos."}</p>
        {all && <p className="mt-1 text-muted">As gravações continuam vindo da central (ficam no servidor deles), então não dependem do app. O próximo passo seria trocar o app por este telefone dentro do painel de ligação.</p>}
      </section>
    </div>
  );
}
