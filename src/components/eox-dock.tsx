"use client";

import { ChevronLeft, Clock3, Gauge, ListChecks, Pause, Play, TriangleAlert, Loader2, Plug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EOX_GROUPS, EOX_LISTS } from "@/config/eox-lists";
import { DAEMON_OFFLINE_MIN } from "@/config/enrich-daemon";
import type { EoxDock } from "@/modules/eox/consult-daemon";
import { MetricRing } from "./dash-ui";
import { iconTile } from "./enrich-visual";
import { DOCK_OPEN, EOX_ASK, EOX_SET, eoxDockApi, eoxStartApi, eoxStopApi, eoxTickApi, publishEox } from "./eox-api";
import { EOX_HEX, EoxChoice, EoxIcon, EoxResult, LeadLink, eoxVisual } from "./eox-parts";

const nf = new Intl.NumberFormat("pt-BR");
const ago = (iso: string, now: number) => { const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h`; };
const eta = (min: number) => (min < 1 ? "menos de 1 min" : min < 60 ? `${Math.round(min)} min` : min < 1440 ? `${(min / 60).toFixed(1).replace(".", ",")} h` : `${Math.round(min / 1440)} dias`);

/**
 * Painel lateral da Consulta EOX (só Adm), irmão do painel de CNPJ: procura cada lead na EOX pelo CNPJ e completa telefones, e-mails,
 * pessoas e endereço. Roda em qualquer página até o Adm parar, a fila acabar ou quem iniciou ficar mais de 10 min offline.
 */
export function EoxDockPanel({ side }: { side?: boolean }) {
  const [d, setD] = useState<EoxDock | null>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("new");
  const [group, setGroup] = useState<(typeof EOX_GROUPS)[number] | "Por estado">("Fila");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false), openRef = useRef(false), onRef = useRef(false), lastLoad = useRef(0);
  const put = (r: EoxDock) => { setD(r); publishEox(r); };

  useEffect(() => {
    let alive = true;
    const load = async (force = false) => {
      if (document.visibilityState === "hidden" && running.current) return;
      if (!force && !openRef.current && !onRef.current && Date.now() - lastLoad.current < 30_000) return;
      lastLoad.current = Date.now();
      try { const r = await eoxDockApi(); if (alive && !running.current) put(r); } catch { /* sem rede: tenta no próximo ciclo */ }
    };
    void load(true);
    const t = setInterval(() => void load(), 4000), c = setInterval(() => setNow(Date.now()), 1000);
    const onSet = (e: Event) => { if (alive) put((e as CustomEvent<EoxDock>).detail); };
    const onAsk = () => void load(true);
    const onOther = (e: Event) => { if ((e as CustomEvent<string>).detail !== "eox") setOpen(false); };
    window.addEventListener(EOX_SET, onSet); window.addEventListener(EOX_ASK, onAsk); window.addEventListener(DOCK_OPEN, onOther);
    return () => { alive = false; clearInterval(t); clearInterval(c); window.removeEventListener(EOX_SET, onSet); window.removeEventListener(EOX_ASK, onAsk); window.removeEventListener(DOCK_OPEN, onOther); };
  }, []);

  /* o laço: só quem iniciou executa; cada passo consulta um bloco de leads */
  const mine = !!d?.state.mine;
  useEffect(() => {
    if (!mine || running.current) return;
    running.current = true;
    let alive = true;
    (async () => {
      while (alive) {
        let go = false, wait = 1.5;
        try { const r = await eoxTickApi(); if (alive) put(r); go = r.go; wait = r.wait ?? 1.5; } catch { await new Promise((x) => setTimeout(x, 5000)); go = true; }
        if (!go) break;
        await new Promise((x) => setTimeout(x, wait * 1000));
      }
      running.current = false;
    })();
    return () => { alive = false; running.current = false; };
  }, [mine]);

  if (!d) return null;
  const on = d.state.on;
  openRef.current = open; onRef.current = on;
  const { done, total, pending, failed } = d.stats;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const seg = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  const act = async (fn: () => Promise<EoxDock>) => { setBusy(true); try { put(await fn()); } finally { setBusy(false); } };
  const curKey = on ? d.state.scope : scope;
  const cur = eoxVisual(curKey);
  const left = d.stats.lists?.[curKey] ?? 0;
  const etaMin = d.rate.perMin > 0 ? left / d.rate.perMin : null;
  const last = d.rows[0];
  const hex = on ? cur.hex : EOX_HEX;
  const toggle = () => { const next = !open; setOpen(next); if (next) window.dispatchEvent(new CustomEvent(DOCK_OPEN, { detail: "eox" })); };

  return (
    <aside aria-label="Consulta contínua da EOX" className={`fixed inset-y-0 z-[55] flex items-center transition-transform duration-300 ${side ? "left-0 lg:left-[17rem]" : "left-0"} ${open ? "translate-x-0" : "-translate-x-[min(26rem,92vw)]"}`}>
      <div className="card-surface flex h-full w-[min(26rem,92vw)] flex-col overflow-hidden border-0 border-r-2 border-line shadow-2xl" style={{ backgroundColor: "color-mix(in srgb, var(--panel) 80%, transparent)" }}>
        <header className="relative shrink-0 overflow-hidden px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] text-white" style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 55%, #000))` }}>
          <Plug aria-hidden size={110} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-4 -rotate-12 opacity-[.14]" />
          <div className="relative flex items-center gap-3">
            <span className="relative grid size-14 shrink-0 place-items-center"><MetricRing value={pct} color="#fff" track="rgba(255,255,255,.25)" size="size-14" /><span className="figure absolute text-[13px] font-extrabold">{pct}%</span></span>
            <div className="min-w-0 flex-1"><h2 className="text-base font-extrabold leading-tight">Consulta EOX</h2><p className="truncate text-xs opacity-90">{on ? `Rodando: ${cur.label}` : "Completa os leads com o cadastro da EOX"}</p>
              <p className="figure mt-0.5 text-[11px] opacity-90">{nf.format(done)} de {nf.format(total)} consultados · {nf.format(d.stats.linked)} com link</p></div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${on ? "bg-white text-black" : "bg-black/25"}`}><span className={`size-1.5 rounded-full ${on ? "animate-pulse bg-ok" : "bg-white/60"}`} />{on ? "Rodando" : "Parada"}</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-24 text-sm">
          <section aria-label="Progresso geral" className="space-y-2.5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leads consultados na EOX">
              <span className="h-full transition-all duration-700" style={{ width: seg(done), background: iconTile(EOX_HEX) }} /><span className="h-full bg-danger/50 transition-all duration-700" style={{ width: seg(failed) }} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {([["Consultados", done, "#22c55e"], ["Esperando", pending, EOX_HEX], ["Sem resposta", failed, "#ef4444"]] as const).map(([l, n, c]) => (
                <div key={l} className="rounded-xl border px-2 py-1.5" style={{ background: `color-mix(in srgb, ${c} 12%, var(--panel))`, borderColor: `color-mix(in srgb, ${c} 40%, transparent)` }}><dt className="text-[11px] text-muted">{l}</dt><dd className="figure text-base font-extrabold">{nf.format(n)}</dd></div>
              ))}
            </dl>
          </section>

          {on && (
            <section aria-label="Lista em andamento" className="relative space-y-2.5 overflow-hidden rounded-2xl border-2 p-3" style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${cur.hex} 22%, var(--panel)), color-mix(in srgb, ${cur.hex} 6%, var(--panel)))`, borderColor: `color-mix(in srgb, ${cur.hex} 55%, transparent)` }}>
              <cur.I aria-hidden size={84} strokeWidth={1.4} className="pointer-events-none absolute -bottom-4 -right-2 -rotate-12 opacity-[.13]" style={{ color: cur.hex }} />
              <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: cur.hex }}><span className="grid size-6 place-items-center rounded-lg text-white" style={{ background: iconTile(cur.hex) }}><cur.I size={13} aria-hidden /></span>Lista em andamento</p>
              <p className="relative font-bold leading-snug">{cur.label}</p>
              <div className="relative grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-panel/90 px-2 py-1.5"><p className="figure text-sm font-extrabold">{nf.format(left)}</p><p className="text-[11px] text-muted">restam</p></div>
                <div className="rounded-lg bg-panel/90 px-2 py-1.5"><p className="figure text-sm font-extrabold">{nf.format(d.rate.doneSince)}</p><p className="text-[11px] text-muted">nesta rodada</p></div>
                <div className="rounded-lg bg-panel/90 px-2 py-1.5"><p className="figure text-sm font-extrabold">{d.rate.perMin.toLocaleString("pt-BR")}/min</p><p className="text-[11px] text-muted">{d.rate.okPct != null ? `${d.rate.okPct}% ok` : "ritmo"}</p></div>
              </div>
              {etaMin != null && left > 0 && <p className="relative flex items-center gap-1.5 text-xs text-muted"><Clock3 size={13} aria-hidden /> Termina em cerca de <b className="text-ink">{eta(etaMin)}</b> neste ritmo.</p>}
            </section>
          )}
          {on && !d.state.mine && <p className="rounded-xl bg-sunk px-3 py-2 text-xs text-muted">Rodando no navegador de <b className="text-ink">{d.state.byName ?? "outro Adm"}</b>. Você pode parar daqui.</p>}
          {d.state.stoppedWhy && <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />{d.state.stoppedWhy}</p>}

          {last && (
            <section aria-label="Última consulta" className="rounded-2xl border-2 p-3" style={{ background: `color-mix(in srgb, ${last.ok ? "#22c55e" : "#ef4444"} 12%, var(--panel))`, borderColor: `color-mix(in srgb, ${last.ok ? "#22c55e" : "#ef4444"} 45%, transparent)` }}>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Última consulta · há {ago(last.at, now)}</p>
              <LeadLink id={last.leadId} className="text-[15px] leading-snug">{last.company}</LeadLink>
              <EoxResult r={last} />
            </section>
          )}

          {!on && (
            <section aria-label="Escolher a lista" className="space-y-2.5">
              <p className="flex items-center gap-2 font-bold"><ListChecks size={16} className="text-accent" aria-hidden /> Qual fila consultar</p>
              <div role="tablist" aria-label="Tipo de fila" className="grid grid-cols-4 gap-1 rounded-xl bg-sunk p-1 text-[11px] font-semibold">
                {([...EOX_GROUPS, "Por estado"] as const).map((g) => <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className={`min-h-8 rounded-lg px-1 leading-tight transition ${group === g ? "bg-panel text-accent shadow-sm" : "text-muted hover:text-ink"}`}>{g}</button>)}
              </div>
              {group === "Por estado" ? (
                <ul role="radiogroup" aria-label="Estados" className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
                  {Object.entries(d.stats.ufs ?? {}).map(([u, n]) => <li key={u}><EoxChoice compact k={`uf:${u}`} count={n} selected={scope === `uf:${u}`} onPick={() => setScope(`uf:${u}`)} /></li>)}
                  {!Object.keys(d.stats.ufs ?? {}).length && <li className="col-span-3 rounded-lg bg-sunk/60 px-3 py-3 text-center text-xs text-muted">Nenhum estado com leads esperando.</li>}
                </ul>
              ) : (
                <ul role="radiogroup" aria-label={group} className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                  {EOX_LISTS.filter((l) => l.group === group).map((l) => <li key={l.key}><EoxChoice compact k={l.key} count={d.stats.lists?.[l.key] ?? 0} selected={scope === l.key} onPick={() => setScope(l.key)} /></li>)}
                </ul>
              )}
              <p className="rounded-lg bg-sunk/60 px-3 py-2 text-xs text-muted">{eoxVisual(scope).hint}</p>
            </section>
          )}

          {on
            ? <button type="button" disabled={busy} onClick={() => act(eoxStopApi)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-danger/40 bg-danger/10 px-3 py-2 text-sm font-bold text-danger transition hover:bg-danger/20 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Parar consulta</button>
            : <button type="button" disabled={busy || (d.stats.lists?.[scope] ?? 0) === 0} onClick={() => act(() => eoxStartApi(scope))} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50" style={{ background: iconTile(EOX_HEX) }}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Iniciar consulta</button>}
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted"><Gauge size={12} className="mt-0.5 shrink-0" aria-hidden />Roda em qualquer página. Só preenche o que está vazio. Para sozinha se você ficar offline por mais de {DAEMON_OFFLINE_MIN} min ou quando a fila acabar.</p>

          <section aria-label="Últimas consultas">
            <h3 className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted"><span>Últimas consultas</span><a href="/admin/consulta-eox" className="normal-case tracking-normal text-accent hover:underline">ver tudo</a></h3>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line" aria-live="polite">
              {d.rows.slice(1).map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 px-3 py-2">
                  <EoxIcon ok={r.ok} />
                  <div className="min-w-0 flex-1"><LeadLink id={r.leadId} className="line-clamp-2 text-[13px] leading-snug">{r.company}</LeadLink><EoxResult r={r} /></div>
                  <span className="figure shrink-0 text-[11px] text-muted">{ago(r.at, now)}</span>
                </li>
              ))}
              {d.rows.length <= 1 && <li className="px-3 py-5 text-center text-xs text-muted">{d.rows.length ? "Só a consulta acima por enquanto." : "Nenhuma consulta ainda."}</li>}
            </ul>
          </section>
        </div>
      </div>
      <button type="button" aria-expanded={open} aria-label={open ? "Recolher painel da Consulta EOX" : "Abrir painel da Consulta EOX"} onClick={toggle} className="card-surface relative -ml-px grid h-28 w-11 translate-y-32 place-items-center rounded-r-2xl border-2 border-l-0 border-line shadow-lg" style={{ borderColor: `color-mix(in srgb, ${EOX_HEX} 40%, var(--line))` }}>
        {open ? <ChevronLeft size={18} aria-hidden /> : <span className="flex flex-col items-center gap-1"><span className="relative grid place-items-center"><MetricRing value={pct} color={EOX_HEX} size="size-9" /><Plug size={14} className="absolute" style={{ color: EOX_HEX }} aria-hidden /></span><span className="figure text-[10px] font-bold">{pct}%</span></span>}
      </button>
    </aside>
  );
}
