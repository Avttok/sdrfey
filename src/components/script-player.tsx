"use client";

import { ArrowLeft, Crosshair, Ear, Flame, Lightbulb, Mic, RotateCcw, ShieldAlert, NotebookPen, ShieldCheck, Sparkles, ThumbsUp, ChevronRight, Trophy, Volume2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fillScript, sayOf, shortCompany, KIND_LABEL, moodOf, postureOf, OUTCOMES, TONE_KEYS, TONES, type ScriptDoc, type ScriptKind, type ScriptTone } from "@/config/scripts";
import { btnGhost } from "@/components/ui";
import { HScroll } from "./h-scroll";
import { GOAL_THEME, MOODS, OUTCOME_ICON, SEGMENT_ICON, tint } from "./script-theme";

/** Retrato do andamento do roteiro: o que foi dito, o que o lead respondeu, as anotações e como terminou. */
export type ScriptRun = { runId: string; scriptId: number; scriptTitle: string; goal: string; segment: string; contactName: string | null; steps: { id: string; title: string; mood: string; say: string; answer: string | null; kind: ScriptKind | null }[]; notes: string[]; outcome: string | null; finished: boolean };
export type ScriptVars = { empresa?: string | null; /** nome da pessoa com quem se fala (contato do telefone), se houver */ contatoCompleto?: string | null; contato?: string | null; cidade?: string | null; meunome?: string | null };

const KIND: Record<ScriptKind, { hex: string; Icon: typeof ThumbsUp; hint: string }> = {
  ok: { hex: "#22c55e", Icon: ThumbsUp, hint: "Bom sinal" },
  objecao: { hex: "#f97316", Icon: ShieldAlert, hint: "Objeção" },
  neutro: { hex: "#64748b", Icon: ChevronRight, hint: "Segue a conversa" },
};
const CONFETTI = ["#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6", "#f43f5e"];

/**
 * O roteiro da ligação. O balão mostra EXATAMENTE o que você diz ao lead (com o nome dele já no lugar);
 * a dica é só para você (não se fala). Depois toque no que o lead respondeu e o roteiro avança.
 */
export function ScriptPlayer({ script, vars, extra, onOutcome, onNote, onRun, endExtra, floatingCenter = false }: { /** painel no fim da ligação (ex.: as tarefas que ela gerou); recebe o código da ligação */ endExtra?: (ctx: { runId: string }) => React.ReactNode; /** botão flutuante "Centralizar" acima do chat (só nas etapas dos shufflers) */ floatingCenter?: boolean; script: ScriptDoc; vars: ScriptVars; /** painel extra no passo atual (ex.: o campo do nome de quem fala); recebe `pick` para escolher uma resposta */ extra?: (nodeId: string, pick: (i: number) => void) => React.ReactNode; onOutcome?: (o: NonNullable<ScriptDoc["nodes"][number]["outcome"]>) => void; /** chamado com a anotação sugerida quando o operador escolhe uma resposta que tem nota */ onNote?: (note: string) => void; /** chamado a cada resposta escolhida, com o retrato do andamento (para guardar no lead) */ onRun?: (run: ScriptRun) => void }) {
  const by = useMemo(() => new Map(script.nodes.map((n) => [n.id, n])), [script]);
  const [trail, setTrail] = useState<{ id: string; kind?: ScriptKind; via?: string }[]>([{ id: script.startId }]);
  useEffect(() => setTrail([{ id: script.startId }]), [script.id, script.startId]);
  const node = by.get(trail[trail.length - 1].id) ?? script.nodes[0];
  const ended = node.type === "fim";
  useEffect(() => { if (ended && node.outcome) onOutcome?.(node.outcome); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [node.id]);
  const steps = trail.length - 1;
  const good = trail.filter((t) => t.kind === "ok").length;
  const hurdles = trail.filter((t) => t.kind === "objecao").length;
  const mood = MOODS[moodOf(node)];
  const goal = GOAL_THEME[script.goal];
  const Seg = SEGMENT_ICON[script.segment] ?? Sparkles;

  const [tone, setToneState] = useState<ScriptTone>("normal");
  useEffect(() => { try { const t = localStorage.getItem("script_tone"); if (t === "formal" || t === "solto" || t === "normal") setToneState(t); } catch { /* sem armazenamento */ } }, []);
  const setTone = (t: ScriptTone) => { setToneState(t); try { localStorage.setItem("script_tone", t); } catch { /* sem armazenamento */ } };
  const [noted, setNoted] = useState<string[]>([]);
  const [runId, setRunId] = useState(() => crypto.randomUUID());
  useEffect(() => { setNoted([]); setRunId(crypto.randomUUID()); }, [script.id, script.startId]);
  const restart = () => { setTrail([{ id: script.startId }]); setNoted([]); setRunId(crypto.randomUUID()); };
  useEffect(() => {
    if (!onRun || trail.length < 2) return;
    const steps = trail.map((t, i) => { const n = by.get(t.id); return { id: t.id, title: n?.title ?? t.id, mood: n ? moodOf(n) : "apoio", say: n ? fillScript(sayOf(n, tone), vars) : "", answer: trail[i + 1]?.via ?? null, kind: trail[i + 1]?.kind ?? null }; });
    const last = by.get(trail[trail.length - 1].id);
    onRun({ runId, scriptId: script.id, scriptTitle: script.title, goal: script.goal, segment: script.segment, contactName: vars.contatoCompleto ?? null, steps, notes: noted, outcome: last?.type === "fim" ? last.outcome ?? null : null, finished: last?.type === "fim" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail, noted, runId, tone]);
  const pick = useCallback((i: number) => {
    const op = node.options[i];
    if (!op?.to || !by.has(op.to)) return;
    if (op.note) { onNote?.(op.note); setNoted((l) => (l.includes(op.note!) ? l : [...l, op.note!])); }
    setTrail((t) => [...t, { id: op.to!, kind: op.kind, via: op.label }]);
  }, [node, by, onNote]);

  const root = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(false);
  useEffect(() => { try { setFollow(localStorage.getItem("script_follow") === "1"); } catch { /* sem armazenamento */ } }, []);
  /** Leva o roteiro para o meio da tela, para acompanhar a ligação sem ajustar a rolagem. */
  const center = useCallback(() => { root.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, []);
  const toggleFollow = () => { const v = !follow; setFollow(v); try { localStorage.setItem("script_follow", v ? "1" : "0"); } catch { /* sem armazenamento */ } if (v) center(); };
  useEffect(() => { if (follow) center(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [trail.length, follow]);
  useEffect(() => {
    if (ended) return;
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) pick(n - 1);
      if (e.key === "c" || e.key === "C") center();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [ended, pick, center]);

  const success = ended && node.outcome && node.outcome !== "encerrar";
  const OutIcon = node.outcome ? OUTCOME_ICON[node.outcome] : Trophy;

  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("quick-slot")), []);
  return (
    <div ref={root} className="space-y-4">
      {floatingCenter && !ended && host && createPortal(
        <button type="button" onClick={center} aria-label="Centralizar o roteiro na tela (atalho: C)" title="Leva o roteiro para o meio da tela (atalho: C)"
          className="relative inline-flex h-12 items-center gap-2 rounded-full border border-line bg-panel pl-3.5 pr-4 text-sm font-semibold text-accent shadow-xl transition hover:scale-105 hover:border-accent active:scale-95">
          <Crosshair size={20} aria-hidden /><span className="max-sm:sr-only">Centralizar</span>
          {follow && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-accent ring-2 ring-panel" title="Seguindo sozinho" />}
        </button>, host)}
      {/* Quem é o lead: nome completo bem pequeno, nome falado em destaque */}
      {vars.empresa && (
        <div className="flex flex-wrap items-end justify-between lg:hidden gap-x-4 gap-y-1 px-1">
          <div className="min-w-0 leading-tight">
            {shortCompany(vars.empresa) !== vars.empresa.trim() && <p className="truncate text-[10px] uppercase tracking-wide text-muted">{vars.empresa}</p>}
            <p className="truncate text-lg font-extrabold">{shortCompany(vars.empresa)}</p>
          </div>
          {vars.contatoCompleto && <p className="text-xs text-muted">Falando com <b className="text-ink">{vars.contatoCompleto}</b></p>}
        </div>
      )}
      {/* Objetivo + placar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 lg:py-1.5" style={tint(goal.hex, 10, 35)}>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow lg:size-8" style={{ background: goal.hex }}><goal.Icon size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: goal.hex }}>Objetivo · {goal.short}</p>
          <p className="truncate text-sm font-semibold lg:hidden xl:block">{goal.mission}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {vars.contatoCompleto && <span className="hidden items-center gap-1 rounded-full bg-sunk px-2.5 py-1 lg:inline-flex" title="Com quem você fala"><Mic size={13} aria-hidden /> Falando com <b>{vars.contatoCompleto}</b></span>}
          <button type="button" onClick={center} title="Leva o roteiro para o meio da tela (atalho: C)" className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-1 transition hover:border-accent hover:text-accent"><Crosshair size={13} aria-hidden /> Centralizar</button>
          <button type="button" role="switch" aria-checked={follow} onClick={toggleFollow} title="Centraliza sozinho a cada passo do roteiro" className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition ${follow ? "border-accent bg-grad-soft text-accent" : "border-line bg-panel text-muted hover:text-ink"}`}>{follow ? "Seguindo" : "Seguir"}</button>
          <span className="inline-flex items-center gap-1 rounded-full bg-sunk px-2.5 py-1" title="Etapa da conversa"><Seg size={13} aria-hidden /> Etapa {trail.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ ...tint("#22c55e", 16, 40), border: "1px solid" }} title="Bons sinais do lead"><Flame size={13} aria-hidden style={{ color: "#16a34a" }} /> {good}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1" style={{ ...tint("#f97316", 16, 40), border: "1px solid" }} title="Objeções enfrentadas"><ShieldCheck size={13} aria-hidden style={{ color: "#ea580c" }} /> {hurdles}</span>
        </div>
      </div>

      {/* Mapa do caminho (toque numa etapa para voltar a ela) */}
      <HScroll className="flex items-center gap-1 px-2 py-1" label="Caminho percorrido">
        {trail.map((t, i) => {
          const n = by.get(t.id); const m = MOODS[n ? moodOf(n) : "apoio"]; const last = i === trail.length - 1;
          return (
            <div key={`${t.id}-${i}`} className="flex items-center gap-1">
              <button type="button" disabled={last} onClick={() => setTrail((x) => x.slice(0, i + 1))} title={`${m.label}: ${n?.title ?? t.id}`} aria-label={`Voltar para ${n?.title ?? t.id}`}
                className={`grid size-8 shrink-0 place-items-center rounded-full border-2 transition ${last ? "script-ring text-white" : "hover:scale-110"}`}
                style={last ? { background: m.hex, borderColor: m.hex, ["--ring" as string]: m.hex } : { ...tint(m.hex, 18, 55), color: m.hex }}><m.Icon size={15} aria-hidden /></button>
              {!last && <span aria-hidden className="h-0.5 w-4 shrink-0 rounded" style={{ background: `color-mix(in srgb, ${m.hex} 45%, transparent)` }} />}
            </div>
          );
        })}
        {!ended && <span aria-hidden className="ml-1 text-xs text-muted">…</span>}
      </HScroll>

      <div role="radiogroup" aria-label="Tom da fala" className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Tom</span>
        <span className="inline-flex gap-1 rounded-xl border border-line bg-panel p-1">
          {TONE_KEYS.map((k) => <button key={k} type="button" role="radio" aria-checked={tone === k} title={TONES[k].hint} onClick={() => setTone(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tone === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:bg-sunk hover:text-ink"}`}>{TONES[k].label}</button>)}
        </span>
        <span className="text-xs text-muted">{TONES[tone].hint}. O caminho é o mesmo; troque quando quiser.</span>
      </div>

      {/* Palco */}
      <div key={node.id} className="script-pop relative overflow-hidden rounded-3xl border-2 bg-panel" style={{ borderColor: `color-mix(in srgb, ${mood.hex} 55%, transparent)` }}>
        <div className="flex items-center gap-2.5 px-4 py-2.5 text-white" style={{ background: mood.hex }}>
          <span className="grid size-8 place-items-center rounded-full bg-white/25"><mood.Icon size={17} aria-hidden className={moodOf(node) === "objecao" ? "script-shake" : ""} /></span>
          <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-sm font-bold">{node.title}</p><p className="text-[11px] opacity-90">{mood.hint}</p></div>
          {!ended && <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-bold"><Mic size={12} aria-hidden /> Você fala</span>}
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {moodOf(node) === "objecao" && !ended && <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#ea580c" }}><ShieldAlert size={16} aria-hidden /> O lead levantou uma objeção. Respire, escute e responda com calma.</p>}
          {ended ? (
            <div className="relative flex flex-col items-center gap-3 py-2 text-center">
              {success && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 h-0">
                  {Array.from({ length: 28 }, (_, i) => <i key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % 5], ["--dx" as string]: `${((i * 53) % 120) - 60}px`, ["--dy" as string]: `${90 + ((i * 29) % 140)}px`, ["--rot" as string]: `${(i * 71) % 360}deg`, animationDelay: `${(i % 7) * 0.05}s` }} />)}
                </div>
              )}
              <span className={`grid size-16 place-items-center rounded-2xl text-white shadow-lg ${success ? "script-bounce" : ""}`} style={{ background: success ? "#22c55e" : "#64748b" }}><OutIcon size={30} aria-hidden /></span>
              <div>
                <p className="text-xl font-extrabold">{success ? "Objetivo alcançado!" : "Conversa encerrada"}</p>
                <p className="text-sm font-semibold" style={{ color: success ? "#16a34a" : undefined }}>{node.outcome ? OUTCOMES[node.outcome].label : node.title}</p>
              </div>
              <p className="max-w-md whitespace-pre-line text-base">{fillScript(sayOf(node, tone), vars)}</p>
              {node.outcome && <p className="max-w-md rounded-xl bg-sunk px-3 py-2 text-sm text-muted">{OUTCOMES[node.outcome].hint}</p>}
              <p className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-sunk px-2.5 py-1">{trail.length} etapas</span>
                <span className="rounded-full px-2.5 py-1" style={tint("#22c55e", 16, 40)}>{good} bons sinais</span>
                <span className="rounded-full px-2.5 py-1" style={tint("#f97316", 16, 40)}>{hurdles} objeções enfrentadas</span>
              </p>
              {endExtra?.({ runId })}
            </div>
          ) : (
            <>
              <div className="relative rounded-2xl rounded-tl-sm px-4 py-3.5" style={{ ...tint(mood.hex, 9, 30), border: "1px solid" }}>
                <p className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: mood.hex }}><span className="flex items-center gap-1.5"><Volume2 size={12} aria-hidden /> Diga ao lead</span><span className="rounded-full bg-panel/70 px-2.5 py-0.5 normal-case tracking-normal text-ink" title="Como você deve soar nesta fala"><span aria-hidden className="mr-1 text-sm">{postureOf(node).emoji}</span>Postura: {postureOf(node).text}</span></p>
                <p className="whitespace-pre-line text-lg font-medium leading-relaxed sm:text-xl">{fillScript(sayOf(node, tone), vars)}</p>
              </div>
              {node.tip && <p className="flex items-start gap-2 rounded-xl border border-dashed border-line bg-sunk/60 px-3 py-2 text-sm"><Lightbulb size={16} aria-hidden className="mt-0.5 shrink-0 text-warn" /><span><b className="text-warn">Dica só para você</b>: {node.tip}</span></p>}
              {extra?.(node.id, pick)}
            </>
          )}
        </div>
      </div>

      {/* Respostas */}
      {!ended && (
        <div className="space-y-2 lg:sticky lg:bottom-0 lg:z-10 lg:-mx-4 lg:border-t lg:border-line lg:bg-panel/95 lg:px-4 lg:pb-2 lg:pt-2.5 lg:backdrop-blur">
          <p className="flex items-center gap-2 text-sm font-bold"><Ear size={16} aria-hidden className="text-accent" /> O que o lead respondeu? <span className="hidden text-xs font-normal text-muted sm:inline">(toque ou use as teclas 1, 2, 3…)</span></p>
          <div className={`grid gap-2 sm:grid-cols-2 ${node.options.length > 2 ? "lg:grid-cols-3" : ""}`}>
            {node.options.map((op, i) => {
              const k = KIND[op.kind]; const Icon = k.Icon; const off = !op.to || !by.has(op.to);
              return (
                <button key={i} type="button" disabled={off} onClick={() => pick(i)} style={{ ...tint(k.hex, 9, 45), ["--c" as string]: `color-mix(in srgb, ${k.hex} 55%, transparent)` }}
                  className="script-ans flex min-h-14 items-center gap-3 lg:min-h-[3.5rem] rounded-2xl border-2 px-3 py-2.5 text-left font-medium disabled:opacity-50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: k.hex }}><Icon size={19} aria-hidden /></span>
                  <span className="flex-1 text-[15px] leading-snug">{op.label}<span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: k.hex }}>{KIND_LABEL[op.kind]}</span></span>
                  <kbd className="hidden size-6 shrink-0 place-items-center rounded-md border border-line bg-panel text-xs font-bold text-muted sm:grid">{i + 1}</kbd>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {noted.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted"><NotebookPen size={13} aria-hidden /> Anotado na observação: {noted.map((n) => <span key={n} className="rounded-full bg-sunk px-2 py-0.5 font-medium text-ink">{n}</span>)}</p>}
      {steps > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhost} onClick={() => setTrail((t) => t.slice(0, -1))}><ArrowLeft size={15} aria-hidden /> Voltar um passo</button>
          <button type="button" className={btnGhost} onClick={restart}><RotateCcw size={15} aria-hidden /> Recomeçar</button>
        </div>
      )}
    </div>
  );
}
