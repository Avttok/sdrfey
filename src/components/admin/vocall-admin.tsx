"use client";

import { CheckCircle2, Loader2, PhoneCall, PlugZap, Save, XCircle } from "lucide-react";
import { useState } from "react";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { vocallUrl } from "@/components/vocall-provider";
import { saveVocallConfigAction, saveVocallUserAction } from "@/modules/vocall/actions";
import type { VocallConfig } from "@/modules/vocall/config";

export type VocallUser = { id: number; name: string; agentId: string; ramal: string };

/** Testa a conexão com o servidor: entra com um agente e espera a resposta de "login". */
function testConnection(c: VocallConfig, agentId: string, ramal: string): Promise<string> {
  return new Promise((resolve) => {
    let done = false;
    const end = (m: string) => { if (!done) { done = true; try { s?.close(); } catch { /* ok */ } resolve(m); } };
    let s: WebSocket | null = null;
    try { s = new WebSocket(vocallUrl(c)); } catch { return end("Endereço inválido para o navegador."); }
    const t = setTimeout(() => end("Sem resposta em 8 segundos. Confira endereço, porta e se o servidor aceita conexão segura (wss)."), 8000);
    s.onopen = () => s!.send(JSON.stringify({ action: "login", data: { id: agentId, ramal, dac: c.dac, senha: c.senha } }));
    s.onmessage = (ev) => { try { const m = JSON.parse(String(ev.data)); if (m.action === "login") { clearTimeout(t); end("OK"); } else if (m.erro) { clearTimeout(t); end(`O servidor recusou: ${m.msg ?? "erro"}`); } } catch { /* ignora */ } };
    s.onerror = () => { clearTimeout(t); end("Não conectou. O servidor pode exigir wss (conexão segura) ou estar fora do ar."); };
  });
}

export function VocallAdmin({ initial, people }: { initial: VocallConfig; people: VocallUser[] }) {
  const [c, setC] = useState(initial);
  const [rows, setRows] = useState(people);
  const [test, setTest] = useState<{ id: number; msg: string | null } | null>(null);
  const { run, pending } = useRun();
  const set = <K extends keyof VocallConfig>(k: K, v: VocallConfig[K]) => setC({ ...c, [k]: v });
  const dirty = JSON.stringify(c) !== JSON.stringify(initial);
  const setRow = (id: number, patch: Partial<VocallUser>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const saved = (id: number) => { const o = people.find((p) => p.id === id)!, r = rows.find((p) => p.id === id)!; return o.agentId === r.agentId && o.ramal === r.ramal; };

  return (
    <div className="space-y-4">
      <section className={`${panelCls} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><PhoneCall size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1"><h2 className="font-semibold">Ligar direto do sistema</h2><p className="text-sm text-muted">O botão “Ligar” pede a chamada ao VocallAgent, como o clique no número da EOX. O VocallPhone do computador precisa estar aberto e logado.</p></div>
          <button type="button" role="switch" aria-checked={c.on} aria-label="Ligação pelo sistema" onClick={() => set("on", !c.on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${c.on ? "bg-ok" : "bg-line"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${c.on ? "left-[1.5rem]" : "left-0.5"}`} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2">Servidor do VocallAgent<input className={inputCls} value={c.host} onChange={(e) => set("host", e.target.value)} placeholder="Ex.: 200.0.0.10 ou agent.suaempresa.com.br" /><span className="text-xs text-muted">É o valor de <code>ip_vocallagent</code> na página da EOX (ver código-fonte da página).</span></label>
          <label className="text-sm">Porta<input className={inputCls} inputMode="numeric" value={c.port} onChange={(e) => set("port", Number(e.target.value.replace(/\D/g, "")) || 0)} /><span className="text-xs text-muted">Padrão 8001 (<code>port_vocallagent</code>).</span></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={c.secure} onChange={(e) => set("secure", e.target.checked)} /> Conexão segura (wss) <span className="text-xs text-muted">— obrigatória para o sistema, que roda em https. Se a EOX usa http puro, peça à EOX para habilitar wss.</span></label>
          <label className="text-sm">DAC<input className={inputCls} value={c.dac} onChange={(e) => set("dac", e.target.value)} /></label>
          <label className="text-sm">Senha de entrada<input className={inputCls} value={c.senha} onChange={(e) => set("senha", e.target.value)} /></label>
          <label className="text-sm">Prefixo do número<input className={inputCls} value={c.prefix} onChange={(e) => set("prefix", e.target.value)} placeholder="Ex.: 0 (vazio = só DDD+número)" /></label>
        </div>
        <button type="button" className={btnPrimary} disabled={pending || !dirty} onClick={() => run(() => saveVocallConfigAction(c))}><Save size={15} aria-hidden /> Salvar configuração</button>
      </section>

      <section className={`${panelCls} overflow-hidden`}>
        <header className="border-b border-line bg-sunk/60 px-4 py-3"><h2 className="text-sm font-semibold">Agente e ramal de cada pessoa</h2><p className="text-xs text-muted">Como aparecem na EOX (<code>id_agente</code> e <code>ramal</code>). Quem ficar sem agente continua com o botão que só copia o número.</p></header>
        <ul className="divide-y divide-line/60">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-[8rem] flex-1 font-medium">{r.name}</span>
              <input aria-label={`Agente de ${r.name}`} className={`${inputCls} !w-28`} placeholder="Agente" value={r.agentId} onChange={(e) => setRow(r.id, { agentId: e.target.value })} />
              <input aria-label={`Ramal de ${r.name}`} className={`${inputCls} !w-28`} placeholder="Ramal" value={r.ramal} onChange={(e) => setRow(r.id, { ramal: e.target.value })} />
              <button type="button" className={btnGhost} disabled={pending || saved(r.id)} onClick={() => run(() => saveVocallUserAction(r.id, r.agentId, r.ramal))}><Save size={14} aria-hidden /> Salvar</button>
              <button type="button" className={btnGhost} disabled={!c.host || !r.agentId || !r.ramal || test?.id === r.id && test.msg === null} onClick={async () => { setTest({ id: r.id, msg: null }); setTest({ id: r.id, msg: await testConnection(c, r.agentId, r.ramal) }); }}>
                {test?.id === r.id && test.msg === null ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <PlugZap size={14} aria-hidden />} Testar
              </button>
              {test?.id === r.id && test.msg !== null && <span className={`flex basis-full items-center gap-1.5 text-xs ${test.msg === "OK" ? "text-ok" : "text-danger"}`}>{test.msg === "OK" ? <><CheckCircle2 size={14} aria-hidden /> Conectou e entrou como agente.</> : <><XCircle size={14} aria-hidden /> {test.msg}</>}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
