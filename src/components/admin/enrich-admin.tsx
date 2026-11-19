"use client";

import { DatabaseZap, Loader2, Pause, Play, RotateCcw, Zap } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import type { EnrichStats } from "@/modules/enrich/batch";
import { retryFailedEnrichAction, runEnrichBatchAction, setAutoEnrichAction } from "@/modules/enrich/admin";

export function EnrichAdmin({ initial, on: on0, cronReady }: { initial: EnrichStats; on: boolean; cronReady: boolean }) {
  const [stats, setStats] = useState(initial);
  const [on, setOn] = useState(on0);
  const [size, setSize] = useState(15);
  const [busy, setBusy] = useState(false);
  const [loop, setLoop] = useState(false);
  const [log, setLog] = useState("");
  const [pending, start] = useTransition();
  const stop = useRef(false);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const once = async () => {
    setBusy(true);
    try {
      const r = await runEnrichBatchAction(size);
      setStats(r.stats);
      setLog(r.tried ? `Último lote: ${r.ok} consultados, ${r.failed} sem resposta.` : "Nada pendente para consultar.");
      return r;
    } catch { setLog("A conexão falhou neste lote. Tento de novo."); return null; } finally { setBusy(false); }
  };
  const runLoop = async () => {
    stop.current = false; setLoop(true);
    while (!stop.current) { const r = await once(); if (r && r.tried === 0) break; await new Promise((x) => setTimeout(x, 1500)); }
    setLoop(false);
  };
  useEffect(() => () => { stop.current = true; }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <section className={`${panelCls} stat-glow space-y-4 p-5`}>
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-grad-soft text-accent"><DatabaseZap size={26} aria-hidden /></span>
          <div className="min-w-0 flex-1"><p className="figure text-3xl font-bold leading-none">{stats.done.toLocaleString("pt-BR")} <span className="text-base font-medium text-muted">de {stats.total.toLocaleString("pt-BR")} consultados</span></p><p className="mt-1 text-sm text-muted">{stats.pending.toLocaleString("pt-BR")} esperando · {stats.failed.toLocaleString("pt-BR")} sem resposta (tento de novo em 6 h)</p></div>
          <span className="figure text-2xl font-bold text-accent">{pct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-grad transition-all duration-700" style={{ width: `${pct}%` }} /></div>
      </section>

      <section className={`${panelCls} flex flex-wrap items-center gap-4 p-5`}>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">Consulta automática</h2><p className="text-sm text-muted">Ligada: a tarefa agendada consulta os leads pendentes e os shufflers deixam de consultar sozinhos (o botão “Atualizar informações” continua).</p>
          {on && !cronReady && <p className="mt-1 text-sm text-warn">Falta criar a variável CRON_SECRET na Vercel para a tarefa agendada rodar. O botão e o modo contínuo abaixo funcionam sem ela.</p>}</div>
        <button type="button" role="switch" aria-checked={on} disabled={pending} onClick={() => start(async () => { const n = !on; setOn(n); await setAutoEnrichAction(n); })} className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-grad" : "bg-sunk border border-line"}`}><span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} /></button>
      </section>

      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="font-semibold">Consultar agora</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block w-40 text-sm"><span className="mb-1 block text-muted">Leads por lote (1 a 40)</span><input type="number" min={1} max={40} className={inputCls} value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
          <button type="button" className={btnPrimary} disabled={busy || loop} onClick={() => void once()}>{busy && !loop ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Zap size={16} aria-hidden />} Consultar um lote</button>
          {loop ? <button type="button" className={btnGhost} onClick={() => { stop.current = true; }}><Pause size={16} aria-hidden /> Parar contínuo</button> : <button type="button" className={btnGhost} disabled={busy} onClick={() => void runLoop()}><Play size={16} aria-hidden /> Modo contínuo</button>}
          <button type="button" className={btnGhost} disabled={busy || loop || pending} onClick={() => start(async () => { await retryFailedEnrichAction(); const r = await runEnrichBatchAction(1); setStats(r.stats); })}><RotateCcw size={15} aria-hidden /> Tentar os sem resposta de novo</button>
        </div>
        <p className="text-sm text-muted" aria-live="polite">{loop ? <span className="inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" aria-hidden /> Contínuo ativo: continua até acabar ou você parar. Não feche esta página. </span> : null}{log}</p>
      </section>
    </div>
  );
}
