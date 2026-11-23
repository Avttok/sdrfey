"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TalkingTo } from "@/components/talking-to";
import type { CapturedPerson } from "@/modules/leads/capture";
import { CalendarCheck, Copy, ExternalLink, FileText, MapPin, Phone, ScrollText } from "lucide-react";
import { copy } from "@/components/attend-flow";
import { callNumber } from "@/components/call-number";
import { PageHead } from "@/components/page-head";
import { RunTasks } from "@/components/run-tasks";
import { LeadKnowledge, ReviewToggle, useLeadFacts } from "@/components/lead-facts";
import type { Knowledge } from "@/modules/facts/queries";
import { ScriptPicker } from "@/components/script-picker";
import { useToast } from "@/components/toast";
import { useVocall } from "@/components/vocall-provider";
import { btnGhost } from "@/components/ui";
import { guessSegment, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { STAGE_META, fmtBRL } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import { fmtCnpj, fmtDate, fmtDateTime, fmtPhone } from "@/lib/format";
import type { LeadView } from "@/modules/leads/view";
import { saveScriptRunAction, type ScriptRunInput } from "@/modules/scripts/runs";
import { attachRunAction } from "@/modules/touches/actions";
import { Timer } from "@/components/call-ui";
import { useTouchScope } from "@/lib/touch-bus";

type Run = Omit<ScriptRunInput, "isTest">;

/** Roteiro de ligação com um lead, em qualquer momento: os dados ficam ao lado e o resultado vira tarefa. */
export function LeadCall({ eventId, knowledge, lead, scripts, goal, area, myName, deal, visit }: {
  eventId?: number | null; knowledge: Knowledge; lead: LeadView; scripts: ScriptDoc[]; goal: ScriptGoal; area: "sdr" | "vendas"; myName: string;
  deal: { stage: string; quote: string | null; valueCents: number | null; nextAt: string | null; nextNote: string | null } | null;
  visit: { date: string | null; rep: string | null } | null;
}) {
  useTouchScope(lead.id, ["call"]); // a pergunta "como foi a ligação?" aparece aqui, na tela do roteiro
  const toast = useToast();
  const vocall = useVocall();
  const [talkingId, setTalkingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const phones = lead.channels.filter((c) => c.kind === "phone" && !c.wrong);
  const [extraPeople, setExtraPeople] = useState<CapturedPerson[]>([]);
  const allPeople = [...lead.people.map((p) => ({ id: p.id, name: p.name })), ...extraPeople.filter((x) => !lead.people.some((p) => p.id === x.id)).map((p) => ({ id: p.id, name: p.name }))];
  const [spoken, setSpoken] = useState<string | null>(null);
  const person = (talkingId ? allPeople.find((p) => p.id === talkingId) : null) ?? allPeople[0] ?? null;
  const talkingTo = (spoken ?? person?.name ?? "").trim();
  // a ligação do VocallPhone acompanha o roteiro: o número discado indica com quem se fala
  const live = vocall.configured ? vocall.call : null;
  const liveDigits = live ? live.telefone.replace(/\D/g, "").replace(vocall.prefix ? new RegExp(`^${vocall.prefix.replace(/\D/g, "")}`) : /^$/, "") : "";
  const liveChannel = liveDigits ? lead.channels.find((c) => c.kind === "phone" && c.value.replace(/\D/g, "").slice(-8) === liveDigits.slice(-8)) : null;
  const livePersonId = liveChannel?.personId ?? null;
  const lastLive = useRef<string>("");
  useEffect(() => { if (livePersonId && lastLive.current !== liveDigits) { lastLive.current = liveDigits; setTalkingId(livePersonId); setSpoken(null); } }, [livePersonId, liveDigits]);
  const facts = useLeadFacts({ leadId: lead.id, defs: knowledge.defs, initial: knowledge.facts, isTest: false, personId: person?.id ?? null });
  /** Cada transferência traz uma pessoa nova: o campo esvazia; voltar um passo devolve o nome. */
  const beforeTransfer = useRef<{ name: string; id: number | null }[]>([]);
  const onStep = (nodeId: string, path: string[]) => {
    const n = path.filter((x) => x === "transferido").length;
    const stack = beforeTransfer.current;
    if (nodeId === "transferido" && stack.length < n) {
      stack.push({ name: talkingTo, id: talkingId });
      if (talkingTo) setNotes((l) => (l.includes(`Falou antes com ${talkingTo}`) ? l : [...l, `Falou antes com ${talkingTo}`]));
      setSpoken(""); setTalkingId(null);
    } else if (stack.length > n) {
      const b = stack[n]; stack.length = n;
      setSpoken(b.name || null); setTalkingId(b.id);
    }
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attached = useRef(false);
  const keep = (r: Run) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void saveScriptRunAction(lead.id, r, area).catch(() => {}); if (eventId && !attached.current) { attached.current = true; void attachRunAction(eventId, r.runId).catch(() => {}); } }, r.finished ? 100 : 1200);
  };
  const name = lead.tradeName ?? lead.company;
  const stage = deal ? STAGE_META[deal.stage as DealStage] : null;
  return (
    <div className="space-y-4">
      {live && liveChannel && (
        <div role="status" className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm ${live.endedAt ? "border-line bg-panel" : "border-ok/40 bg-ok/10"}`}>
          <Phone size={16} className={live.endedAt ? "text-muted" : "text-ok"} aria-hidden />
          <span className="font-semibold">{live.endedAt ? "Ligação encerrada" : "Em chamada"} · {fmtPhone(liveDigits)}{person ? ` · ${person.name}` : ""}</span>
          <Timer since={live.since} endedAt={live.endedAt} />
          {live.endedAt && live.qualUrl && <a href={live.qualUrl} target="_blank" rel="noopener noreferrer" className={`${btnGhost} ml-auto !min-h-9 !px-3`}><ExternalLink size={14} aria-hidden /> Qualificar na EOX</a>}
        </div>
      )}
      <PageHead icon={ScrollText} title="Roteiro com o lead" subtitle="Ligue para este cliente com o roteiro à frente. Ao terminar, o que ficou combinado vira tarefa." />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-3">
          <section className="space-y-2 rounded-2xl border border-line bg-panel p-4">
            <p className="text-lg font-bold leading-tight">{name}</p>
            {lead.tradeName && lead.company !== lead.tradeName && <p className="text-xs text-muted">{lead.company}</p>}
            <p className="text-sm text-muted">{fmtCnpj(lead.cnpj)}{lead.city ? ` · ${lead.city}/${lead.uf}` : ""}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/leads/${lead.id}`} className={`${btnGhost} !min-h-9 !px-3 !text-sm`}><ExternalLink size={14} aria-hidden /> Ver lead completo</Link>
            </div>
          </section>
          {(deal || visit) && (
            <section className="space-y-2 rounded-2xl border border-line bg-panel p-4 text-sm">
              {deal && <div className="space-y-1">
                <p className="flex items-center gap-2 font-semibold"><FileText size={15} aria-hidden className="text-accent" /> Negociação aberta {stage && <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: stage.color }}>{stage.label}</span>}</p>
                {deal.quote && <p className="text-muted">Cotação {deal.quote}{deal.valueCents ? ` · ${fmtBRL(deal.valueCents)}` : ""}</p>}
                {deal.nextAt && <p className="text-muted">Próximo passo: <b className="text-ink">{fmtDateTime(deal.nextAt).slice(0, 10)}{deal.nextNote ? ` · ${deal.nextNote}` : ""}</b></p>}
              </div>}
              {visit && <p className="flex items-center gap-2"><MapPin size={15} aria-hidden className="text-accent" /> Visita {visit.date ? fmtDate(visit.date) : "sem data"}{visit.rep ? ` · ${visit.rep}` : ""}</p>}
            </section>
          )}
          <section className="space-y-2 rounded-2xl border border-line bg-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Telefones</p>
            {phones.length === 0 && <p className="text-sm text-muted">Nenhum telefone válido no cadastro. Adicione no <Link className="text-accent underline" href={`/leads/${lead.id}`}>lead</Link>.</p>}
            <ul className="space-y-2">{phones.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-sunk p-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{fmtPhone(p.value)}</span>
                <button type="button" className={`${btnGhost} !min-h-9 !px-3`} onClick={() => { const pe = p.personId ? lead.people.find((x) => x.id === p.personId) : null; if (pe) setTalkingId(pe.id); void callNumber(p.value.replace(/\D/g, ""), pe?.name ?? name, toast, vocall, lead, pe?.id ?? null); }}><Phone size={15} aria-hidden /> Ligar</button>
                <button type="button" aria-label="Copiar número" className={`${btnGhost} !min-h-9 !px-2.5`} onClick={() => void copy(p.value, toast)}><Copy size={15} aria-hidden /></button>
              </li>))}</ul>
          </section>
          {lead.people.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-line bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Falando com</p>
              <div className="flex flex-wrap gap-2">{lead.people.map((p) => (
                <button key={p.id} type="button" aria-pressed={person?.id === p.id} onClick={() => setTalkingId(p.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${person?.id === p.id ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{p.name}{p.roleTitle ? <span className="font-normal text-muted"> · {p.roleTitle}</span> : null}</button>))}</div>
            </section>
          )}
          {notes.length > 0 && (
            <section className="space-y-1 rounded-2xl border border-line bg-panel p-4 text-sm">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><CalendarCheck size={14} aria-hidden /> Anotações da ligação</p>
              <ul className="list-disc space-y-0.5 pl-5">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
              <p className="text-xs text-muted">Ficam guardadas no histórico de roteiros do lead.</p>
            </section>
          )}
        </aside>
        <section className="min-w-0 overflow-hidden rounded-3xl border-2 border-accent/40 bg-panel shadow-md">
          <div className="bg-grad px-4 py-2 text-on-accent"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><ScrollText size={14} aria-hidden /> Roteiro da ligação</p></div>
          <div className="space-y-3 p-3 sm:p-4">
            {scripts.length > 0
              ? <ScriptPicker facts={facts} scripts={scripts} goal={goal} segmentHint={guessSegment(lead.tradeName, lead.company, lead.info?.activity)} extra={(nid, pick) => (nid === "abertura" || nid === "nome" || nid === "transferido") ? (
                    <TalkingTo value={spoken ?? person?.name ?? ""} people={allPeople} knownId={allPeople.find((x) => x.name.trim().toLowerCase() === talkingTo.toLowerCase())?.id ?? null} leadId={lead.id}
                      onChange={(v) => { setSpoken(v); const m = allPeople.find((x) => x.name.trim().toLowerCase() === v.trim().toLowerCase()); if (m) setTalkingId(m.id); }}
                      onEnter={() => pick(0)} onSaved={(p) => { setExtraPeople((l) => [...l.filter((x) => x.id !== p.id), p]); setTalkingId(p.id); setSpoken(null); }} />
                  ) : null} onStep={onStep}
                  vars={{ empresa: name, contato: talkingTo.split(/\s+/)[0] || undefined, contatoCompleto: talkingTo || null, cidade: lead.city, meunome: myName.split(" ")[0] }}
                  onNote={(t) => setNotes((l) => (l.includes(t) ? l : [...l, t]))} onRun={keep} endExtra={({ runId }) => <RunTasks runId={runId} area={area} />} />
              : <p className="text-sm text-muted">Nenhum script disponível ainda.</p>}
            <div className="flex flex-wrap items-center gap-2"><ReviewToggle facts={facts} /></div>
            <LeadKnowledge facts={facts} units={knowledge.units} goalIsSales={area === "vendas"} />
          </div>
        </section>
      </div>
    </div>
  );
}
