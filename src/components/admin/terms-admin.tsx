"use client";

import { Lightbulb, Plus, Search, Tags, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { SEGMENT_WORDS } from "@/config/lists";
import { deleteTermAction, saveSegmentRecosAction, saveTermAction } from "@/modules/products/terms-actions";
import { TERM_CATEGORIES, type Term, type UnknownTerm } from "@/modules/products/classify";

export type TermRow = Term & { id: number; note: string | null; active: boolean; uses: number };

function TermForm({ init, onDone }: { init: { id?: number; code: string; meaning: string; category: string; note: string; active: boolean }; onDone?: () => void }) {
  const [f, setF] = useState(init);
  const { run, pending } = useRun();
  const save = () => run(() => saveTermAction({ ...f, note: f.note || null }), undefined, () => { if (!f.id) setF({ code: "", meaning: "", category: f.category, note: "", active: true }); onDone?.(); });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted">Sigla<input aria-label="Sigla" className={`${inputCls} !w-24 uppercase`} maxLength={8} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></label>
      <label className="min-w-40 flex-1 text-xs text-muted">Significado<input aria-label="Significado" className={inputCls} maxLength={60} value={f.meaning} onChange={(e) => setF({ ...f, meaning: e.target.value })} /></label>
      <label className="text-xs text-muted">Grupo<select aria-label="Grupo" className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{TERM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <button type="button" className={btnPrimary} disabled={pending || !f.code || f.meaning.trim().length < 2} onClick={save}>{init.id ? "Salvar" : <><Plus size={15} aria-hidden /> Adicionar</>}</button>
    </div>
  );
}

export function TermsAdmin({ terms, unknown, recos }: { terms: TermRow[]; unknown: UnknownTerm[]; recos: Record<string, string[]> }) {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(Object.keys(SEGMENT_WORDS).map((k) => [k, (recos[k] ?? []).join(", ")])));
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const shown = useMemo(() => terms.filter((t) => !q.trim() || `${t.code} ${t.meaning} ${t.category}`.toLowerCase().includes(q.trim().toLowerCase())), [terms, q]);
  const groups = useMemo(() => { const m = new Map<string, TermRow[]>(); for (const t of shown) m.set(t.category, [...(m.get(t.category) ?? []), t]); return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [shown]);
  return (
    <div className="space-y-5">
      <SectionCard icon={Tags} title="Nomenclatura dos produtos">
        <p className="text-sm text-muted">Cada sigla que aparece na descrição dos produtos (NYL, AC, RI…) ganha um significado e um grupo. Com isso o sistema classifica os produtos sozinho, por tags.</p>
        <TermForm init={{ code: "", meaning: "", category: "Material", note: "", active: true }} />
        <label className="relative block"><Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Buscar sigla" className={`${inputCls} pl-9`} placeholder="Buscar sigla ou significado" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {groups.map(([cat, list]) => (
          <div key={cat} className="space-y-1.5"><p className="text-sm font-semibold">{cat} <span className="font-normal text-muted">· {list.length}</span></p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {list.map((t) => (
                <li key={t.id} className="rounded-xl border border-line bg-sunk/50 px-3 py-2">
                  {edit === t.id ? <TermForm init={{ id: t.id, code: t.code, meaning: t.meaning, category: t.category, note: t.note ?? "", active: t.active }} onDone={() => setEdit(null)} /> : (
                    <div className="flex items-center gap-2"><b className="figure rounded-md bg-accent/15 px-2 py-0.5 text-sm text-accent">{t.code}</b><span className="min-w-0 flex-1 truncate text-sm">{t.meaning}</span><span className="text-xs text-muted" title="Produtos do catálogo com esta sigla">{t.uses} prod.</span>
                      <button type="button" className={btnGhost} onClick={() => setEdit(t.id)}>Editar</button>
                      <button type="button" aria-label="Excluir sigla" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir esta sigla?", body: `${t.code} (${t.meaning}) deixa de classificar produtos.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteTermAction(t.id)) })}><Trash2 size={14} /></button></div>)}
                </li>
              ))}
            </ul></div>
        ))}
        {terms.length === 0 && <p className="text-sm text-muted">Nenhuma sigla ainda.</p>}
      </SectionCard>

      <SectionCard icon={Wand2} title="Siglas que o sistema encontrou e ainda não conhece">
        {unknown.length === 0 ? <p className="text-sm text-muted">Nenhuma sigla nova nos produtos por enquanto. Quando aparecer uma que se repete, ela surge aqui para você explicar o que é.</p> : (
          <ul className="space-y-2">{unknown.map((u) => (
            <li key={u.code} className="space-y-1.5 rounded-xl border border-dashed border-line p-3"><p className="text-xs text-muted"><b className="figure text-sm text-ink">{u.code}</b> aparece em {u.count} produtos, ex.: {u.example}</p>
              <TermForm init={{ code: u.code, meaning: "", category: "Outros", note: "", active: true }} /></li>
          ))}</ul>
        )}
      </SectionCard>

      <SectionCard icon={Lightbulb} title="Sugestões de produtos por tipo de cliente">
        <p className="text-sm text-muted">Separe por vírgula. Aparecem no Shuffler quando o lead parece ser deste tipo (pelo nome ou atividade). Junto delas o sistema mostra o que mais foi cotado e vendido para empresas parecidas.</p>
        <div className="grid gap-2 sm:grid-cols-2">{Object.entries(SEGMENT_WORDS).map(([k, v]) => <label key={k} className="text-sm">{v.label}<input className={inputCls} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder="Ex.: Grampos de mola, Pinos de centro" /></label>)}</div>
        <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => saveSegmentRecosAction(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.split(",").map((s) => s.trim()).filter(Boolean)]))))}>Salvar sugestões</button>
      </SectionCard>
      {dialog}
    </div>
  );
}
