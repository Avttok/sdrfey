"use client";

import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Preferências de tela das negociações. Ficam guardadas no aparelho da pessoa (cada um deixa do seu jeito).
 * Sem armazenamento disponível, vale o padrão e nada quebra.
 */
export type CardField = "contact" | "talked" | "note" | "counts" | "next" | "marks" | "seller" | "quick";
export type ColKey = "novo" | "contato" | "cotacao" | "ganho";
export type BlockKey = "resumo" | "kpis" | "funil";
export type DetailKey = "meta" | "kpis" | "andamento" | "fechamento" | "cotacoes" | "registros";
export type Prefs = { density: "conforto" | "compacto"; card: Record<CardField, boolean>; cols: Record<ColKey, boolean>; blocks: Record<BlockKey, boolean>; detail: Record<DetailKey, boolean>; detailCols: 1 | 2 };

export const CARD_FIELDS: [CardField, string][] = [["contact", "Cidade, telefone e cotação"], ["talked", "Com quem o SDR falou"], ["note", "Recado do SDR"], ["counts", "Contagem de contatos, cotações e visitas"], ["next", "Retorno combinado"], ["marks", "Marcadores (Site, Redes, Celular…)"], ["seller", "Vendedor e valor no rodapé"], ["quick", "Atalhos (WhatsApp, Site, Lead)"]];
export const COLS: [ColKey, string][] = [["novo", "Novo"], ["contato", "Em contato"], ["cotacao", "Cotação enviada"], ["ganho", "Faturado no mês"]];
export const BLOCKS: [BlockKey, string][] = [["resumo", "Resumo (valor em aberto e faturado)"], ["kpis", "Quatro indicadores"], ["funil", "Funil em aberto"]];
export const DETAILS: [DetailKey, string][] = [["meta", "Metas do vendedor"], ["kpis", "Indicadores da negociação"], ["andamento", "Andamento"], ["fechamento", "Fechamento"], ["cotacoes", "Cotações"], ["registros", "Registros do cliente"]];

const all = <K extends string>(keys: readonly K[], v = true) => Object.fromEntries(keys.map((k) => [k, v])) as Record<K, boolean>;
export const DEFAULT_PREFS: Prefs = {
  density: "conforto",
  card: all(CARD_FIELDS.map(([k]) => k)),
  cols: all(COLS.map(([k]) => k)),
  blocks: all(BLOCKS.map(([k]) => k)),
  detail: all(DETAILS.map(([k]) => k)),
  detailCols: 2,
};

const KEY = "neg-prefs-v2";
const listeners = new Set<() => void>();
let raw: string | null = null;
let cache: Prefs = DEFAULT_PREFS;

const merge = (p: Partial<Prefs> | null): Prefs => ({
  density: p?.density === "compacto" ? "compacto" : "conforto",
  card: { ...DEFAULT_PREFS.card, ...(p?.card ?? {}) }, cols: { ...DEFAULT_PREFS.cols, ...(p?.cols ?? {}) },
  blocks: { ...DEFAULT_PREFS.blocks, ...(p?.blocks ?? {}) }, detail: { ...DEFAULT_PREFS.detail, ...(p?.detail ?? {}) },
  detailCols: p?.detailCols === 1 ? 1 : 2,
});
function read(): Prefs {
  let r: string | null = null;
  try { r = localStorage.getItem(KEY); } catch { /* sem armazenamento */ }
  if (r !== raw) { raw = r; try { cache = merge(r ? JSON.parse(r) : null); } catch { cache = DEFAULT_PREFS; } }
  return cache;
}
function write(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignora */ }
  raw = null; cache = p;
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => { listeners.add(cb); const on = (e: StorageEvent) => { if (e.key === KEY) cb(); }; window.addEventListener("storage", on); return () => { listeners.delete(cb); window.removeEventListener("storage", on); }; };

export function useDealPrefs(): [Prefs, (fn: (p: Prefs) => Prefs) => void, () => void] {
  const p = useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
  return [p, (fn) => write(fn(read())), () => write(DEFAULT_PREFS)];
}

/** Esconde o bloco (feito no servidor) quando a pessoa desligou. */
export function PrefBlock({ id, children }: { id: BlockKey; children: React.ReactNode }) {
  const [p] = useDealPrefs();
  return p.blocks[id] ? <>{children}</> : null;
}
export function PrefDetail({ id, children }: { id: DetailKey; children: React.ReactNode }) {
  const [p] = useDealPrefs();
  return p.detail[id] ? <>{children}</> : null;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-0.5"><p className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>{children}</div>;
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-sunk/70">
      <span>{label}</span>
      <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-grad" : "bg-line"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[1.1rem]" : "left-0.5"}`} /></span>
    </button>
  );
}

/** Botão "Personalizar": abre um painel em vidro com tudo o que a pessoa pode ligar e desligar. */
export function DealPrefsMenu({ scope }: { scope: "lista" | "negociacao" }) {
  const [p, set, reset] = useDealPrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} className="card-surface card-edge inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition hover:-translate-y-0.5"><SlidersHorizontal size={16} className="text-accent" aria-hidden /> Personalizar</button>
      {open && (
        <div role="dialog" aria-label="Personalizar a tela" className="card-surface card-edge absolute right-0 top-full z-50 mt-2 max-h-[min(34rem,75dvh)] w-[min(22rem,92vw)] overflow-y-auto rounded-2xl p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2.5 py-1.5"><p className="display text-base">Personalizar</p><button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-sunk"><X size={16} aria-hidden /></button></div>
          <p className="px-2.5 pb-1 text-xs text-muted">Fica salvo neste aparelho, só para você.</p>
          {scope === "lista" ? (
            <>
              <Group title="Tamanho dos cartões">
                <div role="radiogroup" aria-label="Densidade" className="mx-2.5 grid grid-cols-2 gap-1 rounded-xl bg-sunk p-1 text-sm font-medium">
                  {(["conforto", "compacto"] as const).map((d) => <button key={d} type="button" role="radio" aria-checked={p.density === d} onClick={() => set((x) => ({ ...x, density: d }))} className={`rounded-lg px-3 py-1.5 transition ${p.density === d ? "bg-panel text-accent shadow-sm" : "text-muted"}`}>{d === "conforto" ? "Confortável" : "Compacto"}</button>)}
                </div>
              </Group>
              <Group title="O que aparece no cartão">{CARD_FIELDS.map(([k, l]) => <Toggle key={k} on={p.card[k]} label={l} onChange={(v) => set((x) => ({ ...x, card: { ...x.card, [k]: v } }))} />)}</Group>
              <Group title="Colunas do quadro">{COLS.map(([k, l]) => <Toggle key={k} on={p.cols[k]} label={l} onChange={(v) => set((x) => ({ ...x, cols: { ...x.cols, [k]: v } }))} />)}</Group>
              <Group title="Blocos do topo">{BLOCKS.map(([k, l]) => <Toggle key={k} on={p.blocks[k]} label={l} onChange={(v) => set((x) => ({ ...x, blocks: { ...x.blocks, [k]: v } }))} />)}</Group>
            </>
          ) : (
            <>
              <Group title="Colunas">
                <div role="radiogroup" aria-label="Colunas" className="mx-2.5 grid grid-cols-2 gap-1 rounded-xl bg-sunk p-1 text-sm font-medium">
                  {([1, 2] as const).map((n) => <button key={n} type="button" role="radio" aria-checked={p.detailCols === n} onClick={() => set((x) => ({ ...x, detailCols: n }))} className={`rounded-lg px-3 py-1.5 transition ${p.detailCols === n ? "bg-panel text-accent shadow-sm" : "text-muted"}`}>{n === 1 ? "Uma coluna" : "Duas colunas"}</button>)}
                </div>
              </Group>
              <Group title="Seções">{DETAILS.map(([k, l]) => <Toggle key={k} on={p.detail[k]} label={l} onChange={(v) => set((x) => ({ ...x, detail: { ...x.detail, [k]: v } }))} />)}</Group>
            </>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-line/70 px-2.5 pt-2"><button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><RotateCcw size={14} aria-hidden /> Voltar ao padrão</button><button type="button" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-grad px-3 py-1.5 text-sm font-semibold text-on-accent"><Check size={14} aria-hidden /> Pronto</button></div>
        </div>
      )}
    </div>
  );
}
