"use client";

import { Calendar, Check, ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, Layers, Loader2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { previewAction, type Preview } from "@/modules/performance/actions";

type Kind = "sdr" | "vendas";
type Section = { id: string; label: string; hint: string };
type Person = { id: number; name: string };

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
const STEPS = [{ t: "Período", i: Calendar }, { t: "Conteúdo", i: Layers }, { t: "Pessoas", i: Users }, { t: "Prévia", i: Eye }, { t: "Baixar", i: Download }];

export function PerformanceWizard({ kind, sections, people, team }: { kind: Kind; sections: Section[]; people: Person[]; team: boolean }) {
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState("30");
  const [[from, to], setRange] = useState<[string, string]>(() => PRESETS[2].range());
  const [sel, setSel] = useState<string[]>(sections.slice(0, 4).map((s) => s.id));
  const [who, setWho] = useState<number[]>(people.map((p) => p.id));
  const [group, setGroup] = useState("dia");
  const [prev, setPrev] = useState<Preview | null>(null);
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState("");

  const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const valid = [from && to && from <= to, sel.length > 0, who.length > 0, true, true];
  const qs = () => new URLSearchParams({ kind, from, to, sections: sel.join(","), users: who.join(","), group }).toString();
  const load = () => start(async () => setPrev(await previewAction(kind, { from, to, sections: sel, users: who, group })));
  const go = (n: number) => { setStep(n); if (n === 3) load(); };
  const dl = (fmt: "xlsx" | "csv") => { window.location.href = `/api/desempenho?${qs()}&format=${fmt}${fmt === "csv" && sheet ? `&sheet=${sheet}` : ""}`; };

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-5 gap-2" aria-label="Passos">
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

      <section key={step} className="fx-rise rounded-3xl border border-line bg-panel p-5 shadow-xl sm:p-7">
        {step === 0 && (
          <div className="space-y-5">
            <div><h2 className="display text-2xl">Qual período?</h2><p className="text-sm text-muted">Escolha um atalho ou defina as datas.</p></div>
            <div className="stagger flex flex-wrap gap-2">
              {PRESETS.map((p) => <button key={p.id} type="button" onClick={() => { setPreset(p.id); setRange(p.range()); }} className={`rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${preset === p.id ? "border-transparent bg-grad text-on-accent shadow-md" : "border-line bg-bg hover:border-accent/60"}`}>{p.label}</button>)}
            </div>
            <div className="grid max-w-md grid-cols-2 gap-3">
              <label className="text-sm font-semibold">De<input type="date" value={from} onChange={(e) => { setPreset("custom"); setRange([e.target.value, to]); }} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 font-normal" /></label>
              <label className="text-sm font-semibold">Até<input type="date" value={to} onChange={(e) => { setPreset("custom"); setRange([from, e.target.value]); }} className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2.5 font-normal" /></label>
            </div>
            {from > to && <p className="text-sm font-semibold text-red-500">A data inicial não pode ser depois da final.</p>}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <div><h2 className="display text-2xl">O que vai na planilha?</h2><p className="text-sm text-muted">Cada item vira uma aba. Todas já saem com cores, filtros e formatação.</p></div>
            <div className="stagger grid gap-2.5 sm:grid-cols-2">
              {sections.filter((s) => s.id !== "pessoas" || team).map((s) => { const on = sel.includes(s.id); return (
                <button key={s.id} type="button" onClick={() => setSel(toggle(sel, s.id))} aria-pressed={on} className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 ${on ? "border-accent bg-grad-soft shadow-md" : "border-line bg-bg"}`}>
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border ${on ? "border-transparent bg-grad text-on-accent" : "border-line"}`}>{on && <Check size={14} aria-hidden />}</span>
                  <span><span className="block font-semibold">{s.label}</span><span className="text-xs text-muted">{s.hint}</span></span>
                </button>); })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">Agrupar a evolução por:</span>
              {[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]].map(([id, l]) => <button key={id} type="button" onClick={() => setGroup(id)} className={`rounded-full border px-3.5 py-1.5 font-semibold transition ${group === id ? "border-transparent bg-grad text-on-accent" : "border-line"}`}>{l}</button>)}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div><h2 className="display text-2xl">De quem?</h2><p className="text-sm text-muted">{team ? "Marque as pessoas que entram nos números." : "Você vê somente os seus números."}</p></div>
            <div className="stagger flex flex-wrap gap-2">
              {people.map((p) => { const on = who.includes(p.id); return <button key={p.id} type="button" disabled={!team} onClick={() => setWho(toggle(who, p.id))} aria-pressed={on} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? "border-transparent bg-grad text-on-accent shadow-md" : "border-line bg-bg"}`}>{on && <Check size={14} aria-hidden />}{p.name}</button>; })}
            </div>
            {team && <div className="flex gap-3 text-sm"><button type="button" className="font-semibold text-accent" onClick={() => setWho(people.map((p) => p.id))}>Todos</button><button type="button" className="font-semibold text-muted" onClick={() => setWho([])}>Nenhum</button></div>}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div><h2 className="display text-2xl">Confira antes de baixar</h2><p className="text-sm text-muted">Uma amostra do que vai na planilha.</p></div>
            {pending || !prev ? <p className="flex items-center gap-2 py-8 text-muted"><Loader2 className="animate-spin" size={18} aria-hidden /> Montando a prévia…</p>
              : prev.error ? <p className="font-semibold text-red-500">{prev.error}</p> : (
                <>
                  <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {prev.summary?.slice(0, 8).map((m) => <div key={m.label} className="lift rounded-2xl border border-line bg-bg p-3"><div className="text-xs text-muted">{m.label}</div><div className="display text-2xl text-accent">{m.value}</div></div>)}
                  </div>
                  {prev.sheets?.map((s) => (
                    <div key={s.id} className="overflow-hidden rounded-2xl border border-line">
                      <div className="flex items-center justify-between bg-grad-soft px-3.5 py-2 text-sm font-semibold"><span>{s.name}</span><span className="text-xs text-muted">{s.total} linha{s.total === 1 ? "" : "s"}</span></div>
                      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{s.cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-1.5 text-left text-muted">{c}</th>)}</tr></thead><tbody>{s.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{v}</td>)}</tr>)}{!s.rows.length && <tr><td className="px-3 py-3 text-muted" colSpan={s.cols.length}>Sem dados neste período.</td></tr>}</tbody></table></div>
                    </div>
                  ))}
                </>
              )}
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-grad text-on-accent shadow-xl step-ping"><FileSpreadsheet size={32} aria-hidden /></span>
            <div><h2 className="display text-2xl">Tudo pronto!</h2><p className="text-sm text-muted">{from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")} · {sel.length} aba{sel.length === 1 ? "" : "s"} · {who.length} pessoa{who.length === 1 ? "" : "s"}</p></div>
            <button type="button" onClick={() => dl("xlsx")} className="inline-flex items-center gap-2 rounded-2xl bg-grad px-7 py-3.5 text-lg font-bold text-on-accent shadow-xl transition hover:-translate-y-0.5"><Download size={20} aria-hidden /> Baixar planilha (.xlsx)</button>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span>ou só uma aba em CSV:</span>
              <select value={sheet} onChange={(e) => setSheet(e.target.value)} className="rounded-xl border border-line bg-bg px-3 py-2">{sel.map((id) => <option key={id} value={id}>{sections.find((s) => s.id === id)?.label ?? id}</option>)}</select>
              <button type="button" onClick={() => dl("csv")} className="rounded-xl border border-line px-4 py-2 font-semibold text-fg transition hover:border-accent/60">Baixar CSV</button>
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <button type="button" disabled={step === 0} onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 rounded-2xl border border-line px-5 py-2.5 font-semibold transition hover:border-accent/60 disabled:opacity-40"><ChevronLeft size={18} aria-hidden /> Voltar</button>
        {step < 4 && <button type="button" disabled={!valid[step]} onClick={() => go(step + 1)} className="inline-flex items-center gap-1.5 rounded-2xl bg-grad px-6 py-2.5 font-bold text-on-accent shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40">{step === 2 ? "Ver prévia" : "Continuar"} <ChevronRight size={18} aria-hidden /></button>}
      </div>
    </div>
  );
}
