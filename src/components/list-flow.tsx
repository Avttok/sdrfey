"use client";

import { Building2, Check, Filter, MapPin, Phone, Play, Plus, Power, Sparkles, Store, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { describeFilters, EMPTY_FILTERS, SEGMENT_WORDS, UFS, type ListFilters } from "@/config/lists";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { deleteListAction, previewListAction, saveListAction, setActiveListAction, type ListPreview } from "@/modules/lists/actions";
import type { ListKind, ListRow } from "@/modules/lists/queries";

type TagGroup = { key: string; name: string; tags: { key: string; label: string }[] };
const STEPS = [["Onde", MapPin], ["Quem", Store], ["Qualidade", Phone], ["Revisar", Check]] as const;

const IDEAS: { title: string; hint: string; f: Partial<ListFilters> }[] = [
  { title: "Prontos para ligar", hint: "Com telefone e nunca contatados", f: { phone: true, untouched: true } },
  { title: "Lista premium", hint: "Telefone, e-mail e contato já descobertos", f: { phone: true, email: true, person: true } },
  { title: "Posto de molas com telefone", hint: "O segmento que mais compra", f: { segments: ["posto_molas"], phone: true } },
  { title: "Auto centers com e-mail", hint: "Dá para mandar e-mail antes de ligar", f: { segments: ["auto_center"], email: true } },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`lift rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-accent bg-accent/15 font-semibold text-accent" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>{on && <Check size={13} aria-hidden className="mr-1 inline" />}{children}</button>;
}
const toggleIn = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

export function ListFlow({ kind, lists, tagGroups }: { kind: ListKind; lists: ListRow[]; tagGroups: TagGroup[] }) {
  const [f, setF] = useState<ListFilters>(EMPTY_FILTERS);
  const [editId, setEditId] = useState<number | undefined>();
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);
  const [pv, setPv] = useState<ListPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const seq = useRef(0);
  const key = JSON.stringify(f);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => { previewListAction(kind, f).then((r) => { if (n === seq.current) { setPv(r); setLoading(false); } }).catch(() => n === seq.current && setLoading(false)); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind]);

  const edit = (l: ListRow) => { setF(l.filters); setEditId(l.id); setName(l.name); setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const reset = () => { setF(EMPTY_FILTERS); setEditId(undefined); setName(""); setStep(0); };
  const save = (activate: boolean) => run(() => saveListAction({ id: editId, kind, name, filters: f, activate }), undefined, reset);

  return (
    <div className="space-y-6">
      {lists.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Filter size={16} aria-hidden className="text-accent" /> Minhas listas</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lists.map((l) => (
              <li key={l.id} className={`${panelCls} lift space-y-2 p-4 ${l.active ? "ring-2 ring-accent/60" : ""}`}>
                <div className="flex items-start gap-2"><p className="min-w-0 flex-1 truncate font-semibold">{l.name}</p>{l.active && <span className="glow-pulse rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">Ativa</span>}</div>
                <p className="figure text-2xl">{l.count.toLocaleString("pt-BR")} <span className="text-sm font-normal text-muted">leads disponíveis</span></p>
                <p className="text-xs text-muted">{describeFilters(l.filters).join(" · ") || "Sem filtros"}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={l.active ? btnGhost : btnPrimary} disabled={pending || (!l.active && l.count === 0)} onClick={() => run(() => setActiveListAction(kind, l.active ? null : l.id))}>{l.active ? <><Power size={14} aria-hidden /> Desativar</> : <><Play size={14} aria-hidden /> Ativar</>}</button>
                  <button type="button" className={btnGhost} onClick={() => edit(l)}>Editar</button>
                  <button type="button" aria-label="Excluir lista" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir esta lista?", body: `A lista "${l.name}" será excluída. Os leads continuam onde estão.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteListAction(kind, l.id)) })}><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} aria-hidden className="text-accent" /> Ideias prontas (toque para começar com elas)</h2>
        <div className="flex flex-wrap gap-2">
          {IDEAS.map((i) => <button key={i.title} type="button" onClick={() => { setF({ ...EMPTY_FILTERS, phone: false, ...i.f }); setEditId(undefined); setStep(3); }} className="lift rounded-2xl border border-line bg-sunk/60 px-3 py-2 text-left text-sm"><b className="block">{i.title}</b><span className="text-xs text-muted">{i.hint}</span></button>)}
        </div>
      </section>

      <section className={`${panelCls} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <Wand2 size={18} aria-hidden className="text-accent" />
          <h2 className="font-semibold">{editId ? "Editando lista" : "Montar uma lista nova"}</h2>
          <span className="flex-1" />
          <p aria-live="polite" className="figure rounded-full bg-accent/15 px-3 py-1 text-sm text-accent">{loading ? "contando…" : `${(pv?.count ?? 0).toLocaleString("pt-BR")} leads`}</p>
        </div>
        <ol className="flex flex-wrap gap-1.5" aria-label="Etapas">
          {STEPS.map(([t, Icon], i) => <li key={t}><button type="button" aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${step === i ? "bg-accent font-semibold text-white" : i < step ? "bg-ok/15 text-ok" : "bg-sunk text-muted"}`}><Icon size={14} aria-hidden /> {t}</button></li>)}
        </ol>

        {step === 0 && (
          <div className="card-in space-y-3">
            <p className="text-sm text-muted">Em quais estados você quer trabalhar? (deixe vazio para o Brasil todo)</p>
            <div className="flex flex-wrap gap-1.5">{UFS.map((u) => <Chip key={u} on={f.ufs.includes(u)} onClick={() => setF({ ...f, ufs: toggleIn(f.ufs, u) })}>{u}</Chip>)}</div>
            <label className="block text-sm">Cidade (opcional)<input className={inputCls} value={f.city} maxLength={60} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Ex.: Campinas" /></label>
          </div>
        )}
        {step === 1 && (
          <div className="card-in space-y-3">
            <p className="text-sm text-muted">Que tipo de empresa? O sistema procura no nome e na atividade (CNAE) da Receita.</p>
            <div className="flex flex-wrap gap-1.5">{Object.entries(SEGMENT_WORDS).map(([k, v]) => <Chip key={k} on={f.segments.includes(k)} onClick={() => setF({ ...f, segments: toggleIn(f.segments, k) })}><Building2 size={13} aria-hidden className="mr-1 inline" />{v.label}</Chip>)}</div>
            <label className="block text-sm">Palavras suas (separe por vírgula)<input className={inputCls} value={f.words} maxLength={120} onChange={(e) => setF({ ...f, words: e.target.value })} placeholder="Ex.: truck, freios, rolamentos" /></label>
            {tagGroups.map((g) => (
              <div key={g.key} className="space-y-1.5"><p className="text-sm font-medium">{g.name}</p><div className="flex flex-wrap gap-1.5">{g.tags.map((t) => { const v = `${g.key}:${t.key}`; return <Chip key={v} on={f.tags.includes(v)} onClick={() => setF({ ...f, tags: toggleIn(f.tags, v) })}>{t.label}</Chip>; })}</div></div>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="card-in space-y-3">
            <p className="text-sm text-muted">Quanta informação o lead precisa ter? Quem já tem telefone e contato rende mais.</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={f.phone} onClick={() => setF({ ...f, phone: !f.phone })}>Com telefone</Chip>
              <Chip on={f.email} onClick={() => setF({ ...f, email: !f.email })}>Com e-mail</Chip>
              <Chip on={f.person} onClick={() => setF({ ...f, person: !f.person })}>Com nome de contato</Chip>
              <Chip on={f.untouched} onClick={() => setF({ ...f, untouched: !f.untouched })}>Nunca contatados</Chip>
            </div>
            <label className="block text-sm">Consulta de CNPJ<select className={inputCls} value={f.enriched} onChange={(e) => setF({ ...f, enriched: e.target.value as ListFilters["enriched"] })}><option value="any">Tanto faz</option><option value="yes">Só os já consultados (com dados da Receita)</option><option value="no">Só os ainda não consultados</option></select></label>
          </div>
        )}
        {step === 3 && (
          <div className="card-in space-y-3">
            <p className="text-sm">{describeFilters(f).join(" · ") || "Sem filtros: todos os leads disponíveis."}</p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {(pv?.sample ?? []).map((s) => <li key={s.id} className="flex items-center gap-2 rounded-xl border border-line bg-sunk/50 px-3 py-2 text-sm"><Store size={15} aria-hidden className="shrink-0 text-accent" /><span className="min-w-0 flex-1 truncate">{s.name}</span><span className="text-xs text-muted">{s.where}</span></li>)}
              {pv && pv.sample.length === 0 && <li className="text-sm text-muted">Nenhum lead com esses filtros. Volte e afrouxe algum.</li>}
            </ul>
            <p className="text-xs text-muted">Exemplos sorteados da lista. Cada vez que você abrir de novo, aparecem outros.</p>
            <label className="block text-sm">Nome da lista<input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Postos de molas de SP" /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={pending || !pv || pv.count === 0} onClick={() => save(true)}><Play size={15} aria-hidden /> Salvar e ativar no Shuffler</button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => save(false)}><Plus size={15} aria-hidden /> Só salvar</button>
              {(editId || describeFilters(f).length > 0) && <button type="button" className={btnGhost} onClick={reset}>Recomeçar</button>}
            </div>
          </div>
        )}
        <div className="flex justify-between">
          <button type="button" className={btnGhost} disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button>
          {step < 3 && <button type="button" className={btnPrimary} onClick={() => setStep(step + 1)}>Próxima etapa</button>}
        </div>
      </section>
      {dialog}
    </div>
  );
}
