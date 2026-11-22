"use client";

import { Anchor, Building2, Car, Check, ChevronDown, Cog, Factory, Filter, Hammer, Map as MapIcon, MapPin, Phone, Play, Plus, Power, Search, Sparkles, Store, Target, Trash2, Truck, UserRound, Wand2, Wrench, X, AtSign, Flame, Radar, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FlashTag } from "@/components/attend-final";
import { HScroll } from "@/components/h-scroll";
import { describeFilters, EMPTY_FILTERS, SEGMENT_WORDS, UFS, type ListFilters } from "@/config/lists";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { deleteListAction, previewListAction, saveListAction, setActiveListAction, type ListPreview } from "@/modules/lists/actions";
import type { ListKind, ListRow } from "@/modules/lists/queries";

type TagGroup = { key: string; name: string; tags: { key: string; label: string }[] };

const REGIONS: [string, string[]][] = [["Sul", ["PR", "SC", "RS"]], ["Sudeste", ["SP", "RJ", "MG", "ES"]], ["Centro-Oeste", ["DF", "GO", "MT", "MS"]], ["Nordeste", ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]], ["Norte", ["AC", "AP", "AM", "PA", "RO", "RR", "TO"]]];
const SEG_VISUAL: Record<string, { Icon: LucideIcon; hex: string }> = {
  posto_molas: { Icon: Cog, hex: "#f59e0b" }, auto_center: { Icon: Car, hex: "#0ea5e9" }, parafusos: { Icon: Anchor, hex: "#8b5cf6" }, ferramentas: { Icon: Hammer, hex: "#ef4444" },
  concessionaria: { Icon: Store, hex: "#14b8a6" }, industria: { Icon: Factory, hex: "#64748b" }, implementos: { Icon: Truck, hex: "#22c55e" }, auto_pecas: { Icon: Wrench, hex: "#ec4899" },
};
const IDEAS: { title: string; hint: string; Icon: LucideIcon; hex: string; f: Partial<ListFilters> }[] = [
  { title: "Prontos para ligar", hint: "Com telefone e nunca contatados", Icon: Phone, hex: "#22c55e", f: { phone: true, untouched: true } },
  { title: "Lista premium", hint: "Telefone, e-mail e contato já descobertos", Icon: Sparkles, hex: "#f59e0b", f: { phone: true, email: true, person: true } },
  { title: "Postos de molas", hint: "O segmento que mais compra", Icon: Cog, hex: "#ef4444", f: { segments: ["posto_molas"], phone: true } },
  { title: "Auto centers com e-mail", hint: "Dá para mandar e-mail antes de ligar", Icon: Car, hex: "#0ea5e9", f: { segments: ["auto_center"], email: true } },
];
const toggleIn = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

/** Número que "rola" até o valor novo. */
function useCount(target: number) {
  const [n, setN] = useState(target); const from = useRef(target);
  useEffect(() => {
    const a = from.current; const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / 500); setN(Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); else from.current = target; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`lift rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${on ? "border-accent bg-accent text-on-accent shadow-sm" : "border-line bg-sunk/60 text-muted hover:text-ink"}`}>{children}</button>;
}

function Block({ n, icon: I, title, hint, badge, children, open: o = true }: { n: number; icon: LucideIcon; title: string; hint: string; badge?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(o);
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-panel shadow-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-sunk/40">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow"><I size={19} aria-hidden /></span>
        <span className="min-w-0 flex-1 leading-tight"><span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Passo {n}</span><span className="block font-bold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
        {badge && <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">{badge}</span>}
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="card-in space-y-3 border-t border-line p-4">{children}</div>}
    </section>
  );
}

export function ListFlow({ kind, lists, tagGroups }: { kind: ListKind; lists: ListRow[]; tagGroups: TagGroup[] }) {
  const [f, setF] = useState<ListFilters>(EMPTY_FILTERS);
  const [editId, setEditId] = useState<number | undefined>();
  const [name, setName] = useState("");
  const [pv, setPv] = useState<ListPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const seq = useRef(0);
  const key = JSON.stringify(f);
  const total = useCount(pv?.count ?? 0);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => { previewListAction(kind, f).then((r) => { if (n === seq.current) { setPv(r); setLoading(false); } }).catch(() => n === seq.current && setLoading(false)); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind]);

  const jump = () => document.getElementById("lf-build")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const edit = (l: ListRow) => { setF(l.filters); setEditId(l.id); setName(l.name); jump(); };
  const reset = () => { setF(EMPTY_FILTERS); setEditId(undefined); setName(""); };
  const save = (activate: boolean) => run(() => saveListAction({ id: editId, kind, name, filters: f, activate }), undefined, reset);
  const summary = describeFilters(f);
  const set = <K extends keyof ListFilters>(k: K, v: ListFilters[K]) => setF({ ...f, [k]: v });
  const tagChips = tagGroups.flatMap((g) => g.tags.map((t) => ({ v: `${g.key}:${t.key}`, label: t.label })));
  const quality = [f.phone, f.email, f.person, f.untouched].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho vivo */}
      <section className="aurora relative overflow-hidden rounded-3xl bg-grad p-5 text-on-accent shadow-lg sm:p-7">
        <span aria-hidden className="aurora-blob a" /><span aria-hidden className="aurora-blob b" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="grid size-16 place-items-center rounded-3xl bg-white/20 backdrop-blur"><Radar size={32} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Lista Flow</p>
            <h2 className="display text-2xl sm:text-3xl">Monte a fila certa para o Shuffler</h2>
            <p className="mt-1 max-w-xl text-sm opacity-90">Escolha onde, quem e quão completo. A lista se atualiza enquanto você mexe.</p>
          </div>
          <div className="text-right" aria-live="polite"><p className="figure text-5xl font-extrabold leading-none sm:text-6xl">{total.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider opacity-85">{loading ? "contando…" : "leads disponíveis"}</p></div>
        </div>
      </section>

      {/* Minhas listas */}
      {lists.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Filter size={16} aria-hidden className="text-accent" /> Minhas listas</h2>
          <HScroll className="flex gap-3 pb-2">
            {lists.map((l) => (
              <article key={l.id} className={`lift relative w-72 shrink-0 space-y-2 overflow-hidden rounded-3xl border bg-panel p-4 shadow-sm ${l.active ? "border-accent ring-2 ring-accent/50" : "border-line"}`}>
                <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${l.active ? "bg-grad" : "bg-line"}`} />
                <div className="flex items-start gap-2 pt-1"><p className="min-w-0 flex-1 truncate font-bold">{l.name}</p>{l.active && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">No Shuffler</span>}</div>
                <p className="figure text-3xl">{l.count.toLocaleString("pt-BR")} <span className="text-sm font-normal text-muted">leads</span></p>
                <p className="line-clamp-2 min-h-8 text-xs text-muted">{describeFilters(l.filters).join(" · ") || "Sem filtros"}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={l.active ? btnGhost : btnPrimary} disabled={pending || (!l.active && l.count === 0)} onClick={() => run(() => setActiveListAction(kind, l.active ? null : l.id))}>{l.active ? <><Power size={14} aria-hidden /> Desativar</> : <><Play size={14} aria-hidden /> Ativar</>}</button>
                  <button type="button" className={btnGhost} onClick={() => edit(l)}>Editar</button>
                  <button type="button" aria-label="Excluir lista" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir esta lista?", body: `A lista "${l.name}" será excluída. Os leads continuam onde estão.`, label: "Excluir", tone: "danger", onConfirm: () => run(() => deleteListAction(kind, l.id)) })}><Trash2 size={14} aria-hidden /></button>
                </div>
              </article>
            ))}
          </HScroll>
        </section>
      )}

      {/* Ideias prontas */}
      <section className="space-y-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} aria-hidden className="text-accent" /> Comece por uma ideia pronta</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {IDEAS.map((i) => (
            <button key={i.title} type="button" onClick={() => { setF({ ...EMPTY_FILTERS, phone: false, ...i.f }); setEditId(undefined); jump(); }} className="lift group flex items-center gap-3 rounded-2xl border border-line bg-panel p-3 text-left shadow-sm">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow transition group-hover:scale-110" style={{ background: i.hex }}><i.Icon size={20} aria-hidden /></span>
              <span className="min-w-0 leading-tight"><b className="block text-sm">{i.title}</b><span className="block text-xs text-muted">{i.hint}</span></span>
            </button>
          ))}
        </div>
      </section>

      <div id="lf-build" className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-4">
          <Block n={1} icon={MapIcon} title="Onde" hint="Estados e cidade (vazio = Brasil todo)" badge={f.ufs.length || f.city ? `${f.ufs.length} estado${f.ufs.length === 1 ? "" : "s"}${f.city ? " + cidade" : ""}` : undefined}>
            <div className="space-y-2.5">
              {REGIONS.map(([r, list]) => {
                const all = list.every((u) => f.ufs.includes(u));
                return (
                  <div key={r} className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => set("ufs", all ? f.ufs.filter((u) => !list.includes(u)) : [...new Set([...f.ufs, ...list])])} className={`w-28 rounded-xl px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide transition ${all ? "bg-accent text-on-accent" : "bg-sunk text-muted hover:text-ink"}`}>{r}</button>
                    {list.map((u) => <Chip key={u} on={f.ufs.includes(u)} onClick={() => set("ufs", toggleIn(f.ufs, u))}>{u}</Chip>)}
                  </div>
                );
              })}
            </div>
            <label className="relative block text-sm font-medium">Cidade (opcional)<Search size={15} aria-hidden className="pointer-events-none absolute bottom-3 left-3 text-muted" /><input className={`${inputCls} !pl-9`} value={f.city} maxLength={60} onChange={(e) => set("city", e.target.value)} placeholder="Ex.: Campinas" /></label>
            {UFS.length > 0 && f.ufs.length > 0 && <button type="button" className={btnGhost} onClick={() => set("ufs", [])}><X size={14} aria-hidden /> Limpar estados</button>}
          </Block>

          <Block n={2} icon={Store} title="Quem" hint="Tipo de empresa, palavras suas e porte" badge={f.segments.length + (f.words ? 1 : 0) + f.tags.length ? `${f.segments.length + (f.words ? 1 : 0) + f.tags.length} filtros` : undefined}>
            <p className="text-xs text-muted">O sistema procura no nome e na atividade (CNAE) da Receita.</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Object.entries(SEGMENT_WORDS).map(([k, v]) => {
                const vis = SEG_VISUAL[k] ?? { Icon: Building2, hex: "#64748b" }; const on = f.segments.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => set("segments", toggleIn(f.segments, k))} className="lift relative flex flex-col items-start gap-2 rounded-2xl border-2 p-3 text-left transition active:scale-[.97]" style={on ? { borderColor: vis.hex, background: `color-mix(in srgb, ${vis.hex} 14%, var(--panel))` } : { borderColor: "var(--line)", background: "var(--sunk)" }}>
                    <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: on ? vis.hex : "color-mix(in srgb, var(--muted) 55%, transparent)" }}><vis.Icon size={18} aria-hidden /></span>
                    <span className="text-sm font-bold leading-tight">{v.label}</span>
                    {on && <span aria-hidden className="absolute right-2 top-2 grid size-5 place-items-center rounded-full text-white" style={{ background: vis.hex }}><Check size={12} /></span>}
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-medium">Palavras suas (separe por vírgula)<input className={inputCls} value={f.words} maxLength={120} onChange={(e) => set("words", e.target.value)} placeholder="Ex.: truck, freios, rolamentos" /></label>
            {tagGroups.map((g) => (
              <div key={g.key} className="space-y-1.5"><p className="text-sm font-bold">{g.name}</p><div className="flex flex-wrap gap-1.5">{g.tags.map((t) => { const v = `${g.key}:${t.key}`; return <Chip key={v} on={f.tags.includes(v)} onClick={() => set("tags", toggleIn(f.tags, v))}>{t.label}</Chip>; })}</div></div>
            ))}
          </Block>

          <Block n={3} icon={Target} title="Qualidade" hint="Quanto o lead já traz de informação" badge={quality ? `${quality} ligado${quality === 1 ? "" : "s"}` : undefined}>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <FlashTag label="Com telefone" color="#22c55e" on={f.phone} onClick={() => set("phone", !f.phone)} Comp={Phone} />
              <FlashTag label="Com e-mail" color="#6366f1" on={f.email} onClick={() => set("email", !f.email)} Comp={AtSign} />
              <FlashTag label="Com nome de contato" color="#f59e0b" on={f.person} onClick={() => set("person", !f.person)} Comp={UserRound} />
              <FlashTag label="Nunca contatados" color="#ef4444" on={f.untouched} onClick={() => set("untouched", !f.untouched)} Comp={Flame} />
            </div>
            <fieldset className="space-y-1.5"><legend className="text-sm font-bold">Consulta de CNPJ</legend>
              <div className="inline-flex rounded-xl bg-sunk p-1" role="radiogroup">
                {([["any", "Tanto faz"], ["yes", "Só consultados"], ["no", "Só não consultados"]] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={f.enriched === v} onClick={() => set("enriched", v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${f.enriched === v ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>)}
              </div>
            </fieldset>
          </Block>
        </div>

        {/* Painel da lista (fica à vista) */}
        <aside className="space-y-3 rounded-3xl border border-line bg-panel p-4 shadow-md lg:sticky lg:top-20" aria-label="Sua lista">
          <div className="flex items-center gap-2"><Wand2 size={18} aria-hidden className="text-accent" /><h2 className="flex-1 font-bold">{editId ? "Editando lista" : "Sua lista"}</h2>{(editId || summary.length > 0) && <button type="button" className="text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline" onClick={reset}>Recomeçar</button>}</div>
          <p className="figure text-4xl font-extrabold" aria-live="polite">{total.toLocaleString("pt-BR")}<span className="ml-1.5 text-sm font-normal text-muted">{loading ? "contando…" : "leads"}</span></p>
          <div className="flex flex-wrap gap-1.5">
            {f.ufs.map((u) => <Tag key={u} onX={() => set("ufs", toggleIn(f.ufs, u))}><MapPin size={11} aria-hidden /> {u}</Tag>)}
            {f.city && <Tag onX={() => set("city", "")}>{f.city}</Tag>}
            {f.segments.map((s) => <Tag key={s} onX={() => set("segments", toggleIn(f.segments, s))}>{SEGMENT_WORDS[s]?.label}</Tag>)}
            {f.words && <Tag onX={() => set("words", "")}>“{f.words}”</Tag>}
            {f.tags.map((t) => <Tag key={t} onX={() => set("tags", toggleIn(f.tags, t))}>{tagChips.find((c) => c.v === t)?.label ?? t}</Tag>)}
            {f.phone && <Tag onX={() => set("phone", false)}>Telefone</Tag>}{f.email && <Tag onX={() => set("email", false)}>E-mail</Tag>}{f.person && <Tag onX={() => set("person", false)}>Contato</Tag>}{f.untouched && <Tag onX={() => set("untouched", false)}>Nunca contatados</Tag>}
            {f.enriched !== "any" && <Tag onX={() => set("enriched", "any")}>{f.enriched === "yes" ? "CNPJ consultado" : "CNPJ não consultado"}</Tag>}
            {summary.length === 0 && <span className="text-xs text-muted">Sem filtros: todos os leads disponíveis.</span>}
          </div>
          <ul className="space-y-1.5">
            {(pv?.sample ?? []).map((s) => <li key={s.id} className="flex items-center gap-2 rounded-xl border border-line bg-sunk/50 px-3 py-2 text-sm"><Store size={14} aria-hidden className="shrink-0 text-accent" /><span className="min-w-0 flex-1 truncate">{s.name}</span><span className="shrink-0 text-xs text-muted">{s.where}</span></li>)}
            {pv && pv.sample.length === 0 && <li className="text-sm text-muted">Nenhum lead com esses filtros. Afrouxe algum.</li>}
          </ul>
          {(pv?.sample.length ?? 0) > 0 && <p className="text-[11px] text-muted">Exemplos sorteados. A cada abertura aparecem outros.</p>}
          <label className="block text-sm font-medium">Nome da lista<input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Postos de molas de SP" /></label>
          <div className="grid gap-2">
            <button type="button" className={btnPrimary} disabled={pending || !pv || pv.count === 0} onClick={() => save(true)}><Play size={15} aria-hidden /> Salvar e ativar no Shuffler</button>
            <button type="button" className={btnGhost} disabled={pending} onClick={() => save(false)}><Plus size={15} aria-hidden /> Só salvar</button>
          </div>
        </aside>
      </div>
      {dialog}
    </div>
  );
}

function Tag({ children, onX }: { children: React.ReactNode; onX: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-accent">{children}<button type="button" aria-label="Remover filtro" onClick={onX} className="grid size-4 place-items-center rounded-full hover:bg-accent/20"><X size={11} aria-hidden /></button></span>;
}
