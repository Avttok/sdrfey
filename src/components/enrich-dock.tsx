"use client";

import { CheckCircle2, ChevronLeft, DatabaseZap, Loader2, Pause, Play, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AGE_LISTS } from "@/modules/enrich/ages";
import { DAEMON_OFFLINE_MIN } from "@/config/enrich-daemon";
import { dockAction, daemonStartAction, daemonStopAction, daemonTickAction, type DockData } from "@/modules/enrich/daemon-actions";

const ago = (iso: string, now: number) => { const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h`; };

/**
 * Painel lateral da consulta contínua de CNPJ (só Adm). Vive no layout: continua rodando ao trocar de página
 * e só para quando o Adm manda parar, a fila acaba ou quem iniciou fica mais de 10 min offline.
 */
export function EnrichDock({ side }: { side?: boolean }) {
  const [d, setD] = useState<DockData | null>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false);

  /* acompanha o estado (4 s) e o relógio (1 s) */
  useEffect(() => {
    let alive = true;
    const load = async () => { if (document.visibilityState === "hidden" && running.current) return; try { const r = await dockAction(); if (alive) setD(r); } catch { /* tenta de novo */ } };
    void load();
    const t = setInterval(load, 4000), c = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(t); clearInterval(c); };
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
        try { const r = await daemonTickAction(); if (alive) setD(r); go = r.go; } catch { await new Promise((x) => setTimeout(x, 5000)); go = true; }
        if (!go) break;
        await new Promise((x) => setTimeout(x, 1500));
      }
      running.current = false;
    })();
    return () => { alive = false; running.current = false; };
  }, [mine]);

  if (!d) return null;
  const on = d.state.on;
  const pct = d.stats.total ? Math.round((d.stats.done / d.stats.total) * 100) : 0;
  const act = async (fn: () => Promise<DockData>) => { setBusy(true); try { setD(await fn()); } finally { setBusy(false); } };

  return (
    <aside aria-label="Consulta contínua de CNPJ" className={`fixed bottom-24 z-[55] flex items-end transition-transform duration-300 ${side ? "lg:left-[17rem] left-0" : "left-0"} ${open ? "translate-x-0" : "-translate-x-[19.5rem]"}`}>
      <div className="w-[19.5rem] overflow-hidden rounded-r-2xl border border-l-0 border-line bg-panel shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line bg-sunk/60 px-3 py-2.5">
          <DatabaseZap size={16} className="text-accent" aria-hidden />
          <h2 className="flex-1 text-sm font-semibold">Consulta de CNPJ</h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? "bg-grad-soft text-accent" : "bg-sunk text-muted"}`}><span className={`size-1.5 rounded-full ${on ? "animate-pulse bg-accent" : "bg-muted/60"}`} />{on ? "Rodando" : "Parada"}</span>
        </header>
        <div className="space-y-2.5 p-3 text-sm">
          <div>
            <p className="figure flex items-baseline gap-1.5 text-lg font-bold">{d.stats.done.toLocaleString("pt-BR")}<span className="text-xs font-medium text-muted">de {d.stats.total.toLocaleString("pt-BR")} · {pct}%</span></p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-grad transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-xs text-muted">{d.stats.pending.toLocaleString("pt-BR")} esperando · {d.stats.failed.toLocaleString("pt-BR")} sem resposta</p>
          </div>
          {on && !d.state.mine && <p className="rounded-lg bg-sunk px-2.5 py-1.5 text-xs text-muted">Rodando no navegador de <b className="text-ink">{d.state.byName ?? "outro Adm"}</b>.</p>}
          {d.state.stoppedWhy && <p className="flex items-start gap-1.5 rounded-lg bg-warn/10 px-2.5 py-1.5 text-xs text-warn"><TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />{d.state.stoppedWhy}</p>}
          {!on && (
            <label className="block text-xs text-muted">Lista
              <select className="mt-0.5 w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink" value={scope} onChange={(e) => setScope(Number(e.target.value))}>
                <option value={0}>Ainda não consultados</option>
                {AGE_LISTS.map((a) => <option key={a} value={a}>Consultados há mais de {a} dias</option>)}
              </select>
            </label>
          )}
          {on
            ? <button type="button" disabled={busy} onClick={() => act(daemonStopAction)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20">{busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Pause size={15} aria-hidden />} Parar consulta</button>
            : <button type="button" disabled={busy} onClick={() => act(() => daemonStartAction(scope))} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-grad px-3 py-2 text-sm font-semibold text-on-accent shadow transition hover:brightness-110">{busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Play size={15} aria-hidden />} Ligar até eu parar</button>}
          <p className="text-[11px] leading-snug text-muted">Roda em qualquer página. Para sozinha se você ficar offline por mais de {DAEMON_OFFLINE_MIN} min.</p>
        </div>
        <ul className="max-h-60 divide-y divide-line/70 overflow-y-auto border-t border-line text-xs" aria-live="polite">
          {d.rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 px-3 py-1.5">
              {r.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <XCircle size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
              <div className="min-w-0 flex-1"><p className="truncate font-medium" title={r.company}>{r.company}</p><p className="truncate text-muted">{r.ok ? `${r.phones} tel · ${r.emails} e-mail${r.status ? ` · ${r.status}` : ""}` : (r.why ?? "sem resposta")}</p></div>
              <span className="figure shrink-0 text-muted">{ago(r.at, now)}</span>
            </li>
          ))}
          {!d.rows.length && <li className="px-3 py-4 text-center text-muted">Nenhuma consulta ainda.</li>}
        </ul>
      </div>
      <button type="button" aria-expanded={open} aria-label={open ? "Recolher painel de consulta de CNPJ" : "Abrir painel de consulta de CNPJ"} onClick={() => setOpen(!open)} className="relative -ml-px grid h-24 w-8 place-items-center rounded-r-xl border border-l-0 border-line bg-panel text-accent shadow-lg hover:bg-sunk">
        {open ? <ChevronLeft size={16} aria-hidden /> : <><DatabaseZap size={16} aria-hidden />{on && <span aria-hidden className="absolute right-1 top-1 size-2 animate-pulse rounded-full bg-accent" />}</>}
      </button>
    </aside>
  );
}
