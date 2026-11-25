"use client";

import { CheckCircle2, Clock3, Loader2, Pause, Play, Plug, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { EOX_LISTS } from "@/config/eox-lists";
import type { EoxDock } from "@/modules/eox/consult-daemon";
import { EOX_STATE, askEox, eoxStartApi, eoxStopApi, setEox } from "../eox-api";
import { EOX_HEX, EoxChoice, EoxIcon, EoxResult, LeadLink, eoxVisual } from "../eox-parts";
import { Panel, StatRow } from "../theme-kit";
import { iconTile } from "../enrich-visual";

const nf = new Intl.NumberFormat("pt-BR");
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

/** Tela do Adm da Consulta EOX. Quem roda a consulta é o painel lateral (que vive no layout); aqui se escolhe a fila e se acompanha. */
export function EoxConsultAdmin({ initial, ready }: { initial: EoxDock; ready: boolean }) {
  const [d, setD] = useState(initial);
  const [scope, setScope] = useState("new");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setD((e as CustomEvent<EoxDock>).detail);
    window.addEventListener(EOX_STATE, on); askEox();
    return () => window.removeEventListener(EOX_STATE, on);
  }, []);
  const act = async (fn: () => Promise<EoxDock>) => { setBusy(true); try { const r = await fn(); setD(r); setEox(r); askEox(); } finally { setBusy(false); } };
  const { stats, state } = d;
  const cur = eoxVisual(state.on ? state.scope : scope);
  const left = stats.lists?.[state.on ? state.scope : scope] ?? 0;

  return (
    <div className="space-y-5">
      {!ready && <p className="flex items-start gap-2 rounded-2xl border-2 border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />A integração com a EOX está desligada ou incompleta. Ligue e preencha em <a className="font-semibold underline" href="/admin/eox">Admin → Integração com a EOX</a> (endereço, usuário, chave e o campo do CNPJ).</p>}
      <StatRow stats={[
        { icon: CheckCircle2, label: "Consultados", value: stats.done, hint: `${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}% da base`, hex: "#22c55e" },
        { icon: Clock3, label: "Esperando", value: stats.pending, hex: EOX_HEX },
        { icon: XCircle, label: "Sem resposta", value: stats.failed, hint: "tenta de novo em 6 h", hex: "#ef4444" },
        { icon: Plug, label: "Ritmo", value: `${d.rate.perMin.toLocaleString("pt-BR")}/min`, hint: d.rate.okPct != null ? `${d.rate.okPct}% deram certo` : "parada", hex: "#0ea5e9" },
      ]} />

      <Panel icon={Plug} title="Qual fila consultar" hint="A consulta só preenche o que está vazio: nada do que a equipe digitou é trocado." hex={EOX_HEX}>
        {state.stoppedWhy && <p className="mb-3 flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn"><TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />{state.stoppedWhy}</p>}
        <ul role="radiogroup" aria-label="Filas" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {EOX_LISTS.map((l) => <li key={l.key}><EoxChoice k={l.key} count={stats.lists?.[l.key] ?? 0} selected={(state.on ? state.scope : scope) === l.key} onPick={() => !state.on && setScope(l.key)} /></li>)}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {state.on
            ? <button type="button" disabled={busy} onClick={() => act(eoxStopApi)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-danger/40 bg-danger/10 px-5 text-sm font-bold text-danger transition hover:bg-danger/20 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Parar consulta</button>
            : <button type="button" disabled={busy || !ready || left === 0} onClick={() => act(() => eoxStartApi(scope))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50" style={{ background: iconTile(cur.hex) }}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Iniciar: {cur.label}</button>}
          <p className="text-sm text-muted">{state.on ? <>Rodando no navegador de <b className="text-ink">{state.byName ?? "—"}</b> · restam {nf.format(left)}.</> : cur.hint}</p>
        </div>
      </Panel>

      <Panel icon={Clock3} title="Últimas consultas" hint="O que a EOX trouxe de novo para cada lead." hex="#0ea5e9">
        <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line bg-panel/60">
          {d.rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
              <EoxIcon ok={r.ok} />
              <div className="min-w-0 flex-1"><LeadLink id={r.leadId} className="text-sm">{r.company}</LeadLink><EoxResult r={r} /></div>
              <span className="figure shrink-0 text-right text-[11px] text-muted">{when(r.at)}<br />{r.by ?? "automático"} · {(r.ms / 1000).toFixed(1).replace(".", ",")} s</span>
            </li>
          ))}
          {!d.rows.length && <li className="px-4 py-8 text-center text-sm text-muted">Nenhuma consulta ainda.</li>}
        </ul>
      </Panel>
    </div>
  );
}
