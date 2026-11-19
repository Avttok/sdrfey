"use client";

import { Activity, CheckCircle2, Clock, DatabaseZap, History as HistoryIcon, ListOrdered, Loader2, Pause, Play, RotateCcw, Sparkles, TriangleAlert, XCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import type { EnrichStats } from "@/modules/enrich/batch";
import { enrichLiveAction, enrichLogAction, retryFailedEnrichAction, runEnrichBatchAction, setAutoEnrichAction } from "@/modules/enrich/admin";
import type { Live, LogRow } from "@/modules/enrich/live";

const ORIGIN: Record<string, string> = { lote: "Lote (Adm)", cron: "Tarefa agendada", manual: "Botão Atualizar", auto: "Shuffler/lead", novo: "Nova negociação" };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
const ago = (iso: string, now: number) => { const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h`; };
const cnpjF = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function Tile({ icon: I, label, value, hint, tone }: { icon: typeof Activity; label: string; value: string; hint?: string; tone?: "ok" | "bad" }) {
  return <div className="stat-glow lift rounded-2xl border border-line bg-panel p-4"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">{label}</p><span className={`grid size-8 place-items-center rounded-lg ${tone === "bad" ? "bg-danger/15 text-danger" : "bg-grad-soft text-accent"}`}><I size={15} aria-hidden /></span></div><p className="figure mt-2 text-2xl font-bold leading-none">{value}</p>{hint && <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>}</div>;
}

function LogLine({ r, now }: { r: LogRow; now: number }) {
  return (
    <li className="flex items-start gap-3 px-3.5 py-2.5 text-sm">
      {r.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{r.company}</p>
        <p className="truncate text-xs text-muted">{cnpjF(r.cnpj)} · {ORIGIN[r.origin] ?? r.origin}{r.by ? ` · ${r.by}` : ""} · {(r.ms / 1000).toFixed(1)} s{r.ok ? ` · ${r.status ?? "ok"}${r.phones + r.emails ? ` · +${r.phones} tel, +${r.emails} e-mail` : ""}` : ""}</p>
        {!r.ok && r.why && <p className="mt-0.5 text-xs text-danger/90">{r.why}</p>}
      </div>
      <span className="figure shrink-0 text-xs text-muted" title={hhmm(r.at)}>há {ago(r.at, now)}</span>
    </li>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<"all" | "ok" | "fail">("all");
  const [origin, setOrigin] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ rows: LogRow[]; total: number; pages: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  useEffect(() => { let alive = true; setBusy(true); const t = setTimeout(() => { enrichLogAction({ page, result, origin, q }).then((d) => { if (alive) setData(d); }).finally(() => alive && setBusy(false)); }, q ? 300 : 0); return () => { alive = false; clearTimeout(t); }; }, [page, result, origin, q]);
  return (
    <section className={`${panelCls} overflow-hidden`}>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <label className="min-w-48 flex-1 text-sm"><span className="mb-1 block text-muted">Buscar empresa ou CNPJ</span><input className={inputCls} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Resultado</span><select className={inputCls} value={result} onChange={(e) => { setResult(e.target.value as "all"); setPage(1); }}><option value="all">Todos</option><option value="ok">Deu certo</option><option value="fail">Falhou</option></select></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Origem</span><select className={inputCls} value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(1); }}><option value="">Todas</option>{Object.entries(ORIGIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {busy && <Loader2 size={18} className="mb-3 animate-spin text-muted" aria-hidden />}
      </div>
      <ul className="divide-y divide-line/70">{data?.rows.map((r) => <LogLine key={r.id} r={r} now={now} />)}{data && !data.rows.length && <li className="p-8 text-center text-sm text-muted">Nenhuma consulta com esses filtros.</li>}{!data && <li className="p-8 text-center text-sm text-muted">Carregando…</li>}</ul>
      {data && data.pages > 1 && <div className="flex items-center justify-between border-t border-line p-3 text-sm"><span className="text-muted">{data.total.toLocaleString("pt-BR")} consultas</span><span className="flex gap-2"><button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span className="figure self-center">{page}/{data.pages}</span><button type="button" className={btnGhost} disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Próxima</button></span></div>}
    </section>
  );
}

export function EnrichAdmin({ initial, on: on0, cronReady, live: live0 }: { initial: EnrichStats; on: boolean; cronReady: boolean; live: Live }) {
  const [live, setLive] = useState(live0);
  const [tab, setTab] = useState<"live" | "hist">("live");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    const tick = async () => { if (document.visibilityState !== "visible") return; try { const d = await enrichLiveAction(); if (alive) { setLive(d); setNow(Date.now()); } } catch { /* tenta no próximo */ } };
    const id = setInterval(tick, 3000); const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(id); clearInterval(clock); };
  }, []);
  const [, setStats] = useState(initial);
  const [on, setOn] = useState(on0);
    const [busy, setBusy] = useState(false);
  const [loop, setLoop] = useState(false);
  const [log, setLog] = useState("");
  const [pending, start] = useTransition();
  const stop = useRef(false);
  const pct = live.stats.total ? Math.round((live.stats.done / live.stats.total) * 100) : 0;

  const once = async (size = 10) => {
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
    while (!stop.current) { const r = await once(1); if (r && r.tried === 0) break; await new Promise((x) => setTimeout(x, 1500)); }
    setLoop(false);
  };
  useEffect(() => () => { stop.current = true; }, []);

  return (
    <div className="space-y-4">
      <section className={`${panelCls} stat-glow space-y-4 p-5`}>
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-grad-soft text-accent"><DatabaseZap size={26} aria-hidden /></span>
          <div className="min-w-0 flex-1"><p className="figure text-3xl font-bold leading-none">{live.stats.done.toLocaleString("pt-BR")} <span className="text-base font-medium text-muted">de {live.stats.total.toLocaleString("pt-BR")} consultados</span></p><p className="mt-1 text-sm text-muted">{live.stats.pending.toLocaleString("pt-BR")} esperando · {live.stats.failed.toLocaleString("pt-BR")} sem resposta (tento de novo em 6 h)</p></div>
          <div className="text-right"><span className="figure text-2xl font-bold text-accent">{pct}%</span><p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${live.running ? "bg-grad-soft text-accent" : "bg-sunk text-muted"}`}><span className={`size-1.5 rounded-full ${live.running ? "animate-pulse bg-accent" : "bg-muted"}`} />{live.running ? "Consultando agora" : "Parado"}</p></div>
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
                    <button type="button" className={btnPrimary} disabled={busy || loop} onClick={() => void once(10)}>{busy && !loop ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Zap size={16} aria-hidden />} Consultar um lote (10)</button>
          {loop ? <button type="button" className={btnGhost} onClick={() => { stop.current = true; }}><Pause size={16} aria-hidden /> Parar contínuo</button> : <button type="button" className={btnGhost} disabled={busy} onClick={() => void runLoop()}><Play size={16} aria-hidden /> Modo contínuo (1 em 1)</button>}
          <button type="button" className={btnGhost} disabled={busy || loop || pending} onClick={() => start(async () => { await retryFailedEnrichAction(); const r = await runEnrichBatchAction(1); setStats(r.stats); })}><RotateCcw size={15} aria-hidden /> Tentar os sem resposta de novo</button>
        </div>
        <p className="text-sm text-muted" aria-live="polite">{loop ? <span className="inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" aria-hidden /> Contínuo ativo: continua até acabar ou você parar. Não feche esta página. </span> : null}{log}</p>
      </section>

      <div role="tablist" aria-label="Visão" className="flex w-fit gap-1 rounded-xl border border-line bg-panel p-1 text-sm font-medium">
        {([["live", "Ao vivo", Activity], ["hist", "Histórico", HistoryIcon]] as const).map(([k, l, I]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition ${tab === k ? "bg-grad-soft text-accent" : "text-muted hover:text-ink"}`}><I size={15} aria-hidden />{l}</button>)}
      </div>

      {tab === "hist" ? <History /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={Zap} label="Ritmo (10 min)" value={`${live.rate.perMin.toFixed(1).replace(".", ",")}/min`} hint={`${live.rate.m10} consultas nos últimos 10 min`} />
            <Tile icon={Clock} label="Tempo para acabar" value={live.rate.etaMin == null ? "—" : live.rate.etaMin >= 120 ? `${Math.round(live.rate.etaMin / 60)} h` : `${live.rate.etaMin} min`} hint={live.rate.etaMin == null ? "sem consultas recentes" : "no ritmo atual"} />
            <Tile icon={CheckCircle2} label="Acerto (24 h)" value={live.rate.okPct == null ? "—" : `${live.rate.okPct}%`} hint={`${live.rate.h24} consultas · média ${live.rate.avgMs == null ? "—" : (live.rate.avgMs / 1000).toFixed(1).replace(".", ",") + " s"}`} tone={live.rate.okPct != null && live.rate.okPct < 60 ? "bad" : undefined} />
            <Tile icon={Sparkles} label="Prontos p/ shuffler" value={live.stats.ready.toLocaleString("pt-BR")} hint="consultados e sem contato (têm prioridade)" />
          </div>

          <section className={`${panelCls} p-4`}>
            <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-semibold">Últimas 24 horas</h2><p className="text-xs text-muted">{live.lastOkAt ? `última consulta ok há ${ago(live.lastOkAt, now)}` : "nenhuma consulta ainda"}</p></div>
            <div className="flex h-24 items-end gap-1" aria-label="Consultas por hora">
              {(() => { const max = Math.max(1, ...live.hours.map((h) => h.ok + h.fail)); return live.hours.map((h, i) => (
                <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${h.h}: ${h.ok} ok, ${h.fail} falhas`}>
                  <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${((h.ok + h.fail) / max) * 100}%`, minHeight: h.ok + h.fail ? 3 : 0 }}><div className="bg-danger/70" style={{ flex: h.fail }} /><div className="bg-grad" style={{ flex: h.ok }} /></div>
                  <span className="text-[9px] text-muted">{i % 3 === 0 ? h.h : ""}</span>
                </div>)); })()}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={`${panelCls} overflow-hidden`}>
              <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold"><ListOrdered size={16} className="text-accent" aria-hidden /> Próximos da fila</h2>
              <ol className="divide-y divide-line/70">
                {live.queue.map((q, i) => <li key={q.id} className="flex items-center gap-3 px-4 py-2 text-sm"><span className="figure w-5 text-xs text-muted">{i + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-medium">{q.company}</p><p className="text-xs text-muted">{cnpjF(q.cnpj)}{q.priorTry ? ` · já tentado há ${ago(q.priorTry, now)}` : ""}</p></div>{i === 0 && <span className="rounded-full bg-grad-soft px-2 py-0.5 text-xs font-semibold text-accent">próximo</span>}</li>)}
                {!live.queue.length && <li className="p-6 text-center text-sm text-muted">Fila vazia: todos foram consultados.</li>}
              </ol>
            </section>
            <section className={`${panelCls} overflow-hidden`}>
              <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold"><TriangleAlert size={16} className="text-danger" aria-hidden /> Falharam (últimas 6 h)</h2>
              <ul className="divide-y divide-line/70">
                {live.failed.map((f) => <li key={f.id} className="px-4 py-2 text-sm"><div className="flex items-center justify-between gap-2"><p className="truncate font-medium">{f.company}</p><span className="figure shrink-0 text-xs text-muted">há {ago(f.at, now)} · {f.tries}x</span></div><p className="truncate text-xs text-muted">{cnpjF(f.cnpj)}</p>{f.why && <p className="text-xs text-danger/90">{f.why}</p>}</li>)}
                {!live.failed.length && <li className="p-6 text-center text-sm text-muted">Nenhuma falha recente.</li>}
              </ul>
            </section>
          </div>

          <section className={`${panelCls} overflow-hidden`}>
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold"><Activity size={16} className="text-accent" aria-hidden /> Acontecendo agora <span className="ml-auto text-xs font-normal text-muted">atualiza a cada 3 s</span></h2>
            <ul className="divide-y divide-line/70">{live.recent.map((r) => <LogLine key={r.id} r={r} now={now} />)}{!live.recent.length && <li className="p-6 text-center text-sm text-muted">Nenhuma consulta registrada ainda.</li>}</ul>
          </section>

          {(live.origins.length > 0 || live.topWhy.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <section className={`${panelCls} p-4`}><h2 className="mb-2 text-sm font-semibold">Quem consultou (24 h)</h2><ul className="space-y-1.5 text-sm">{live.origins.map((o) => <li key={o.origin} className="flex justify-between"><span>{ORIGIN[o.origin] ?? o.origin}</span><span className="figure text-muted">{o.ok}/{o.n} ok</span></li>)}</ul></section>
              <section className={`${panelCls} p-4`}><h2 className="mb-2 text-sm font-semibold">Motivos de falha (24 h)</h2><ul className="space-y-1.5 text-sm">{live.topWhy.map((w) => <li key={w.why} className="flex justify-between gap-3"><span className="truncate">{w.why}</span><span className="figure text-muted">{w.n}x</span></li>)}{!live.topWhy.length && <li className="text-muted">Sem falhas.</li>}</ul></section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
