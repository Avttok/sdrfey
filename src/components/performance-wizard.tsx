"use client";

import { useBusyWhile } from "@/components/toast";
import { Calendar, Check, Phone, MessageCircle, Mail, TrendingUp, Clock, MapPin, ListChecks, BarChart3, Handshake, Receipt, Footprints, Target, ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, Layers, Loader2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { HScroll } from "@/components/h-scroll";
import { MetricCard } from "@/components/dash-ui";
import { previewAction, type Preview } from "@/modules/performance/actions";

type Kind = "sdr" | "vendas";
type Section = { id: string; label: string; hint: string };
type Person = { id: number; name: string };

/** Cada aba tem sua cor e ícone, no mesmo estilo dos cartões de objetivo do roteiro. */
const SEC_STYLE: Record<string, { I: typeof Phone; hex: string }> = {
  resumo: { I: Target, hex: "#6366f1" }, diario: { I: TrendingUp, hex: "#0ea5e9" }, horas: { I: Clock, hex: "#f59e0b" }, meios: { I: BarChart3, hex: "#8b5cf6" },
  contatos: { I: Phone, hex: "#10b981" }, atendimentos: { I: ListChecks, hex: "#14b8a6" }, visitas: { I: Footprints, hex: "#f97316" }, ufs: { I: MapPin, hex: "#ec4899" },
  resultados: { I: Check, hex: "#22c55e" }, semana: { I: Calendar, hex: "#06b6d4" }, pessoas: { I: Users, hex: "#a855f7" }, funil: { I: Layers, hex: "#3b82f6" },
  negociacoes: { I: Handshake, hex: "#16a34a" }, cotacoes: { I: Receipt, hex: "#eab308" }, origem: { I: MessageCircle, hex: "#d946ef" },
};
const secStyle = (id: string) => SEC_STYLE[id] ?? { I: Mail, hex: "#6366f1" };
const tint = (hex: string, a: number, b: number) => `linear-gradient(145deg, color-mix(in srgb, ${hex} ${a}%, var(--panel)), color-mix(in srgb, ${hex} ${b}%, var(--panel)) 70%)`;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  { id: "hoje", label: "Hoje", range: () => { const t = new Date(); return [iso(t), iso(t)]; } },
  { id: "7", label: "Últimos 7 dias", range: () => { const t = new Date(), s = new Date(); s.setDate(t.getDate() - 6); return [iso(s), iso(t)]; } },
  { id: "30", label: "Últimos 30 dias", range: () => { const t = new Date(), s = new Date(); s.setDate(t.getDate() - 29); return [iso(s), iso(t)]; } },
  { id: "mes", label: "Este mês", range: () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)]; } },
  { id: "mesp", label: "Mês passado", range: () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))]; } },
  { id: "tri", label: "Últimos 90 dias", range: () => { const t = new Date(), s = new Date(); s.setDate(t.getDate() - 89); return [iso(s), iso(t)]; } },
  { id: "ano", label: "Este ano", range: () => { const t = new Date(); return [iso(new Date(t.getFullYear(), 0, 1)), iso(t)]; } },
];
const ALL_STEPS = [{ id: "periodo", t: "Período", i: Calendar }, { id: "conteudo", t: "Conteúdo", i: Layers }, { id: "pessoas", t: "Pessoas", i: Users }, { id: "previa", t: "Prévia", i: Eye }, { id: "baixar", t: "Baixar", i: Download }] as const;

export function PerformanceWizard({ kind, sections, people, team }: { kind: Kind; sections: Section[]; people: Person[]; team: boolean }) {
  /* Só gestor escolhe pessoas: para os demais o relatório é só deles, então esse passo não existe. */
  const STEPS = ALL_STEPS.filter((s) => s.id !== "pessoas" || team);
  const [step, setStep] = useState(0);
  const cur_ = STEPS[step].id;
  const [preset, setPreset] = useState("30");
  const [[from, to], setRange] = useState<[string, string]>(() => PRESETS[2].range());
  const [sel, setSel] = useState<string[]>(sections.slice(0, 4).map((s) => s.id));
  const [ready, setReady] = useState(false);
  const [who, setWho] = useState<number[]>(people.map((p) => p.id));
  const [group, setGroup] = useState("dia");
  const [prev, setPrev] = useState<Preview | null>(null);
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const [sheet, setSheet] = useState("");

  const fmtD = (v: string) => v.split("-").reverse().join("/");
  const days = from && to && from <= to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0;
  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const validOf: Record<string, boolean> = { periodo: !!(from && to && from <= to), conteudo: sel.length > 0, pessoas: who.length > 0, previa: ready && !pending, baixar: true };
  const valid = STEPS.map((s) => validOf[s.id]);
  const qs = () => new URLSearchParams({ kind, from, to, sections: sel.join(","), users: who.join(","), group }).toString();
  const load = () => { setReady(false); setPrev(null); start(async () => { setPrev(await previewAction(kind, { from, to, sections: sel, users: who, group })); setReady(true); }); };
  const go = (n: number) => { setStep(n); if (STEPS[n].id === "previa") load(); else if (STEPS[n].id !== "baixar") setReady(false); };
  const dl = (fmt: "xlsx" | "csv" | "pdf") => { window.location.href = `/api/desempenho?${qs()}&format=${fmt}${fmt === "csv" && sheet ? `&sheet=${sheet}` : ""}`; };

  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      <ol className={`grid gap-2 ${STEPS.length === 4 ? "grid-cols-[repeat(4,minmax(0,1fr))]" : "grid-cols-[repeat(5,minmax(0,1fr))]"}`} aria-label="Passos">
        {STEPS.map((s, i) => {
          const done = i < step, cur = i === step;
          return (
            <li key={s.t}>
              <button type="button" disabled={i > step && !valid.slice(0, i).every(Boolean)} onClick={() => go(i)} className={`group relative flex w-full flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition ${cur ? "border-accent bg-grad-soft text-accent shadow-lg" : done ? "border-accent/40 text-accent" : "border-line text-muted"} disabled:opacity-40`}>
                <span className={`grid size-9 place-items-center rounded-xl transition ${cur ? "bg-grad text-on-accent step-ping" : done ? "bg-accent/15" : "bg-panel"}`}>{done ? <Check size={18} aria-hidden /> : <s.i size={18} aria-hidden />}</span>
                <span className="hidden sm:block">{s.t}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={cur_ === "periodo" || cur_ === "conteudo" || cur_ === "pessoas" ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]" : "min-w-0 max-w-full"}>
      <section key={step} className="fx-rise min-h-[26rem] min-w-0 max-w-full rounded-3xl border border-line bg-panel p-5 shadow-xl sm:p-8">
        {cur_ === "periodo" && (
          <div className="space-y-5">
            <div><h2 className="display text-2xl">Qual período?</h2><p className="text-sm text-muted">Escolha um atalho ou defina as datas.</p></div>
            <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {PRESETS.map((p) => { const [f, t] = p.range(); const on = preset === p.id; return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => { setPreset(p.id); setRange([f, t]); }} className={`flex flex-col items-start gap-0.5 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 ${on ? "border-transparent bg-grad text-on-accent shadow-lg" : "border-line bg-bg hover:border-accent/60"}`}>
                  <span className="font-semibold">{p.label}</span><span className={`figure text-xs ${on ? "opacity-90" : "text-muted"}`}>{fmtD(f)}{f === t ? "" : ` – ${fmtD(t)}`}</span>
                </button>); })}
            </div>
            <div className="grid max-w-2xl grid-cols-2 gap-3">
              <label className="text-sm font-semibold">De<input type="date" value={from} onChange={(e) => { setPreset("custom"); setRange([e.target.value, to]); }} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 font-normal" /></label>
              <label className="text-sm font-semibold">Até<input type="date" value={to} onChange={(e) => { setPreset("custom"); setRange([from, e.target.value]); }} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 font-normal" /></label>
            </div>
            {from > to && <p className="text-sm font-semibold text-red-500">A data inicial não pode ser depois da final.</p>}
          </div>
        )}
        {cur_ === "conteudo" && (
          <div className="space-y-5">
            <div><h2 className="display text-2xl">O que vai na planilha?</h2><p className="text-sm text-muted">Cada item vira uma aba. Todas já saem com cores, filtros e formatação.</p></div>
            <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sections.filter((s) => s.id !== "pessoas" || team).map((s) => { const on = sel.includes(s.id); const { I, hex } = secStyle(s.id); return (
                <button key={s.id} type="button" onClick={() => setSel(toggle(sel, s.id))} aria-pressed={on} style={{ background: on ? tint(hex, 22, 6) : undefined, borderColor: on ? `color-mix(in srgb, ${hex} 60%, transparent)` : undefined }} className={`group relative flex items-start gap-3 overflow-hidden rounded-2xl border-2 p-3.5 text-left transition hover:-translate-y-0.5 ${on ? "shadow-md" : "border-line bg-bg opacity-80 hover:opacity-100"}`}>
                  <I aria-hidden size={72} strokeWidth={1.4} className="pointer-events-none absolute -bottom-3 -right-2 -rotate-12 opacity-[.12]" style={{ color: hex }} />
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-xl text-white shadow" style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))` }}><I size={20} aria-hidden /></span>
                  <span className="relative min-w-0 flex-1"><span className="block font-bold leading-tight">{s.label}</span><span className="text-xs text-muted">{s.hint}</span></span>
                  <span className={`relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-transparent text-white" : "border-line"}`} style={on ? { background: hex } : undefined}>{on && <Check size={14} aria-hidden />}</span>
                </button>); })}
            </div>
            <div className="flex gap-3 text-sm"><button type="button" className="font-semibold text-accent" onClick={() => setSel(sections.filter((x) => x.id !== "pessoas" || team).map((x) => x.id))}>Marcar todos</button><button type="button" className="font-semibold text-muted" onClick={() => setSel([])}>Limpar</button><span className="text-muted">{sel.length} de {sections.filter((x) => x.id !== "pessoas" || team).length} abas</span></div>
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">Agrupar a evolução por:</span>
              {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([id, l]) => <button key={id} type="button" onClick={() => setGroup(id)} className={`rounded-full border px-3.5 py-1.5 font-semibold transition ${group === id ? "border-transparent bg-grad text-on-accent" : "border-line"}`}>{l}</button>)}
            </div>
          </div>
        )}
        {cur_ === "pessoas" && (
          <div className="space-y-4">
            <div><h2 className="display text-2xl">De quem?</h2><p className="text-sm text-muted">{team ? "Marque as pessoas que entram nos números." : "Você vê somente os seus números."}</p></div>
            <div className="stagger grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((p) => { const on = who.includes(p.id); return <button key={p.id} type="button" disabled={!team} onClick={() => setWho(toggle(who, p.id))} aria-pressed={on} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? "border-transparent bg-grad text-on-accent shadow-md" : "border-line bg-bg"}`}>{on && <Check size={14} aria-hidden />}{p.name}</button>; })}
            </div>
            {team && <div className="flex gap-3 text-sm"><button type="button" className="font-semibold text-accent" onClick={() => setWho(people.map((p) => p.id))}>Todos</button><button type="button" className="font-semibold text-muted" onClick={() => setWho([])}>Nenhum</button></div>}
          </div>
        )}
        {cur_ === "previa" && (
          <div className="space-y-4">
            <div><h2 className="display text-2xl">Confira antes de baixar</h2><p className="text-sm text-muted">Uma amostra do que vai na planilha.</p></div>
            {pending || !prev ? <p className="flex items-center gap-2 py-8 text-muted"><Loader2 className="animate-spin" size={18} aria-hidden /> Montando a prévia…</p>
              : prev.error ? <p className="font-semibold text-red-500">{prev.error}</p> : (
                <>
                  <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))]">
                    {prev.summary?.slice(0, 6).map((m, i) => <MetricCard key={m.label} i={i} I={[Target, TrendingUp, BarChart3, Phone, Handshake, Clock][i % 6]} t={m.label} v={m.value} s={m.hint} hex={["#6366f1", "#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6"][i % 6]} featured={i === 0} />)}
                  </div>
                  {prev.sheets?.map((s) => (
                    <div key={s.id} className="min-w-0 max-w-full overflow-hidden rounded-2xl border-2" style={{ borderColor: `color-mix(in srgb, ${secStyle(s.id).hex} 45%, transparent)` }}>
                      <div className="flex items-center justify-between px-3.5 py-2 text-sm font-bold" style={{ background: tint(secStyle(s.id).hex, 22, 6) }}><span className="inline-flex items-center gap-2"><span className="grid size-6 place-items-center rounded-lg text-white" style={{ background: secStyle(s.id).hex }}>{(() => { const I = secStyle(s.id).I; return <I size={14} aria-hidden />; })()}</span>{s.name}</span><span className="text-xs font-medium text-muted">{s.total} linha{s.total === 1 ? "" : "s"}</span></div>
                      <HScroll><table className="w-full min-w-max text-sm"><thead><tr>{s.cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2 text-left text-muted">{c}</th>)}</tr></thead><tbody>{s.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((v, j) => <td key={j} className="whitespace-nowrap px-4 py-2">{v}</td>)}</tr>)}{!s.rows.length && <tr><td className="px-3 py-3 text-muted" colSpan={s.cols.length}>Sem dados neste período.</td></tr>}</tbody></table></HScroll>
                    </div>
                  ))}
                </>
              )}
          </div>
        )}
        {cur_ === "baixar" && (
          <div className="space-y-5 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-grad text-on-accent shadow-xl step-ping"><FileSpreadsheet size={32} aria-hidden /></span>
            <div><h2 className="display text-2xl">Tudo pronto!</h2><p className="text-sm text-muted">{from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")} · {sel.length} aba{sel.length === 1 ? "" : "s"} · {who.length} pessoa{who.length === 1 ? "" : "s"}</p></div>
            <button type="button" onClick={() => dl("xlsx")} className="inline-flex items-center gap-2 rounded-2xl bg-grad px-7 py-3.5 text-lg font-bold text-on-accent shadow-xl transition hover:-translate-y-0.5"><Download size={20} aria-hidden /> Baixar planilha (.xlsx)</button>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted"><span>ou todas as abas em</span><button type="button" onClick={() => dl("pdf")} className="rounded-xl border border-line px-4 py-2 font-semibold text-fg transition hover:border-accent/60">Baixar PDF</button></div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span>ou só uma aba em CSV:</span>
              <select value={sheet} onChange={(e) => setSheet(e.target.value)} className="rounded-xl border border-line bg-bg px-3 py-2">{sel.map((id) => <option key={id} value={id}>{sections.find((s) => s.id === id)?.label ?? id}</option>)}</select>
              <button type="button" onClick={() => dl("csv")} className="rounded-xl border border-line px-4 py-2 font-semibold text-fg transition hover:border-accent/60">Baixar CSV</button>
            </div>
          </div>
        )}
      </section>
      {(cur_ === "periodo" || cur_ === "conteudo" || cur_ === "pessoas") && (
        <aside aria-label="Resumo do relatório" className="fx-rise space-y-3 rounded-3xl border border-line bg-grad-soft p-5 shadow-lg lg:sticky lg:top-4">
          <h3 className="display text-lg">Seu relatório</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="rounded-xl bg-panel/80 p-3"><dt className="text-xs text-muted">Período</dt><dd className="figure font-semibold">{fmtD(from)} a {fmtD(to)}</dd><dd className="text-xs text-muted">{days ? `${days} dia${days === 1 ? "" : "s"}` : "datas inválidas"}</dd></div>
            <div className="rounded-xl bg-panel/80 p-3"><dt className="text-xs text-muted">Abas ({sel.length})</dt><dd className="mt-1 flex flex-wrap gap-1.5">{sel.length ? sel.map((id) => <span key={id} className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs font-medium">{sections.find((x) => x.id === id)?.label ?? id}</span>) : <span className="text-xs text-muted">Nenhuma aba marcada</span>}</dd><dd className="mt-1.5 text-xs text-muted">Evolução por {group === "dia" ? "dia" : group === "semana" ? "semana" : "mês"}</dd></div>
            <div className="rounded-xl bg-panel/80 p-3"><dt className="text-xs text-muted">Pessoas</dt><dd className="font-semibold">{team ? `${who.length} de ${people.length}` : "Somente você"}</dd></div>
          </dl>
          <p className="text-xs text-muted">Depois você confere uma prévia e baixa em Excel (.xlsx), CSV ou PDF.</p>
        </aside>
      )}
      </div>

      <div className="flex justify-between">
        <button type="button" disabled={step === 0} onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 rounded-2xl border border-line px-5 py-2.5 font-semibold transition hover:border-accent/60 disabled:opacity-40"><ChevronLeft size={18} aria-hidden /> Voltar</button>
        {cur_ !== "baixar" && <button type="button" disabled={!valid[step]} onClick={() => go(step + 1)} className="inline-flex items-center gap-1.5 rounded-2xl bg-grad px-6 py-2.5 font-bold text-on-accent shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40">{cur_ === "previa" && pending ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Montando a prévia…</> : STEPS[step + 1]?.id === "previa" ? "Ver prévia" : "Continuar"} {!(cur_ === "previa" && pending) && <ChevronRight size={18} aria-hidden />}</button>}
      </div>
    </div>
  );
}
