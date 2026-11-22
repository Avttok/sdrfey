"use client";

import { CheckCircle2, ChevronLeft, Clock3, DatabaseZap, Gauge, ListChecks, Loader2, Pause, Play, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ENRICH_GROUPS, ENRICH_LISTS, ENRICH_LIST_BY_KEY } from "@/config/enrich-lists";
import { DAEMON_OFFLINE_MIN } from "@/config/enrich-daemon";
import { dockAction, daemonStartAction, daemonStopAction, daemonTickAction, type DockData } from "@/modules/enrich/daemon-actions";
import { ENRICH_ASK, ENRICH_SET, publishEnrich } from "./enrich-bridge";

const nf = new Intl.NumberFormat("pt-BR");
const ago = (iso: string, now: number) => { const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h`; };
const eta = (min: number) => (min < 1 ? "menos de 1 min" : min < 60 ? `${Math.round(min)} min` : min < 1440 ? `${(min / 60).toFixed(1).replace(".", ",")} h` : `${Math.round(min / 1440)} dias`);

/**
 * Painel lateral da consulta contínua de CNPJ (só Adm). Vive no layout: continua rodando ao trocar de página
 * e só para quando o Adm manda parar, a fila acaba ou quem iniciou fica mais de 10 min offline.
 * A tela do Adm usa este mesmo motor (pela ponte de eventos), então os dois sempre mostram a mesma coisa.
 */
export function EnrichDock({ side }: { side?: boolean }) {
  const [d, setD] = useState<DockData | null>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("new");
  const [group, setGroup] = useState<(typeof ENRICH_GROUPS)[number]>("Fila");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false);
  const put = (r: DockData) => { setD(r); publishEnrich(r); };

  /* acompanha o estado (4 s) e o relógio (1 s); atende a tela do Adm */
  useEffect(() => {
    let alive = true;
    const load = async () => { if (document.visibilityState === "hidden" && running.current) return; try { const r = await dockAction(); if (alive) put(r); } catch { /* tenta de novo */ } };
    void load();
    const t = setInterval(load, 4000), c = setInterval(() => setNow(Date.now()), 1000);
    const onSet = (e: Event) => { if (alive) put((e as CustomEvent<DockData>).detail); };
    const onAsk = () => void load();
    window.addEventListener(ENRICH_SET, onSet); window.addEventListener(ENRICH_ASK, onAsk);
    return () => { alive = false; clearInterval(t); clearInterval(c); window.removeEventListener(ENRICH_SET, onSet); window.removeEventListener(ENRICH_ASK, onAsk); };
  }, []);

  /* o laço: só quem iniciou executa; um lead por vez */
  const mine = !!d?.state.mine;
  useEffect(() => {
    if (!mine || running.current) return;
    running.current = true;
    let alive = true;
    (async () => {
      while (alive) {
        let go = false;
        try { const r = await daemonTickAction(); if (alive) put(r); go = r.go; } catch { await new Promise((x) => setTimeout(x, 5000)); go = true; }
        if (!go) break;
        await new Promise((x) => setTimeout(x, 1500));
      }
      running.current = false;
    })();
    return () => { alive = false; running.current = false; };
  }, [mine]);

  if (!d) return null;
  const on = d.state.on;
  const { done, total, pending, failed } = d.stats;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const seg = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  const act = async (fn: () => Promise<DockData>) => { setBusy(true); try { put(await fn()); } finally { setBusy(false); } };
  const cur = ENRICH_LIST_BY_KEY.get(on ? d.state.scope : scope)!;
  const left = d.stats.lists?.[cur.key] ?? 0;
  const etaMin = d.rate.perMin > 0 ? left / d.rate.perMin : null;

  return (
    <aside aria-label="Consulta contínua de CNPJ" className={`fixed bottom-24 z-[55] flex items-end transition-transform duration-300 ${side ? "left-0 lg:left-[17rem]" : "left-0"} ${open ? "translate-x-0" : "-translate-x-[min(24rem,92vw)]"}`}>
      <div className="flex max-h-[calc(100dvh-8rem)] w-[min(24rem,92vw)] flex-col overflow-hidden rounded-r-2xl border border-l-0 border-line bg-panel shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line bg-grad-soft px-4 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel text-accent shadow-sm ring-1 ring-line"><DatabaseZap size={19} aria-hidden /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-bold leading-tight">Consulta de CNPJ</h2><p className="truncate text-xs text-muted">{on ? cur.label : "Preenche os dados dos leads"}</p></div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${on ? "bg-accent text-on-accent" : "bg-sunk text-muted"}`}><span className={`size-1.5 rounded-full ${on ? "animate-pulse bg-white" : "bg-muted/60"}`} />{on ? "Rodando" : "Parada"}</span>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <section aria-label="Progresso geral">
            <p className="figure flex flex-wrap items-baseline gap-x-2 text-2xl font-bold leading-none">{nf.format(done)}<span className="text-sm font-medium text-muted">de {nf.format(total)} consultados</span><span className="ml-auto text-lg text-accent">{pct}%</span></p>
            <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leads consultados">
              <span className="h-full bg-grad transition-all duration-700" style={{ width: seg(done) }} /><span className="h-full bg-danger/50 transition-all duration-700" style={{ width: seg(failed) }} />
            </div>
            <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              {([["Consultados", done, "bg-accent"], ["Esperando", pending, "bg-line"], ["Sem resposta", failed, "bg-danger/60"]] as const).map(([l, n, c]) => <div key={l} className="rounded-xl bg-sunk/70 px-2 py-1.5"><dt className="flex items-center justify-center gap-1 text-[11px] text-muted"><span className={`size-1.5 rounded-full ${c}`} aria-hidden />{l}</dt><dd className="figure text-sm font-bold">{nf.format(n)}</dd></div>)}
            </dl>
          </section>

          {on && (
            <section aria-label="Lista em andamento" className="space-y-2.5 rounded-xl border border-accent/30 bg-accent/5 p-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent"><ListChecks size={14} aria-hidden /> Lista em andamento</p>
              <p className="font-semibold leading-snug">{cur.label}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-panel px-2 py-1.5"><p className="figure text-sm font-bold">{nf.format(left)}</p><p className="text-[11px] text-muted">restam</p></div>
                <div className="rounded-lg bg-panel px-2 py-1.5"><p className="figure text-sm font-bold">{nf.format(d.rate.doneSince)}</p><p className="text-[11px] text-muted">nesta rodada</p></div>
                <div className="rounded-lg bg-panel px-2 py-1.5"><p className="figure text-sm font-bold">{d.rate.perMin.toLocaleString("pt-BR")}/min</p><p className="text-[11px] text-muted">{d.rate.okPct != null ? `${d.rate.okPct}% ok` : "ritmo"}</p></div>
              </div>
              {etaMin != null && left > 0 && <p className="flex items-center gap-1.5 text-xs text-muted"><Clock3 size={13} aria-hidden /> Termina em cerca de <b className="text-ink">{eta(etaMin)}</b> neste ritmo.</p>}
            </section>
          )}
          {on && !d.state.mine && <p className="rounded-xl bg-sunk px-3 py-2 text-xs text-muted">Rodando no navegador de <b className="text-ink">{d.state.byName ?? "outro Adm"}</b>. Você pode parar daqui.</p>}
          {d.state.stoppedWhy && <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />{d.state.stoppedWhy}</p>}

          {!on && (
            <section aria-label="Escolher a lista" className="space-y-2">
              <p className="font-semibold">Qual lista consultar</p>
              <div role="tablist" aria-label="Tipo de lista" className="flex gap-1 rounded-xl bg-sunk p-1 text-xs font-semibold">
                {ENRICH_GROUPS.map((g) => <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className={`min-h-8 flex-1 rounded-lg px-1.5 transition ${group === g ? "bg-panel text-accent shadow-sm" : "text-muted hover:text-ink"}`}>{g}</button>)}
              </div>
              <ul role="radiogroup" aria-label={group} className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                {ENRICH_LISTS.filter((l) => l.group === group).map((l) => { const n = d.stats.lists?.[l.key] ?? 0, sel = scope === l.key; return (
                  <li key={l.key}><button type="button" role="radio" aria-checked={sel} onClick={() => setScope(l.key)} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${sel ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}>
                    <span className={`grid size-4 shrink-0 place-items-center rounded-full border-2 ${sel ? "border-accent" : "border-line"}`}>{sel && <span className="size-1.5 rounded-full bg-accent" />}</span>
                    <span className={`min-w-0 flex-1 text-[13px] leading-snug ${sel ? "font-semibold" : ""}`}>{l.label}</span>
                    <span className={`figure shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${n ? "bg-sunk text-ink" : "text-muted"}`}>{nf.format(n)}</span>
                  </button></li>); })}
              </ul>
              <p className="rounded-lg bg-sunk/60 px-3 py-2 text-xs text-muted">{ENRICH_LIST_BY_KEY.get(scope)?.hint}</p>
            </section>
          )}

          {on
            ? <button type="button" disabled={busy} onClick={() => act(daemonStopAction)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-bold text-danger transition hover:bg-danger/20">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Parar consulta</button>
            : <button type="button" disabled={busy || (d.stats.lists?.[scope] ?? 0) === 0} onClick={() => act(() => daemonStartAction(scope))} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-grad px-3 py-2 text-sm font-bold text-on-accent shadow transition hover:brightness-110 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} {(d.stats.lists?.[scope] ?? 0) === 0 ? "Nada nesta lista" : "Ligar até eu parar"}</button>}
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted"><Gauge size={12} className="mt-0.5 shrink-0" aria-hidden />Roda em qualquer página. Para sozinha se você ficar offline por mais de {DAEMON_OFFLINE_MIN} min ou quando a lista acabar.</p>

          <section aria-label="Últimas consultas">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">Últimas consultas</h3>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line" aria-live="polite">
              {d.rows.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 px-3 py-2">
                  {r.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug">{r.company}</p>
                    {r.ok ? <p className="mt-1 flex flex-wrap gap-1 text-[11px]"><span className="rounded-full bg-sunk px-2 py-0.5 font-medium">{r.phones} {r.phones === 1 ? "telefone" : "telefones"}</span><span className="rounded-full bg-sunk px-2 py-0.5 font-medium">{r.emails} {r.emails === 1 ? "e-mail" : "e-mails"}</span>{r.status && <span className={`rounded-full px-2 py-0.5 font-bold ${r.status.toUpperCase().startsWith("ATIV") ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{r.status}</span>}</p>
                      : <p className="mt-0.5 text-[11px] text-danger">{r.why ?? "Sem resposta"}</p>}
                  </div>
                  <span className="figure shrink-0 text-[11px] text-muted">{ago(r.at, now)}</span>
                </li>
              ))}
              {!d.rows.length && <li className="px-3 py-5 text-center text-xs text-muted">Nenhuma consulta ainda.</li>}
            </ul>
          </section>
        </div>
      </div>
      <button type="button" aria-expanded={open} aria-label={open ? "Recolher painel de consulta de CNPJ" : "Abrir painel de consulta de CNPJ"} onClick={() => setOpen(!open)} className="relative -ml-px grid h-24 w-9 place-items-center rounded-r-xl border border-l-0 border-line bg-panel text-accent shadow-lg hover:bg-sunk">
        {open ? <ChevronLeft size={16} aria-hidden /> : <><DatabaseZap size={17} aria-hidden />{on && <span aria-hidden className="absolute right-1 top-1.5 size-2.5 animate-pulse rounded-full bg-accent ring-2 ring-panel" />}</>}
      </button>
    </aside>
  );
}
