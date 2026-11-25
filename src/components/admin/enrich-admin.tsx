"use client";

import { Activity, CheckCircle2, Clock, DatabaseZap, ExternalLink, History as HistoryIcon, ListOrdered, Loader2, Mail, Pause, Phone, Play, RotateCcw, Search, ShieldCheck, Sparkles, TriangleAlert, XCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { ENRICH_GROUPS, ENRICH_LISTS, listMeta } from "@/config/enrich-lists";
import { DashBlock, DashSection, MetricCard, MetricRing } from "@/components/dash-ui";
import { LeadLink, ListChoice, StatusChip, iconTile, listVisual, tint } from "@/components/enrich-visual";
import { ENRICH_STATE, askEnrich, setEnrich } from "@/components/enrich-bridge";
import type { DockData } from "@/modules/enrich/daemon-actions";
import { startApi, stopApi } from "@/components/enrich-api";
import type { EnrichStats } from "@/modules/enrich/batch";
import { enrichLiveAction, enrichLogAction, enrichOneAction, findLeadsAction, retryFailedEnrichAction, runEnrichBatchAction, setAutoEnrichAction, type FoundLead } from "@/modules/enrich/admin";
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
        <LeadLink id={r.leadId} className="font-medium">{r.company}</LeadLink>
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
  const [stats, setStats] = useState(initial);
  const [scope, setScope] = useState("new");
  /** Estado da consulta contínua: o mesmo do painel flutuante (que é quem roda o laço). */
  const [dock, setDock] = useState<DockData | null>(null);
  useEffect(() => {
    const f = (e: Event) => setDock((e as CustomEvent<DockData>).detail);
    window.addEventListener(ENRICH_STATE, f); askEnrich();
    return () => window.removeEventListener(ENRICH_STATE, f);
  }, []);
  const [on, setOn] = useState(on0);
    const [busy, setBusy] = useState(false);
  const loop = !!dock?.state.on;
  const [log, setLog] = useState("");
  const [pending, start] = useTransition();
  const [group, setGroup] = useState<(typeof ENRICH_GROUPS)[number] | "Por estado">("Fila");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<FoundLead[] | null>(null);
  const [one, setOne] = useState<{ id: number; msg: string; ok: boolean } | null>(null);
  const [oneBusy, setOneBusy] = useState<number | null>(null);
  const pct = live.stats.total ? Math.round((live.stats.done / live.stats.total) * 100) : 0;

  const once = async (size = 10) => {
    setBusy(true);
    try {
      const r = await runEnrichBatchAction(size, scope);
      setStats(r.stats);
      setLog(r.tried ? `Último lote: ${r.ok} consultados, ${r.failed} sem resposta.${r.rerun?.tried ? ` Nova rodada: ${r.rerun.saved} de ${r.rerun.tried} recuperados em outra fonte.` : ""}${r.rerun?.parked ? ` ${r.rerun.parked} com CNPJ inexistente ou inválido ficam de lado por 7 dias.` : ""}` : "Nada pendente nesta lista.");
      return r;
    } catch { setLog("A conexão falhou neste lote. Tento de novo."); return null; } finally { setBusy(false); }
  };
  const toggleLoop = async () => {
    setBusy(true);
    try { const r = await (loop ? stopApi() : startApi(scope)); setEnrich(r); setDock(r); setStats(r.stats); setLog(loop ? "Consulta contínua parada." : ""); } catch { setLog("Não consegui mudar o modo contínuo. Tente de novo."); } finally { setBusy(false); }
  };

  const cnt = (dock?.stats ?? stats).lists ?? {};
  const ufs = Object.entries((dock?.stats ?? stats).ufs ?? {});
  const curKey = loop ? dock!.state.scope : scope;
  const cur = listVisual(curKey);
  const search = (v: string) => { setQ(v); setOne(null); if (v.trim().length < 2) { setFound(null); return; } void findLeadsAction(v).then(setFound).catch(() => setFound([])); };
  const runOne = async (id: number) => { setOneBusy(id); try { const r = await enrichOneAction(id); setOne({ id, msg: r.message, ok: r.ok }); if (r.lead) setFound((f) => (f ?? []).map((x) => (x.id === id ? r.lead! : x))); } catch { setOne({ id, msg: "Não consegui consultar agora.", ok: false }); } finally { setOneBusy(null); } };
  const fd = live.found;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border-2 p-5 sm:p-6" style={{ background: tint(live.running || loop ? cur.hex : "#6366f1", 22, 5), borderColor: `color-mix(in srgb, ${live.running || loop ? cur.hex : "#6366f1"} 50%, transparent)` }}>
        <DatabaseZap aria-hidden size={190} strokeWidth={1.2} className="pointer-events-none absolute -bottom-10 -right-6 -rotate-12 opacity-[.1]" style={{ color: cur.hex }} />
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
          <span className="relative grid size-24 shrink-0 place-items-center"><MetricRing value={pct} color={cur.hex} size="size-24" /><span className="figure absolute text-xl font-extrabold">{pct}%</span></span>
          <div className="min-w-56 flex-1">
            <p className="figure flex flex-wrap items-baseline gap-x-2 text-4xl font-extrabold leading-none">{live.stats.done.toLocaleString("pt-BR")}<span className="text-base font-medium text-muted">de {live.stats.total.toLocaleString("pt-BR")} consultados</span></p>
            <p className="mt-2 text-sm text-muted">{live.stats.pending.toLocaleString("pt-BR")} esperando · {live.stats.failed.toLocaleString("pt-BR")} sem resposta (tento de novo em 6 h){live.stats.rwQueue > 0 && <> · {live.stats.rwQueue.toLocaleString("pt-BR")} na fila da ReceitaWS (e-mail e telefone)</>}</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-sunk/80" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leads consultados"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, live.stats.done ? 1 : 0)}%`, background: iconTile(cur.hex) }} /></div>
          </div>
          <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold ${live.running || loop ? "bg-white text-black shadow" : "bg-sunk text-muted"}`}><span className={`size-2 rounded-full ${live.running || loop ? "animate-pulse bg-ok" : "bg-muted"}`} />{loop ? `Contínuo: ${cur.label}` : live.running ? "Consultando agora" : "Parada"}</span>
        </div>
      </section>

      <DashSection I={Zap} title="Ritmo e resultado" hint="o que a consulta está fazendo e trazendo" hex="#6366f1">
        <MetricCard i={0} featured I={Zap} t="Ritmo (10 min)" v={`${live.rate.perMin.toFixed(1).replace(".", ",")}/min`} s={`${live.rate.m10} consultas nos últimos 10 min`} hex="#6366f1" />
        <MetricCard i={1} I={Clock} t="Tempo para acabar" v={live.rate.etaMin == null ? "—" : live.rate.etaMin >= 120 ? `${Math.round(live.rate.etaMin / 60)} h` : `${live.rate.etaMin} min`} s={live.rate.etaMin == null ? "sem consultas recentes" : "no ritmo atual"} hex="#0ea5e9" />
        <MetricCard i={2} I={CheckCircle2} t="Acerto (24 h)" v={live.rate.okPct == null ? "—" : `${live.rate.okPct}%`} s={`${live.rate.h24} consultas · média ${live.rate.avgMs == null ? "—" : (live.rate.avgMs / 1000).toFixed(1).replace(".", ",") + " s"}`} hex="#22c55e" bar={live.rate.okPct ?? undefined} hot={live.rate.okPct != null && live.rate.okPct < 60} />
        <MetricCard i={3} I={Sparkles} t="Prontos p/ shuffler" v={live.stats.ready.toLocaleString("pt-BR")} s="consultados e sem contato (prioridade)" hex="#f59e0b" />
        <MetricCard i={4} I={Phone} t="Telefones achados (24 h)" v={fd.phones.toLocaleString("pt-BR")} s={fd.avgPhones != null ? `${fd.avgPhones.toLocaleString("pt-BR")} por consulta` : "—"} hex="#10b981" />
        <MetricCard i={5} I={Mail} t="E-mails achados (24 h)" v={fd.emails.toLocaleString("pt-BR")} s="novos nos cadastros" hex="#ec4899" />
        <MetricCard i={6} I={ShieldCheck} t="CNPJ ativos (24 h)" v={fd.active.toLocaleString("pt-BR")} s={`${fd.inactive.toLocaleString("pt-BR")} não ativos`} hex="#14b8a6" bar={fd.active + fd.inactive ? Math.round((fd.active / (fd.active + fd.inactive)) * 100) : undefined} />
        <MetricCard i={7} I={TriangleAlert} t="Sem resposta agora" v={live.stats.failed.toLocaleString("pt-BR")} s="voltam à fila em 6 h" hex="#ef4444" hot={live.stats.failed > 0 && live.stats.failed > live.stats.done * 0.1} />
      </DashSection>

      <DashBlock I={Search} title="Consultar um lead agora" hex="#0ea5e9">
        <div className="space-y-3">
          <label className="relative block"><Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className={`${inputCls} pl-10`} value={q} onChange={(e) => search(e.target.value)} placeholder="Nome da empresa, nome fantasia ou CNPJ…" aria-label="Buscar lead para consultar" /></label>
          {found && (
            <ul className="space-y-2">
              {found.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-bg p-3">
                  <div className="min-w-0 flex-1"><LeadLink id={f.id} className="text-[15px]">{f.company}</LeadLink><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted"><span className="figure">{cnpjF(f.cnpj)}</span>{(f.city || f.uf) && <span>· {[f.city, f.uf].filter(Boolean).join("/")}</span>}<StatusChip s={f.status} /><span>· {f.enrichedAt ? `consultado há ${ago(f.enrichedAt, now)}` : "nunca consultado"}</span></p>
                    {one?.id === f.id && <p className={`mt-1 text-xs font-medium ${one.ok ? "text-ok" : "text-danger"}`}>{one.msg}</p>}</div>
                  <button type="button" className={btnGhost} disabled={oneBusy === f.id} onClick={() => void runOne(f.id)}>{oneBusy === f.id ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RotateCcw size={15} aria-hidden />} Consultar</button>
                  <a href={`/leads/${f.id}`} className={btnPrimary}><ExternalLink size={15} aria-hidden /> Abrir lead</a>
                </li>
              ))}
              {!found.length && <li className="rounded-xl bg-sunk/60 px-3 py-4 text-center text-sm text-muted">Nenhum lead com esse nome ou CNPJ.</li>}
            </ul>
          )}
        </div>
      </DashBlock>

      <DashBlock I={ListOrdered} title="Escolha a fila para consultar" hex={cur.hex}>
        <div className="space-y-4">
          <div role="tablist" aria-label="Tipo de fila" className="flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-sunk/60 p-1 text-sm font-semibold">
            {[...ENRICH_GROUPS, "Por estado" as const].map((g) => <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className={`rounded-lg px-3.5 py-1.5 transition ${group === g ? "bg-panel text-accent shadow-sm" : "text-muted hover:text-ink"}`}>{g}</button>)}
          </div>
          {group === "Por estado" ? (
            <ul role="radiogroup" aria-label="Estados" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {ufs.map(([u, n]) => <li key={u}><ListChoice compact k={`uf:${u}`} count={n} selected={curKey === `uf:${u}`} disabled={busy || loop} onPick={() => setScope(`uf:${u}`)} /></li>)}
              {!ufs.length && <li className="col-span-full rounded-xl bg-sunk/60 px-3 py-4 text-center text-sm text-muted">Nenhum estado com leads esperando.</li>}
            </ul>
          ) : (
            <ul role="radiogroup" aria-label={group} className="stagger grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {ENRICH_LISTS.filter((l) => l.group === group).map((l) => <li key={l.key}><ListChoice k={l.key} count={cnt[l.key] ?? 0} selected={curKey === l.key} disabled={busy || loop} onPick={() => setScope(l.key)} /></li>)}
            </ul>
          )}
          <p className="rounded-xl bg-sunk/60 px-3.5 py-2.5 text-sm text-muted"><b className="text-ink">{cur.label}:</b> {listMeta(curKey)?.hint}</p>
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" className={btnPrimary} disabled={busy || loop} onClick={() => void once(10)}>{busy && !loop ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Zap size={16} aria-hidden />} Consultar um lote (10)</button>
            {loop
              ? <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-[15px] font-semibold text-danger transition hover:bg-danger/20" disabled={busy} onClick={() => void toggleLoop()}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Parar modo contínuo</button>
              : <button type="button" className={btnGhost} disabled={busy} onClick={() => void toggleLoop()}><Play size={16} aria-hidden /> Modo contínuo (100 em 100)</button>}
            <button type="button" className={btnGhost} disabled={busy || loop || pending} onClick={() => start(async () => { await retryFailedEnrichAction(); const r = await runEnrichBatchAction(1); setStats(r.stats); })}><RotateCcw size={15} aria-hidden /> Tentar os sem resposta de novo</button>
          </div>
          <div className="space-y-1 text-sm text-muted" aria-live="polite">{loop && <p className="flex items-center gap-1.5"><Loader2 size={13} className="shrink-0 animate-spin" aria-hidden /> Contínuo ativo{dock?.state.byName && !dock.state.mine ? ` (iniciado por ${dock.state.byName})` : ""}: roda em qualquer página, também pelo painel lateral.</p>}{log && <p>{log}</p>}</div>
        </div>
      </DashBlock>

      <section className={`${panelCls} flex flex-wrap items-center gap-4 p-5`}>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">Consulta automática</h2><p className="text-sm text-muted">Ligada: a tarefa agendada consulta os leads pendentes e os shufflers deixam de consultar sozinhos (o botão “Atualizar informações” continua).</p>
          <details className="mt-2 rounded-lg bg-sunk/60 text-sm"><summary className={`cursor-pointer select-none px-3 py-2 font-medium ${cronReady ? "text-ok" : on ? "text-warn" : "text-muted"}`}>{cronReady ? "Tarefa agendada pronta (CRON_SECRET configurada)" : "Tarefa agendada: falta configurar o CRON_SECRET"}</summary>
            <ol className="list-decimal space-y-1 px-3 pb-3 pl-7 text-muted">
              <li>Na Vercel: Settings → Environment Variables → crie <b className="text-ink">CRON_SECRET</b> com um texto longo e aleatório (ex.: 40 letras e números).</li>
              <li>Faça um Redeploy. A Vercel passa a chamar <b className="text-ink">/api/cron/enrich</b> sozinha uma vez por dia (09:00 UTC).</li>
              <li>No plano Hobby o cron só roda 1 vez por dia; para consultar mais, use o lote e o modo contínuo acima (funcionam sem o CRON_SECRET).</li>
            </ol></details></div>
        <button type="button" role="switch" aria-checked={on} aria-label="Consulta automática" disabled={pending} onClick={() => start(async () => { const n = !on; setOn(n); await setAutoEnrichAction(n); })} className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? "bg-grad" : "border border-line bg-sunk"}`}><span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} /></button>
      </section>

      <div role="tablist" aria-label="Visão" className="flex w-fit gap-1 rounded-xl border border-line bg-panel p-1 text-sm font-medium">
        {([["live", "Ao vivo", Activity], ["hist", "Histórico", HistoryIcon]] as const).map(([k, l, I]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition ${tab === k ? "bg-grad-soft text-accent" : "text-muted hover:text-ink"}`}><I size={15} aria-hidden /> {l}</button>)}
      </div>

      {tab === "hist" ? <History /> : (
        <>
          <DashBlock I={Clock} title="Últimas 24 horas" hex="#6366f1">
            <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-accent" />consultadas</span><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-danger/70" />sem resposta</span></p>
            {(() => { const max = Math.max(1, ...live.hours.map((h) => h.ok + h.fail)); return (
              <div aria-label="Consultas por hora" className="grid gap-x-1" style={{ gridTemplateColumns: `repeat(${live.hours.length}, minmax(0, 1fr))` }}>
                {live.hours.map((h, i) => (
                  <div key={`b${i}`} className="flex h-28 flex-col justify-end border-b border-line" title={`${h.h}: ${h.ok} ok, ${h.fail} sem resposta`}>
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${((h.ok + h.fail) / max) * 100}%`, minHeight: h.ok + h.fail ? 4 : 0 }}><div className="bg-danger/70" style={{ flex: h.fail }} /><div className="bg-grad" style={{ flex: h.ok }} /></div>
                  </div>
                ))}
                {live.hours.map((h, i) => <span key={`l${i}`} className="figure mt-1.5 h-3 overflow-visible whitespace-nowrap text-center text-[10px] leading-3 text-muted">{i % 3 === 0 ? h.h : ""}</span>)}
              </div>); })()}
          </DashBlock>

          <div className="grid gap-4 lg:grid-cols-2">
            <DashBlock I={ListOrdered} title="Próximos da fila" hex="#6366f1">
              <ol className="-mx-1 divide-y divide-line/70">
                {live.queue.map((q, i) => <li key={q.id} className="flex items-center gap-3 px-1 py-2 text-sm"><span className="figure w-5 text-xs text-muted">{i + 1}</span><div className="min-w-0 flex-1"><LeadLink id={q.id} className="font-medium">{q.company}</LeadLink><p className="text-xs text-muted">{cnpjF(q.cnpj)}{q.priorTry ? ` · já tentado há ${ago(q.priorTry, now)}` : ""}</p></div></li>)}
                {!live.queue.length && <li className="p-6 text-center text-sm text-muted">Fila vazia: todos foram consultados.</li>}
              </ol>
            </DashBlock>
            <DashBlock I={TriangleAlert} title="Falharam (últimas 6 h)" hex="#ef4444">
              <ul className="-mx-1 divide-y divide-line/70">
                {live.failed.map((f) => <li key={f.id} className="px-1 py-2 text-sm"><div className="flex items-center justify-between gap-2"><LeadLink id={f.id} className="font-medium">{f.company}</LeadLink><span className="figure shrink-0 text-xs text-muted">há {ago(f.at, now)} · {f.tries}x</span></div><p className="text-xs text-muted">{cnpjF(f.cnpj)}{f.why ? ` · ${f.why}` : ""}</p><button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-50" disabled={oneBusy === f.id} onClick={() => void runOne(f.id)}>{oneBusy === f.id ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RotateCcw size={12} aria-hidden />} Consultar de novo</button>{one?.id === f.id && <span className={`ml-2 text-xs ${one.ok ? "text-ok" : "text-danger"}`}>{one.msg}</span>}</li>)}
                {!live.failed.length && <li className="p-6 text-center text-sm text-muted">Nenhuma falha recente.</li>}
              </ul>
            </DashBlock>
          </div>

          <DashBlock I={Activity} title="Acontecendo agora" hex="#10b981">
            <ul className="-mx-3 divide-y divide-line/70">{live.recent.map((r) => <LogLine key={r.id} r={r} now={now} />)}{!live.recent.length && <li className="p-6 text-center text-sm text-muted">Nenhuma consulta registrada ainda.</li>}</ul>
          </DashBlock>

          {(live.origins.length > 0 || live.topWhy.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <DashBlock I={Sparkles} title="Quem consultou (24 h)" hex="#8b5cf6"><ul className="space-y-1.5 text-sm">{live.origins.map((o) => <li key={o.origin} className="flex justify-between"><span>{ORIGIN[o.origin] ?? o.origin}</span><span className="figure text-muted">{o.ok}/{o.n} ok</span></li>)}</ul></DashBlock>
              <DashBlock I={TriangleAlert} title="Motivos de falha (24 h)" hex="#f59e0b"><ul className="space-y-1.5 text-sm">{live.topWhy.map((w) => <li key={w.why} className="flex justify-between gap-3"><span className="truncate">{w.why}</span><span className="figure text-muted">{w.n}x</span></li>)}{!live.topWhy.length && <li className="text-muted">Nenhuma falha.</li>}</ul></DashBlock>
            </div>
          )}
        </>
      )}
    </div>
  );
}
