"use client";

import { ArrowRight, BookA, Replace, RotateCcw, Search, ShieldAlert, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { RETIRED, TERM_MAX, TERMS, type TermOverrides } from "@/config/terms";
import { applySwapAction, previewSwapAction, saveTermsAction, undoSwapAction } from "@/modules/terms/actions";
import type { SwapRow } from "@/modules/terms/list";
import type { SwapPreview } from "@/modules/terms/swap";

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/** Glossário do sistema: renomear termos na tela e trocar textos já gravados no banco, com prévia e desfazer. */
export function GlossaryAdmin({ initial, swaps }: { initial: TermOverrides; swaps: SwapRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vals, setVals] = useState<TermOverrides>(initial);
  const groups = useMemo(() => [...new Set(TERMS.map((t) => t.group))].map((g) => ({ g, items: TERMS.filter((t) => t.group === g) })), []);
  const dirty = JSON.stringify(vals) !== JSON.stringify(initial);
  const changed = (k: string) => !!vals[k]?.trim() && vals[k].trim() !== TERMS.find((t) => t.key === k)?.label;

  const save = () => start(async () => {
    const r = await saveTermsAction(Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim())));
    toast(r.ok ? "ok" : "bad", r.message ?? "");
    if (r.ok) router.refresh();
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(true);
  const [prev, setPrev] = useState<SwapPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [undo, setUndo] = useState<SwapRow | null>(null);
  const input = { from, to, matchCase, wholeWord };
  const look = () => start(async () => {
    const r = await previewSwapAction(input);
    if (!r.ok) { setPrev(null); return toast("bad", r.message ?? "Confira os campos."); }
    setPrev(r.preview ?? null);
  });
  const apply = () => start(async () => {
    const r = await applySwapAction(input);
    setConfirm(false);
    toast(r.ok ? "ok" : "bad", r.message ?? "");
    if (r.ok) { setPrev(null); setFrom(""); setTo(""); router.refresh(); }
  });
  const doUndo = () => start(async () => {
    if (!undo) return;
    const r = await undoSwapAction(undo.id);
    setUndo(null);
    toast(r.ok ? "ok" : "bad", r.message ?? "");
    if (r.ok) router.refresh();
  });

  return (
    <div className="space-y-5">
      <section className={`${panelCls} space-y-4 p-5`}>
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><BookA size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-lg">Nomes do sistema</h2>
            <p className="text-sm text-muted">Dê outro nome a menus, abas, cargos e shufflers sem mexer no código. Vale para todos na hora, em menus, títulos, selos de cargo e atalhos. Deixe em branco para manter o nome padrão.</p>
          </div>
          <button type="button" className={btnPrimary} disabled={pending || !dirty} onClick={save}>Salvar nomes</button>
        </header>
        {groups.map(({ g, items }) => (
          <div key={g} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{g}</h3>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((t) => (
                <li key={t.key} className={`rounded-xl border p-3 transition ${changed(t.key) ? "border-accent/60 bg-grad-soft" : "border-line bg-sunk/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{t.label}</span>
                    {changed(t.key) && <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent" onClick={() => setVals((v) => { const n = { ...v }; delete n[t.key]; return n; })}><RotateCcw size={12} aria-hidden /> padrão</button>}
                  </div>
                  {t.hint && <p className="text-xs text-muted">{t.hint}</p>}
                  <input className={`${inputCls} mt-2`} value={vals[t.key] ?? ""} maxLength={TERM_MAX} placeholder={t.label} aria-label={`Novo nome para ${t.label}`} onChange={(e) => setVals((v) => ({ ...v, [t.key]: e.target.value }))} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={`${panelCls} space-y-4 p-5`}>
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><Replace size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-lg">Trocar termo no banco</h2>
            <p className="text-sm text-muted">Procura o termo em tags, modelos de e-mail, roteiros e avisos já gravados e troca tudo de uma vez. Mostra a prévia antes e dá para desfazer. O Registro (histórico) não é alterado.</p>
          </div>
        </header>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-44 flex-1 text-sm"><span className="mb-1 block text-muted">Termo atual</span><input className={inputCls} value={from} maxLength={80} onChange={(e) => { setFrom(e.target.value); setPrev(null); }} placeholder="Como está escrito hoje" /></label>
          <ArrowRight size={18} className="mb-3 hidden text-muted sm:block" aria-hidden />
          <label className="block min-w-44 flex-1 text-sm"><span className="mb-1 block text-muted">Termo novo</span><input className={inputCls} value={to} maxLength={80} onChange={(e) => { setTo(e.target.value); setPrev(null); }} placeholder="Como deve ficar" /></label>
          <button type="button" className={btnGhost} disabled={pending || from.trim().length < 2 || !to.trim()} onClick={look}><Search size={15} aria-hidden /> Pré-visualizar</button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={wholeWord} onChange={(e) => { setWholeWord(e.target.checked); setPrev(null); }} /> Só palavra inteira</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={matchCase} onChange={(e) => { setMatchCase(e.target.checked); setPrev(null); }} /> Respeitar maiúsculas</label>
        </div>

        {prev && (prev.total === 0 ? <p className="rounded-xl border border-line bg-sunk/40 p-3 text-sm text-muted">Não encontrei “{from}” em nenhum lugar.</p> : (
          <div className="space-y-3">
            <p className="text-sm"><b>{prev.total}</b> ocorrência{prev.total === 1 ? "" : "s"} em <b>{prev.rows}</b> linha{prev.rows === 1 ? "" : "s"}:</p>
            <ul className="space-y-2">
              {prev.targets.map((t) => (
                <li key={t.key} className="rounded-xl border border-line bg-sunk/40 p-3 text-sm">
                  <p className="font-semibold">{t.label} <span className="font-normal text-muted">· {t.rows} linha{t.rows === 1 ? "" : "s"} · {t.hits} troca{t.hits === 1 ? "" : "s"}</span></p>
                  <ul className="mt-1.5 space-y-1 text-xs">
                    {t.samples.map((s) => <li key={String(s.id)} className="grid gap-1 sm:grid-cols-2"><span className="rounded-lg bg-danger/10 px-2 py-1 text-ink/80 line-through decoration-danger/50">{s.before}</span><span className="rounded-lg bg-ok/10 px-2 py-1">{s.after}</span></li>)}
                  </ul>
                </li>
              ))}
            </ul>
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => setConfirm(true)}><Replace size={15} aria-hidden /> Trocar tudo</button>
          </div>
        ))}

        {swaps.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Trocas recentes</h3>
            <ul className="space-y-1.5 text-sm">
              {swaps.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sunk/40 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate"><b>{s.from}</b> <ArrowRight size={12} className="inline text-muted" aria-hidden /> <b>{s.to}</b> <span className="text-muted">· {s.rows} linha{s.rows === 1 ? "" : "s"} · {fmt.format(new Date(s.at))}</span></span>
                  {s.undone ? <span className="text-xs text-muted">desfeita</span> : <button type="button" className={btnGhost} disabled={pending} onClick={() => setUndo(s)}><Undo2 size={14} aria-hidden /> Desfazer</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={`${panelCls} space-y-3 p-5`}>
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><ShieldAlert size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-lg">Nomes aposentados</h2>
            <p className="text-sm text-muted">Estes nomes não podem mais aparecer no sistema. Um teste automático confere o código a cada mudança e avisa se algum voltar.</p>
          </div>
        </header>
        <ul className="flex flex-wrap gap-2 text-sm">
          {RETIRED.map((r) => <li key={r.text} className="rounded-full border border-line bg-sunk/40 px-3 py-1"><span className="text-muted line-through">{r.text}</span> <ArrowRight size={12} className="inline text-muted" aria-hidden /> <b>{r.use}</b></li>)}
        </ul>
      </section>

      <ConfirmDialog open={confirm} title={`Trocar “${from.trim()}” por “${to.trim()}”?`} confirmLabel="Sim, trocar tudo" tone="warn" busy={pending} onConfirm={apply} onCancel={() => setConfirm(false)}>
        {prev ? `${prev.total} ocorrência(s) em ${prev.rows} linha(s). Você poderá desfazer depois, em “Trocas recentes”.` : ""}
      </ConfirmDialog>
      <ConfirmDialog open={!!undo} title="Desfazer esta troca?" confirmLabel="Desfazer" busy={pending} onConfirm={doUndo} onCancel={() => setUndo(null)}>
        {undo ? `Volta “${undo.to}” para “${undo.from}” nas ${undo.rows} linha(s) que mudaram. Linhas editadas depois ficam como estão.` : ""}
      </ConfirmDialog>
    </div>
  );
}
