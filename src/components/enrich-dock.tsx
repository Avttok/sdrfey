"use client";

import { CheckCircle2, ChevronLeft, Clock3, DatabaseZap, ExternalLink, Gauge, ListChecks, Loader2, Mail, Pause, Phone, Play, Search, Timer, TriangleAlert, XCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ENRICH_GROUPS, ENRICH_LISTS, listMeta } from "@/config/enrich-lists";
import { MetricRing } from "./dash-ui";
import { LeadLink, ListChoice, StatusChip, iconTile, listVisual, tint } from "./enrich-visual";
import { DAEMON_OFFLINE_MIN } from "@/config/enrich-daemon";
import type { DockData } from "@/modules/enrich/daemon-actions";
import { dockApi, startApi, stopApi, tickApi } from "./enrich-api";
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
  const [group, setGroup] = useState<(typeof ENRICH_GROUPS)[number] | "Por estado">("Fila");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false);
  const openRef = useRef(false), onRef = useRef(false), lastLoad = useRef(0);
  const put = (r: DockData) => { setD(r); publishEnrich(r); };

  /* acompanha o estado (4 s) e o relógio (1 s); atende a tela do Adm */
  useEffect(() => {
    let alive = true;
    /* painel fechado e parado: consulta o banco só a cada 30 s (cada consulta conta vários milhares de leads) */
    const load = async (force = false) => { if (document.visibilityState === "hidden" && running.current) return; if (!force && !openRef.current && !onRef.current && Date.now() - lastLoad.current < 30_000) return; lastLoad.current = Date.now(); try { const r = await dockApi(); if (alive) put(r); } catch { /* tenta de novo */ } };
    void load(true);
    const t = setInterval(() => void load(), 4000), c = setInterval(() => setNow(Date.now()), 1000);
    const onSet = (e: Event) => { if (alive) put((e as CustomEvent<DockData>).detail); };
    const onAsk = () => void load(true);
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
        try { const r = await tickApi(); if (alive) put(r); go = r.go; } catch { await new Promise((x) => setTimeout(x, 5000)); go = true; }
        if (!go) break;
        await new Promise((x) => setTimeout(x, 1500));
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
  const act = async (fn: () => Promise<DockData>) => { setBusy(true); try { put(await fn()); } finally { setBusy(false); } };
  const curKey = on ? d.state.scope : scope;
  const cur = listVisual(curKey);
  const left = d.stats.lists?.[curKey] ?? 0;
  const etaMin = d.rate.perMin > 0 ? left / d.rate.perMin : null;
  const last = d.rows[0];
  const q = find.trim().toLowerCase();
  const groups = [...ENRICH_GROUPS, "Por estado"] as const;
  const ufs = Object.entries(d.stats.ufs ?? {});

  return (
    <aside aria-label="Consulta contínua de CNPJ" className={`fixed bottom-24 z-[55] flex items-end transition-transform duration-300 ${side ? "left-0 lg:left-[17rem]" : "left-0"} ${open ? "translate-x-0" : "-translate-x-[min(26rem,92vw)]"}`}>
      <div className="flex max-h-[calc(100dvh-8rem)] w-[min(26rem,92vw)] flex-col overflow-hidden rounded-r-3xl border-2 border-l-0 border-line bg-panel shadow-2xl">
        <header className="relative overflow-hidden px-4 py-3.5 text-white" style={{ background: `linear-gradient(135deg, ${on ? cur.hex : "#6366f1"}, color-mix(in srgb, ${on ? cur.hex : "#6366f1"} 55%, #000))` }}>
          <DatabaseZap aria-hidden size={110} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-4 -rotate-12 opacity-[.14]" />
          <div className="relative flex items-center gap-3">
            <span className="relative grid size-14 shrink-0 place-items-center"><MetricRing value={pct} color="#fff" track="rgba(255,255,255,.25)" size="size-14" /><span className="figure absolute text-[13px] font-extrabold">{pct}%</span></span>
            <div className="min-w-0 flex-1"><h2 className="text-base font-extrabold leading-tight">Consulta de CNPJ</h2><p className="truncate text-xs opacity-90">{on ? `Rodando: ${cur.label}` : "Preenche os dados dos leads"}</p>
              <p className="figure mt-0.5 text-[11px] opacity-90">{nf.format(done)} de {nf.format(total)} consultados</p></div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${on ? "bg-white text-black" : "bg-black/25"}`}><span className={`size-1.5 rounded-full ${on ? "animate-pulse bg-ok" : "bg-white/60"}`} />{on ? "Rodando" : "Parada"}</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <section aria-label="Progresso geral" className="space-y-2.5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leads consultados">
              <span className="h-full bg-grad transition-all duration-700" style={{ width: seg(done) }} /><span className="h-full bg-danger/50 transition-all duration-700" style={{ width: seg(failed) }} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {([["Consultados", done, "#22c55e"], ["Esperando", pending, "#6366f1"], ["Sem resposta", failed, "#ef4444"]] as const).map(([l, n, c]) => <div key={l} className="rounded-xl border px-2 py-1.5" style={{ background: tint(c, 16, 4), borderColor: `color-mix(in srgb, ${c} 35%, transparent)` }}><dt className="text-[11px] text-muted">{l}</dt><dd className="figure text-sm font-extrabold">{nf.format(n)}</dd></div>)}
            </dl>
          </section>

          {on && (
            <section aria-label="Lista em andamento" className="relative space-y-2.5 overflow-hidden rounded-2xl border-2 p-3" style={{ background: tint(cur.hex, 22, 6), borderColor: `color-mix(in srgb, ${cur.hex} 55%, transparent)` }}>
              <cur.I aria-hidden size={84} strokeWidth={1.4} className="pointer-events-none absolute -bottom-4 -right-2 -rotate-12 opacity-[.13]" style={{ color: cur.hex }} />
              <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: cur.hex }}><span className="grid size-6 place-items-center rounded-lg text-white" style={{ background: iconTile(cur.hex) }}><cur.I size={13} aria-hidden /></span> Lista em andamento</p>
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
            <section aria-label="Última consulta" className="rounded-2xl border-2 p-3" style={{ background: tint(last.ok ? "#22c55e" : "#ef4444", 18, 4), borderColor: `color-mix(in srgb, ${last.ok ? "#22c55e" : "#ef4444"} 45%, transparent)` }}>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{last.ok ? <CheckCircle2 size={13} className="text-ok" aria-hidden /> : <XCircle size={13} className="text-danger" aria-hidden />} Última consulta · há {ago(last.at, now)}</p>
              <LeadLink id={last.leadId} className="text-[15px] leading-snug">{last.company}</LeadLink>
              {last.ok ? <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]"><span className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 font-semibold"><Phone size={11} aria-hidden />{last.phones} novo{last.phones === 1 ? "" : "s"}</span><span className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 font-semibold"><Mail size={11} aria-hidden />{last.emails} novo{last.emails === 1 ? "" : "s"}</span><span className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 font-semibold"><Timer size={11} aria-hidden />{(last.ms / 1000).toFixed(1).replace(".", ",")} s</span><StatusChip s={last.status} /></p>
                : <p className="mt-1 text-xs text-danger">{last.why ?? "Sem resposta"}</p>}
              <Link2 id={last.leadId} />
            </section>
          )}

          {!on && (
            <section aria-label="Escolher a lista" className="space-y-2.5">
              <p className="flex items-center gap-2 font-bold"><ListChecks size={16} className="text-accent" aria-hidden /> Qual fila consultar</p>
              <div role="tablist" aria-label="Tipo de fila" className="grid grid-cols-4 gap-1 rounded-xl bg-sunk p-1 text-[11px] font-semibold">
                {groups.map((g) => <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className={`min-h-8 rounded-lg px-1 leading-tight transition ${group === g ? "bg-panel text-accent shadow-sm" : "text-muted hover:text-ink"}`}>{g === "Dados que faltam" ? "Faltam" : g}</button>)}
              </div>
              <label className="relative block"><Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Filtrar filas…" aria-label="Filtrar filas" className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm" /></label>
              {group === "Por estado" ? (
                <ul role="radiogroup" aria-label="Estados" className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
                  {ufs.filter(([u]) => !q || u.toLowerCase().includes(q)).map(([u, n]) => <li key={u}><ListChoice compact k={`uf:${u}`} count={n} selected={scope === `uf:${u}`} onPick={() => setScope(`uf:${u}`)} /></li>)}
                  {!ufs.length && <li className="col-span-3 rounded-lg bg-sunk/60 px-3 py-3 text-center text-xs text-muted">Nenhum estado com leads esperando.</li>}
                </ul>
              ) : (
                <ul role="radiogroup" aria-label={group} className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                  {ENRICH_LISTS.filter((l) => l.group === group && (!q || l.label.toLowerCase().includes(q))).map((l) => <li key={l.key}><ListChoice compact k={l.key} count={d.stats.lists?.[l.key] ?? 0} selected={scope === l.key} onPick={() => setScope(l.key)} /></li>)}
                </ul>
              )}
              <p className="rounded-lg bg-sunk/60 px-3 py-2 text-xs text-muted">{listMeta(scope)?.hint}</p>
            </section>
          )}

          {on
            ? <button type="button" disabled={busy} onClick={() => act(stopApi)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-danger/40 bg-danger/10 px-3 py-2 text-sm font-bold text-danger transition hover:bg-danger/20">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Parar consulta</button>
            : <button type="button" disabled={busy || (d.stats.lists?.[scope] ?? 0) === 0} onClick={() => act(() => startApi(scope))} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60" style={{ background: iconTile(listVisual(scope).hex) }}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} {(d.stats.lists?.[scope] ?? 0) === 0 ? "Nada nesta fila" : `Ligar até eu parar · ${nf.format(d.stats.lists?.[scope] ?? 0)}`}</button>}
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted"><Gauge size={12} className="mt-0.5 shrink-0" aria-hidden />Roda em qualquer página. Para sozinha se você ficar offline por mais de {DAEMON_OFFLINE_MIN} min ou quando a fila acabar.</p>

          <section aria-label="Últimas consultas">
            <h3 className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted"><span>Últimas consultas</span><a href="/admin/consulta-cnpj" className="inline-flex items-center gap-1 normal-case tracking-normal text-accent hover:underline"><Zap size={12} aria-hidden /> Painel completo</a></h3>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line" aria-live="polite">
              {d.rows.slice(1).map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 px-3 py-2">
                  {r.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <LeadLink id={r.leadId} className="line-clamp-2 text-[13px] leading-snug">{r.company}</LeadLink>
                    {r.ok ? <p className="mt-1 flex flex-wrap gap-1 text-[11px]"><span className="rounded-full bg-sunk px-2 py-0.5 font-medium">{r.phones} {r.phones === 1 ? "telefone" : "telefones"}</span><span className="rounded-full bg-sunk px-2 py-0.5 font-medium">{r.emails} {r.emails === 1 ? "e-mail" : "e-mails"}</span><StatusChip s={r.status} /></p>
                      : <p className="mt-0.5 text-[11px] text-danger">{r.why ?? "Sem resposta"}</p>}
                  </div>
                  <span className="figure shrink-0 text-[11px] text-muted">{ago(r.at, now)}</span>
                </li>
              ))}
              {d.rows.length <= 1 && <li className="px-3 py-5 text-center text-xs text-muted">{d.rows.length ? "Só a consulta acima por enquanto." : "Nenhuma consulta ainda."}</li>}
            </ul>
          </section>
        </div>
      </div>
      <button type="button" aria-expanded={open} aria-label={open ? "Recolher painel de consulta de CNPJ" : "Abrir painel de consulta de CNPJ"} onClick={() => setOpen(!open)} className="relative -ml-px grid h-28 w-11 place-items-center rounded-r-2xl border-2 border-l-0 border-line bg-panel text-accent shadow-lg hover:bg-sunk">
        {open ? <ChevronLeft size={18} aria-hidden /> : <span className="flex flex-col items-center gap-1"><span className="relative grid place-items-center"><MetricRing value={pct} color="var(--accent)" size="size-9" /><DatabaseZap size={14} className="absolute" aria-hidden /></span><span className="figure text-[10px] font-extrabold">{pct}%</span>{on && <span aria-hidden className="absolute right-1 top-1.5 size-2.5 animate-pulse rounded-full bg-ok ring-2 ring-panel" />}</span>}
      </button>
    </aside>
  );
}

function Link2({ id }: { id: number }) {
  return <a href={`/leads/${id}`} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-panel px-3 text-xs font-bold text-accent shadow-sm ring-1 ring-line transition hover:bg-sunk"><ExternalLink size={13} aria-hidden /> Abrir o lead</a>;
}
