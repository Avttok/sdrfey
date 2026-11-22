"use client";

import { ChevronDown, Flame, MessageSquareQuote, NotebookPen, ScrollText, ShieldCheck, UserRound } from "lucide-react";
import { OUTCOMES, GOALS, SEGMENTS, type ScriptMood } from "@/config/scripts";
import { fmtDateTime } from "@/lib/format";
import type { ScriptRunView } from "@/modules/scripts/runs-query";
import { GOAL_THEME, MOODS, OUTCOME_ICON, tint } from "./script-theme";

const KIND = { ok: { hex: "#22c55e", label: "Bom sinal" }, objecao: { hex: "#f97316", label: "Objeção" }, neutro: { hex: "#64748b", label: "Resposta" } } as const;
const dur = (a: string, b: string) => { const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000); return m < 1 ? "menos de 1 min" : `${m} min`; };

/** No perfil do lead: como foi o andamento do roteiro em cada ligação (o que foi dito, o que o lead respondeu, anotações e resultado). */
export function ScriptRunsPanel({ runs }: { runs: ScriptRunView[] }) {
  if (!runs.length) return null;
  return (
    <section className="rounded-3xl border border-line bg-panel p-4 shadow-sm sm:p-5" aria-label="Roteiros das ligações">
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-grad text-on-accent shadow"><ScrollText size={20} aria-hidden /></span>
        <div className="leading-tight"><h2 className="display text-lg">Roteiros das ligações</h2><p className="text-xs text-muted">Como a conversa andou em cada ligação, passo a passo.</p></div>
        <span className="ml-auto rounded-full bg-sunk px-3 py-1 text-xs font-semibold">{runs.length} {runs.length === 1 ? "ligação" : "ligações"}</span>
      </header>

      <ol className="relative mt-5 space-y-5 border-l-2 border-line pl-5 sm:pl-7">
        {runs.map((r, idx) => {
          const g = GOAL_THEME[r.goal as keyof typeof GOAL_THEME] ?? GOAL_THEME.sdr;
          const out = r.outcome ? OUTCOMES[r.outcome as keyof typeof OUTCOMES] : null; const OutIcon = r.outcome ? OUTCOME_ICON[r.outcome as keyof typeof OUTCOME_ICON] : null;
          const win = r.outcome && r.outcome !== "encerrar";
          const good = r.steps.filter((s) => s.kind === "ok").length; const hurdles = r.steps.filter((s) => s.kind === "objecao").length;
          const state = r.finished ? (out?.label ?? "Concluído") : "Parou no meio";
          return (
            <li key={r.id} className="relative">
              <span aria-hidden className="absolute -left-[1.95rem] top-1 grid size-7 place-items-center rounded-full border-2 border-panel text-white shadow sm:-left-[2.45rem]" style={{ background: g.hex }}><g.Icon size={14} /></span>
              <article className="rounded-2xl border p-3 sm:p-4" style={tint(g.hex, 5, 28)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: g.hex }}>{GOALS[r.goal as keyof typeof GOALS]?.label.split(" (")[0] ?? r.goal}</span>
                  <h3 className="min-w-0 flex-1 truncate text-sm font-bold">{SEGMENTS[r.segment] ?? r.scriptTitle}</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={win ? { ...tint("#22c55e", 18, 45), border: "1px solid" } : { ...tint("#64748b", 14, 35), border: "1px solid" }}>
                    {OutIcon && <OutIcon size={13} aria-hidden />}{state}
                  </span>
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{fmtDateTime(r.startedAt)} · {dur(r.startedAt, r.updatedAt)}</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: r.by.hex }} />{r.by.name}</span>
                  {r.contactName && <span className="inline-flex items-center gap-1"><UserRound size={12} aria-hidden /> Falou com <b className="text-ink">{r.contactName}</b></span>}
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                  <span className="rounded-full bg-sunk px-2.5 py-1">{r.steps.length} etapas</span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={tint("#22c55e", 16, 40)}><Flame size={12} aria-hidden /> {good} bons sinais</span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={tint("#f97316", 16, 40)}><ShieldCheck size={12} aria-hidden /> {hurdles} objeções</span>
                </p>
                {r.notes.length > 0 && <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"><NotebookPen size={13} aria-hidden className="text-muted" />{r.notes.map((n) => <span key={n} className="rounded-full bg-panel px-2 py-0.5 font-medium">{n}</span>)}</p>}

                <details className="group mt-3" open={idx === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-accent"><ChevronDown size={16} aria-hidden className="transition group-open:rotate-180" /> <span className="group-open:hidden">Ver a conversa</span><span className="hidden group-open:inline">Esconder a conversa</span></summary>
                  <ol className="mt-3 space-y-3">
                    {r.steps.map((s, i) => {
                      const m = MOODS[(s.mood as ScriptMood) in MOODS ? (s.mood as ScriptMood) : "apoio"]; const k = s.kind ? KIND[s.kind] : null;
                      return (
                        <li key={`${s.id}-${i}`} className="flex gap-2.5">
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white" style={{ background: m.hex }} title={m.label}><m.Icon size={14} aria-hidden /></span>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-xs font-bold" style={{ color: m.hex }}>{s.title}</p>
                            <p className="flex gap-1.5 text-sm text-muted"><MessageSquareQuote size={14} aria-hidden className="mt-0.5 shrink-0" /><span className="whitespace-pre-line">{s.say}</span></p>
                            {s.answer && k && <p className="ml-4 inline-block max-w-full rounded-2xl rounded-tl-sm border px-3 py-1.5 text-sm font-medium" style={{ ...tint(k.hex, 12, 45) }}><span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: k.hex }}>Lead · {k.label}</span>{s.answer}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
