"use client";

import { Brain, Building2, Check, CheckCircle2, CircleHelp, ClipboardList, GitCompareArrows, History, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { CONFIDENCE, isStale, MULTI_SEP, missingFields, splitMulti, type FactView, type FieldDefView } from "@/config/facts";
import { fieldEventsAction, recordFactAction, type FactMode, type FactResult } from "@/modules/facts/actions";
import type { UnitView } from "@/modules/facts/queries";

/* ───────────── Estado dos dados do lead durante a ligação ───────────── */

export type Conflict = { key: string; value: string; old: FactView; personId: number | null };
export type FactsApi = {
  defs: FieldDefView[];
  current: FactView[];
  /** Grava uma resposta. Em modo revisão, uma resposta diferente da que já existe abre o conflito para decidir na hora. */
  record: (key: string, value: string, personId?: number | null, mode?: FactMode) => Promise<FactResult>;
  /** Avisa que a pergunta foi feita, pulada ou o cliente não soube. */
  event: (key: string, event: "asked" | "skipped" | "unknown") => void;
  review: boolean;
  setReview: (v: boolean) => void;
  conflict: Conflict | null;
  resolve: (mode: Exclude<FactMode, "auto"> | "cancel") => Promise<void>;
  personId: number | null;
};

/** Guarda as respostas do lead e cuida do "revisar durante a chamada" (escolha da pessoa, lembrada no navegador). */
export function useLeadFacts({ leadId, defs, initial, isTest, personId }: { leadId: number; defs: FieldDefView[]; initial: FactView[]; isTest?: boolean; personId?: number | null }): FactsApi {
  const toast = useToast();
  const [current, setCurrent] = useState<FactView[]>(initial);
  const [review, setReviewState] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const runId = useRef<string>("");
  useEffect(() => { runId.current = crypto.randomUUID(); try { setReviewState(localStorage.getItem("facts_review") === "1"); } catch { /* sem armazenamento */ } }, []);
  useEffect(() => { setCurrent(initial); setConflict(null); }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps
  const setReview = (v: boolean) => { setReviewState(v); try { localStorage.setItem("facts_review", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
  const pid = personId ?? null;

  const merge = useCallback((f: FactView) => setCurrent((l) => [...l.filter((x) => !(x.key === f.key && x.personId === f.personId)), f]), []);
  const label = (k: string) => defs.find((d) => d.key === k)?.label ?? k;

  const record = useCallback(async (key: string, value: string, who?: number | null, mode: FactMode = "auto"): Promise<FactResult> => {
    const personIdFor = who === undefined ? pid : who;
    let r: FactResult;
    try { r = await recordFactAction({ leadId, key, value, personId: personIdFor, mode, review, runId: runId.current, isTest }); } catch { r = { ok: false, message: "Não consegui guardar agora." }; }
    if (!r.ok) { toast("warn", r.message); return r; }
    if (r.state === "conflict") { setConflict({ key, value: r.value, old: r.old, personId: personIdFor }); return r; }
    merge(r.fact);
    if (r.state === "replaced" || r.state === "merged") toast("info", `${label(key)} atualizado.`);
    return r;
  }, [leadId, review, isTest, pid, merge, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = useCallback(async (mode: Exclude<FactMode, "auto"> | "cancel") => {
    const c = conflict; if (!c) return;
    setConflict(null);
    if (mode === "cancel") return;
    const r = await recordFactAction({ leadId, key: c.key, value: c.value, personId: c.personId, mode, runId: runId.current, isTest });
    if (r.ok && r.state !== "conflict") merge(r.fact); else if (!r.ok) toast("warn", r.message);
  }, [conflict, leadId, isTest, merge, toast]);

  const event = useCallback((key: string, e: "asked" | "skipped" | "unknown") => { void fieldEventsAction([{ key, leadId, event: e, isTest }]).catch(() => {}); }, [leadId, isTest]);
  return { defs, current, record, event, review, setReview, conflict, resolve, personId: pid };
}

/* ───────────── Peças de tela ───────────── */

const valueLabel = (v: string) => splitMulti(v).join(", ");

const chipCls = (on: boolean) => `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition active:scale-95 ${on ? "border-accent bg-accent/15 text-accent" : "border-line bg-sunk/60 text-ink hover:border-accent/60"}`;

function MultiPick({ def, value, onChange }: { def: FieldDefView; value: string | null; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string[]>(value ? splitMulti(value) : []);
  useEffect(() => setDraft(value ? splitMulti(value) : []), [value]);
  const toggle = (o: string) => setDraft((d) => (d.includes(o) ? d.filter((x) => x !== o) : [...d, o]));
  return (
    <div className="space-y-2"><div className="flex flex-wrap gap-1.5" role="group" aria-label={def.label}>{def.options.map((o) => <button key={o} type="button" aria-pressed={draft.includes(o)} onClick={() => toggle(o)} className={chipCls(draft.includes(o))}>{draft.includes(o) && <Check size={13} aria-hidden />}{o}</button>)}</div>
      <button type="button" disabled={!draft.length} onClick={() => onChange(draft.join(MULTI_SEP))} className={`${btnPrimary} !min-h-9 !px-3.5 !text-sm`}>Guardar</button></div>
  );
}

function TextPick({ def, value, onChange, compact }: { def: FieldDefView; value: string | null; onChange: (v: string) => void; compact: boolean }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onChange(text.trim()); }}>
      <input className={`${inputCls} ${compact ? "!min-h-9" : ""}`} aria-label={def.label} inputMode={def.kind === "numero" ? "decimal" : undefined} maxLength={120} value={text} onChange={(e) => setText(e.target.value)} placeholder={def.kind === "numero" ? "Só o número" : "Digite o que o cliente disse"} />
      <button type="submit" disabled={!text.trim()} className={`${btnPrimary} !min-h-9 !px-3.5 !text-sm`}>Guardar</button>
    </form>
  );
}

/** Campo de resposta: escolhas em botões, várias escolhas, texto, número ou sim/não. */
export function FieldInput({ def, value, onChange, compact = false }: { def: FieldDefView; value: string | null; onChange: (v: string) => void; compact?: boolean }) {
  if (def.kind === "lista") return <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={def.label}>{def.options.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={chipCls(value === o)}>{value === o && <Check size={13} aria-hidden />}{o}</button>)}</div>;
  if (def.kind === "simnao") return <div className="flex gap-1.5" role="radiogroup" aria-label={def.label}>{["Sim", "Não"].map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={chipCls(value === o)}>{o}</button>)}</div>;
  if (def.kind === "multi") return <MultiPick def={def} value={value} onChange={onChange} />;
  return <TextPick def={def} value={value} onChange={onChange} compact={compact} />;
}

/** Pergunta de dados dentro do roteiro: o vendedor marca o que o cliente disse e isso grava no lead. */
export function FactAsk({ facts, ask, nodeId }: { facts: FactsApi; ask: { key: string; q?: string }[]; nodeId: string }) {
  const defs = ask.map((a) => ({ a, d: facts.defs.find((d) => d.key === a.key) })).filter((x): x is { a: { key: string; q?: string }; d: FieldDefView } => !!x.d);
  const asked = useRef<Set<string>>(new Set());
  useEffect(() => { for (const { d } of defs) if (!asked.current.has(`${nodeId}:${d.key}`)) { asked.current.add(`${nodeId}:${d.key}`); facts.event(d.key, "asked"); } }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [done, setDone] = useState<Record<string, string>>({});
  useEffect(() => setDone({}), [nodeId]);
  if (!defs.length) return null;
  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3" aria-label="Dados para guardar no lead">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent"><Brain size={13} aria-hidden /> Anote o que ele disse: fica guardado no lead</p>
      {defs.map(({ a, d }) => {
        const cur = facts.current.find((f) => f.key === d.key && (d.scope === "lead" ? f.personId === null : f.personId === facts.personId));
        const shown = done[d.key] ?? cur?.value ?? null;
        const stale = cur ? isStale(d.ttlDays, cur.at) : false;
        return (
          <div key={d.key} className="space-y-1.5">
            <p className="text-sm font-semibold">{a.q ?? d.label}</p>
            {cur && done[d.key] === undefined && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted"><span>Já sabemos: <b className="text-ink">{valueLabel(cur.value)}</b>{stale ? " (já faz tempo)" : ""}.</span>
                <button type="button" className="rounded-full border border-ok/50 px-2.5 py-0.5 font-semibold text-ok transition hover:bg-ok/10" onClick={async () => { const r = await facts.record(d.key, cur.value); if (r.ok) setDone((x) => ({ ...x, [d.key]: cur.value })); }}>Ele confirmou</button></p>
            )}
            <FieldInput def={d} value={shown} onChange={async (v) => { const r = await facts.record(d.key, v); if (r.ok) setDone((x) => ({ ...x, [d.key]: r.state === "conflict" ? (x[d.key] ?? "") : v })); }} compact />
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {done[d.key] !== undefined && done[d.key] !== "" && <span className="inline-flex items-center gap-1 font-semibold text-ok"><CheckCircle2 size={13} aria-hidden /> Guardado: {valueLabel(done[d.key])}</span>}
              {done[d.key] === undefined && <button type="button" className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => { facts.event(d.key, "unknown"); setDone((x) => ({ ...x, [d.key]: "" })); }}><CircleHelp size={12} aria-hidden /> Ele não soube dizer</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Quando a resposta nova diverge da guardada: a pessoa decide na hora (só aparece no modo revisão). */
export function FactConflict({ facts }: { facts: FactsApi }) {
  const c = facts.conflict; if (!c) return null;
  const def = facts.defs.find((d) => d.key === c.key);
  const canBoth = def?.kind === "multi" || def?.kind === "texto";
  return (
    <div role="alertdialog" aria-label="Dado diferente do que já temos" className="space-y-3 rounded-2xl border-2 border-warn/60 bg-warn/10 p-4 shadow-lg">
      <p className="flex items-center gap-2 text-sm font-bold"><GitCompareArrows size={16} aria-hidden className="text-warn" /> {def?.label ?? c.key}: o que ele disse é diferente do que temos</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="rounded-xl bg-panel px-3 py-2 text-sm"><span className="block text-[11px] font-bold uppercase tracking-wide text-muted">Já guardado ({CONFIDENCE[c.old.confidence].label.toLowerCase()})</span>{valueLabel(c.old.value)}</p>
        <p className="rounded-xl bg-panel px-3 py-2 text-sm ring-2 ring-accent/40"><span className="block text-[11px] font-bold uppercase tracking-wide text-accent">Agora</span>{valueLabel(c.value)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => void facts.resolve("replace")}>Usar o novo</button>
        <button type="button" className={btnGhost} onClick={() => void facts.resolve("keep")}>Manter o antigo</button>
        {canBoth && <button type="button" className={btnGhost} onClick={() => void facts.resolve("both")}>Guardar os dois</button>}
        <button type="button" className="px-2 text-sm text-muted hover:text-ink" onClick={() => void facts.resolve("cancel")}>Decidir depois</button>
      </div>
    </div>
  );
}

/** Interruptor "Revisar dados nesta ligação". */
export function ReviewToggle({ facts }: { facts: FactsApi }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-sunk/60 px-3 py-1 text-xs font-semibold transition hover:border-accent/60" title="Quando o cliente disser algo diferente do que já temos, você decide na hora o que vale. Desligado, o dado novo vale e o antigo fica no histórico.">
      <input type="checkbox" className="size-3.5 accent-[var(--accent)]" checked={facts.review} onChange={(e) => facts.setReview(e.target.checked)} />
      <GitCompareArrows size={13} aria-hidden /> Revisar dados nesta ligação
    </label>
  );
}

/** "O que sabemos" sobre a empresa, o que ainda falta e as outras unidades (todas podem ser contatadas). */
export function LeadKnowledge({ facts, units, goalIsSales = false, startOpen = false }: { facts: FactsApi; units: UnitView[]; goalIsSales?: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const groups = useMemo(() => {
    const by = new Map<string, { def: FieldDefView; fact: FactView }[]>();
    for (const f of facts.current) { const d = facts.defs.find((x) => x.key === f.key); if (!d) continue; by.set(d.groupName, [...(by.get(d.groupName) ?? []), { def: d, fact: f }]); }
    return [...by.entries()];
  }, [facts.current, facts.defs]);
  const next = missingFields(facts.defs, facts.current, goalIsSales, 4);
  const [edit, setEdit] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const total = facts.defs.filter((d) => d.scope === "lead").length, have = facts.defs.filter((d) => d.scope === "lead" && facts.current.some((f) => f.key === d.key && f.personId === null)).length;
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-panel p-4" aria-label="O que sabemos sobre este lead">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <h3 className="flex items-center gap-2 text-sm font-bold"><ClipboardList size={16} aria-hidden className="text-accent" /> O que sabemos{next.length > 0 && !open && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">{next.length} para perguntar</span>}</h3>
        <span className="inline-flex items-center gap-2 text-xs text-muted"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full bg-grad" style={{ width: `${Math.min(100, Math.round((have / Math.max(1, total)) * 100))}%` }} /></span>{have} de {total} dados <span aria-hidden>{open ? "▴" : "▾"}</span></span>
      </button>
      {open && <>
      {groups.length === 0 && <p className="text-sm text-muted">Ainda não guardamos nada deste lead. Os roteiros vão preenchendo conforme a conversa.</p>}
      {groups.map(([g, items]) => (
        <div key={g} className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{g}</p>
          <ul className="space-y-1">
            {items.map(({ def, fact }) => {
              const stale = isStale(def.ttlDays, fact.at);
              return (
                <li key={`${fact.key}-${fact.personId}`} className="rounded-lg bg-sunk/50 px-2.5 py-1.5 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-muted">{def.label}:</span><b className="min-w-0">{valueLabel(fact.value)}</b>
                    <span className="inline-flex items-center gap-0.5" title={`${CONFIDENCE[fact.confidence].label}: ${CONFIDENCE[fact.confidence].hint}`}>{[1, 2, 3].map((n) => <span key={n} aria-hidden className={`size-1.5 rounded-full ${n <= fact.confidence ? "bg-ok" : "bg-line"}`} />)}</span>
                    {stale && <span className="rounded-full bg-warn/15 px-1.5 text-[10px] font-bold text-warn">confirmar</span>}
                    <button type="button" className="ml-auto text-xs text-accent hover:underline" onClick={() => setEdit(edit === fact.key ? null : fact.key)}>{edit === fact.key ? "Fechar" : stale ? "Confirmar ou mudar" : "Mudar"}</button>
                  </div>
                  <p className="text-[11px] text-muted">{fact.by ? `${fact.by} · ` : ""}{new Date(fact.at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                  {edit === fact.key && <div className="mt-2 space-y-2"><FieldInput def={def} value={fact.value} compact onChange={async (v) => { const r = await facts.record(fact.key, v, fact.personId, "replace"); if (r.ok) setEdit(null); }} />
                    <button type="button" className="text-xs font-semibold text-ok hover:underline" onClick={async () => { await facts.record(fact.key, fact.value, fact.personId, "keep"); setEdit(null); }}>Está certo, só confirmar</button></div>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {next.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-dashed border-line p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-accent"><Sparkles size={13} aria-hidden /> Vale perguntar agora</p>
          <ul className="space-y-1">{next.map(({ def, why }) => (
            <li key={def.key} className="flex flex-wrap items-center gap-2 text-sm"><span>{def.label}</span>{why === "velho" && <span className="rounded-full bg-warn/15 px-1.5 text-[10px] font-bold text-warn">faz tempo</span>}
              <button type="button" className="ml-auto text-xs text-accent hover:underline" onClick={() => setEdit(edit === `n:${def.key}` ? null : `n:${def.key}`)}>Anotar</button>
              {edit === `n:${def.key}` && <div className="w-full pt-1"><FieldInput def={def} value={null} compact onChange={async (v) => { const r = await facts.record(def.key, v, null); if (r.ok) setEdit(null); }} /></div>}</li>
          ))}</ul>
        </div>
      )}
      {units.length > 0 && (
        <div className="space-y-1.5">
          <button type="button" className="flex w-full items-center gap-2 text-left text-sm font-semibold" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}><Building2 size={15} aria-hidden className="text-accent" /> Outras unidades da empresa <span className="rounded-full bg-sunk px-2 text-xs text-muted">{units.length}</span></button>
          {showAll && <ul className="space-y-1.5">{units.map((u) => (
            <li key={u.id} className="rounded-lg bg-sunk/50 px-2.5 py-1.5 text-sm">
              <p className="font-medium">{u.company}{u.city ? <span className="font-normal text-muted"> · {u.city}{u.uf ? `/${u.uf}` : ""}</span> : null}</p>
              <p className="text-xs text-muted">{u.people.length ? u.people.map((p) => p.name + (p.roleTitle ? ` (${p.roleTitle})` : "")).join(" · ") : "Sem contatos ainda"}{u.phones.length ? ` · ${u.phones.length} ${u.phones.length === 1 ? "telefone" : "telefones"}` : ""}</p>
              <a className="text-xs font-semibold text-accent hover:underline" href={`/roteiro/${u.id}`} target="_blank" rel="noopener noreferrer">Ligar com roteiro para esta unidade (abre ao lado, em outra aba)</a>
            </li>
          ))}</ul>}
        </div>
      )}
      <p className="flex items-center gap-1 text-[11px] text-muted"><History size={11} aria-hidden /> Respostas antigas ficam no histórico quando uma nova as substitui.</p>
      </>}
    </section>
  );
}
