"use client";

import { Anchor, Building2, Calendar, Car, Check, ChevronDown, Clock, Cog, Factory, Filter, Hammer, Map as MapIcon, MapPin, MessageCircle, Pencil, Phone, Play, Plus, Power, RotateCcw, Rocket, Search, Share2, Shuffle, Smartphone, Sparkles, Store, Target, Trash2, Truck, UserRound, Wand2, Wrench, X, AtSign, Flame, Radar, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FlashTag } from "@/components/attend-final";
import { HScroll } from "@/components/h-scroll";
import { describeFilters, EMPTY_FILTERS, LIST_COLORS, LIST_ICON_KEYS, LIST_MAX_LEADS, LIST_MAX_PER_USER, SEGMENT_WORDS, UFS, type ListFilters } from "@/config/lists";
import { MetricRing } from "@/components/dash-ui";
import { listIcon } from "@/components/list-visual";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { claimSharedListAction, deleteListAction, previewListAction, saveListAction, setActiveListAction, shareListAction, zeroListAction, type ListPreview } from "@/modules/lists/actions";
import type { ListKind, ListRow, SharedRow } from "@/modules/lists/queries";

type TagGroup = { key: string; name: string; tags: { key: string; label: string }[] };

const REGIONS: [string, string[]][] = [["Sul", ["PR", "SC", "RS"]], ["Sudeste", ["SP", "RJ", "MG", "ES"]], ["Centro-Oeste", ["DF", "GO", "MT", "MS"]], ["Nordeste", ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]], ["Norte", ["AC", "AP", "AM", "PA", "RO", "RR", "TO"]]];
const SEG_VISUAL: Record<string, { Icon: LucideIcon; hex: string }> = {
  posto_molas: { Icon: Cog, hex: "#f59e0b" }, auto_center: { Icon: Car, hex: "#0ea5e9" }, parafusos: { Icon: Anchor, hex: "#8b5cf6" }, ferramentas: { Icon: Hammer, hex: "#ef4444" },
  concessionaria: { Icon: Store, hex: "#14b8a6" }, industria: { Icon: Factory, hex: "#64748b" }, implementos: { Icon: Truck, hex: "#22c55e" }, auto_pecas: { Icon: Wrench, hex: "#ec4899" },
};
const IDEAS: { title: string; hint: string; Icon: LucideIcon; hex: string; icon: string; f: Partial<ListFilters> }[] = [
  { title: "Prontos para ligar", hint: "Com telefone e nunca contatados", Icon: Phone, hex: "#22c55e", icon: "phone", f: { phone: true, untouched: true } },
  { title: "Lista premium", hint: "Telefone, e-mail e contato já descobertos", Icon: Sparkles, hex: "#f59e0b", icon: "gem", f: { phone: true, email: true, person: true } },
  { title: "Postos de molas", hint: "O segmento que mais compra", Icon: Cog, hex: "#ef4444", icon: "wrench", f: { segments: ["posto_molas"], phone: true } },
  { title: "Auto centers com e-mail", hint: "Dá para mandar e-mail antes de ligar", Icon: Car, hex: "#0ea5e9", icon: "target", f: { segments: ["auto_center"], email: true } },
  { title: "Leads quentes", hint: "Já demonstraram interesse", Icon: Flame, hex: "#f97316", icon: "flame", f: { tags: ["temperatura:quente"], phone: true } },
  { title: "Reativação", hint: "Consultados e sem contato há 90 dias", Icon: Zap, hex: "#8b5cf6", icon: "zap", f: { enriched: "yes", quiet: 90, phone: true } },
  { title: "Empresas novas", hint: "Abertas há menos de 2 anos e ativas", Icon: Rocket, hex: "#ec4899", icon: "rocket", f: { age: "new", active: true, phone: true } },
  { title: "WhatsApp na mão", hint: "Com celular e nunca contatados", Icon: MessageCircle, hex: "#14b8a6", icon: "phone", f: { mobile: true, untouched: true } },
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

const grad = (hex: string) => `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))`;
const soft = (hex: string, a = 20, b = 5) => `linear-gradient(145deg, color-mix(in srgb, ${hex} ${a}%, var(--panel)), color-mix(in srgb, ${hex} ${b}%, var(--panel)) 70%)`;

function Block({ n, icon: I, title, hint, badge, hex = "#6366f1", children, open: o = true }: { n: number; icon: LucideIcon; title: string; hint: string; badge?: string; hex?: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(o);
  return (
    <section className="relative overflow-hidden rounded-3xl border-2 shadow-sm" style={{ background: soft(hex, 10, 3), borderColor: `color-mix(in srgb, ${hex} 35%, transparent)` }}>
      <I aria-hidden size={110} strokeWidth={1.3} className="pointer-events-none absolute -right-4 -top-5 rotate-12 opacity-[.07]" style={{ color: hex }} />
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="relative flex w-full items-center gap-3 p-4 text-left transition hover:bg-sunk/30">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: grad(hex), boxShadow: `0 8px 20px -8px ${hex}` }}><I size={21} aria-hidden /></span>
        <span className="min-w-0 flex-1 leading-tight"><span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Passo {n}</span><span className="block font-bold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
        {badge && <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: hex }}>{badge}</span>}
        <ChevronDown size={18} aria-hidden className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="card-in relative space-y-3 border-t border-line/60 p-4">{children}</div>}
    </section>
  );
}

const Seg = <T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) => (
  <div className="inline-flex flex-wrap rounded-xl bg-sunk p-1" role="radiogroup" aria-label={label}>
    {options.map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === v ? "bg-panel font-bold text-accent shadow" : "text-muted hover:text-ink"}`}>{l}</button>)}
  </div>
);

/** Carta de uma lista: cor e ícone escolhidos por quem criou, anel com os leads ainda livres e as ações à mão. */
function ListCard({ l, i, pending, onEdit, run, ask, kind }: { l: ListRow; i: number; pending: boolean; onEdit: () => void; run: ReturnType<typeof useRun>["run"]; ask: ReturnType<typeof useConfirm>["ask"]; kind: ListKind }) {
  const hex = l.filters.color; const Icon = listIcon(l.filters.icon);
  const left = l.total ? (l.count / l.total) * 100 : 0;
  return (
    <article style={{ "--i": i, background: soft(hex, l.active ? 28 : 18, l.active ? 8 : 4), borderColor: `color-mix(in srgb, ${hex} ${l.active ? 80 : 45}%, transparent)`, boxShadow: l.active ? `0 14px 34px -16px ${hex}` : undefined } as React.CSSProperties} className="card-in group relative flex min-h-[15rem] flex-col gap-3 overflow-hidden rounded-3xl border-2 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <Icon aria-hidden size={130} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-5 -rotate-12 opacity-[.12] transition duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:opacity-20" style={{ color: hex }} />
      <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 size-32 rounded-full opacity-30 blur-2xl" style={{ background: hex }} />
      <div className="relative flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white transition duration-200 group-hover:scale-110 group-hover:-rotate-3" style={{ background: grad(hex), boxShadow: `0 8px 20px -8px ${hex}` }}><Icon size={24} aria-hidden /></span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold leading-tight">{l.name}</p><div className="mt-1 flex flex-wrap gap-1">
          {l.active && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: hex }}><span className="size-1.5 animate-pulse rounded-full bg-white" /> No Shuffler</span>}
          {l.shared && <span className="rounded-full bg-warn/20 px-2 py-0.5 text-[11px] font-bold text-warn">Compartilhada</span>}
        </div></div>
        <span className="relative"><MetricRing value={left} color={hex} size="size-14" /><span className="figure absolute inset-0 grid place-items-center text-[11px] font-extrabold">{Math.round(left)}%</span></span>
      </div>
      <p className="figure relative text-3xl font-extrabold leading-none">{l.count.toLocaleString("pt-BR")} <span className="text-sm font-normal text-muted">de {l.total.toLocaleString("pt-BR")} leads livres</span></p>
      <p className="relative line-clamp-2 min-h-8 text-xs text-muted">{describeFilters(l.filters).join(" · ") || "Sem filtros"}</p>
      <div className="relative mt-auto flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={pending || l.shared || (!l.active && l.count === 0)} onClick={() => run(() => setActiveListAction(kind, l.active ? null : l.id))} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-white shadow transition active:scale-95 disabled:opacity-50" style={{ background: l.active ? "color-mix(in srgb, var(--muted) 70%, #000)" : grad(hex) }}>{l.active ? <><Power size={14} aria-hidden /> Desativar</> : <><Play size={14} aria-hidden /> Ativar no Shuffler</>}</button>
        <span className="flex-1" />
        <IconBtn label="Editar" onClick={onEdit} I={Pencil} />
        {l.total > 0 && (l.shared
          ? <IconBtn label="Cancelar compartilhamento" disabled={pending} onClick={() => run(() => shareListAction(kind, l.id, false))} I={Share2} on />
          : <IconBtn label="Compartilhar" disabled={pending} I={Share2} onClick={() => ask({ title: "Compartilhar esta lista?", body: `A lista "${l.name}" vai para a aba Compartilhadas e outra pessoa da sua área poderá resgatá-la. Seu espaço só é liberado depois que alguém resgatar.`, label: "Compartilhar", icon: Share2, onConfirm: () => run(() => shareListAction(kind, l.id, true)) })} />)}
        {l.total > 0 && <IconBtn label="Zerar" disabled={pending} I={RotateCcw} onClick={() => ask({ title: "Zerar esta lista?", body: `Os ${l.total} leads de "${l.name}" voltam a ficar livres e o espaço da lista é liberado. O nome e os filtros ficam guardados.`, label: "Zerar", tone: "warn", icon: RotateCcw, onConfirm: () => run(() => zeroListAction(kind, l.id)) })} />}
        <IconBtn label="Excluir" disabled={pending} I={Trash2} danger onClick={() => ask({ title: "Excluir esta lista?", body: `A lista "${l.name}" será excluída. Os leads reservados voltam a ficar livres.`, label: "Excluir", tone: "danger", icon: Trash2, onConfirm: () => run(() => deleteListAction(kind, l.id)) })} />
      </div>
    </article>
  );
}
function IconBtn({ I, label, onClick, disabled, danger, on }: { I: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; on?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`grid size-10 place-items-center rounded-xl border border-line bg-panel/80 transition hover:bg-sunk active:scale-95 disabled:opacity-50 ${danger ? "text-danger" : on ? "text-warn" : "text-muted hover:text-ink"}`}><I size={16} aria-hidden /></button>;
}

export function ListFlow({ kind, lists, tagGroups, used, shared }: { kind: ListKind; lists: ListRow[]; tagGroups: TagGroup[]; /** listas da pessoa nas duas áreas */ used: number; /** listas de outras pessoas para resgatar */ shared: SharedRow[] }) {
  const [f, setF] = useState<ListFilters>(EMPTY_FILTERS);
  const [editId, setEditId] = useState<number | undefined>();
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"montar" | "compartilhadas">("montar");
  const [pv, setPv] = useState<ListPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [mix, setMix] = useState(0);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const seq = useRef(0);
  // só os filtros que mudam a contagem; aparência, tamanho e ordem não precisam recontar
  const key = JSON.stringify({ ...f, color: 0, icon: 0, size: 0, order: 0 });
  const total = useCount(pv?.count ?? 0);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => { previewListAction(kind, f, editId).then((r) => { if (n === seq.current) { setPv(r); setLoading(false); } }).catch(() => n === seq.current && setLoading(false)); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, editId, mix]);

  const jump = () => document.getElementById("lf-build")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const edit = (l: ListRow) => { setF(l.filters); setEditId(l.id); setName(l.name); setTab("montar"); jump(); };
  const reset = () => { setF(EMPTY_FILTERS); setEditId(undefined); setName(""); };
  const save = (activate: boolean) => run(() => saveListAction({ id: editId, kind, name, filters: f, activate }), undefined, reset);
  const summary = describeFilters(f);
  const set = <K extends keyof ListFilters>(k: K, v: ListFilters[K]) => setF({ ...f, [k]: v });
  const tagChips = tagGroups.flatMap((g) => g.tags.map((t) => ({ v: `${g.key}:${t.key}`, label: t.label })));
  const full = !editId && used >= LIST_MAX_PER_USER;
  const quality = [f.phone, f.email, f.person, f.untouched].filter(Boolean).length;
  const fine = [f.active, f.mobile, f.age !== "any", f.quiet > 0].filter(Boolean).length;
  const reserved = Math.min(pv?.count ?? 0, f.size);
  const hex = f.color; const PIcon = listIcon(f.icon);

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
            <p className="mt-1 max-w-xl text-sm opacity-90">Cada lista vira uma carta no Shuffler. Escolha onde, quem e quão completo; a contagem se atualiza enquanto você mexe.</p>
            <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: LIST_MAX_PER_USER }, (_, i) => <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${i < used ? "bg-white text-black/80" : "bg-white/20"}`}><span className={`size-2 rounded-full ${i < used ? "bg-ok" : "bg-white/60"}`} /> {i < used ? "Espaço em uso" : "Espaço livre"}</span>)}</div>
          </div>
          <div className="text-right" aria-live="polite"><p className="figure text-5xl font-extrabold leading-none sm:text-6xl">{total.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider opacity-85">{loading ? "contando…" : "leads disponíveis"}</p></div>
        </div>
      </section>

      <div role="tablist" aria-label="Lista Flow" className="flex gap-1.5 rounded-2xl border border-line bg-panel p-1.5">
        {([["montar", "Minhas listas e montagem"], ["compartilhadas", `Compartilhadas${shared.length ? ` (${shared.length})` : ""}`]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === k ? "bg-accent text-on-accent shadow" : "text-muted hover:bg-sunk"}`}>{label}</button>
        ))}
      </div>

      {tab === "compartilhadas" ? (
        <section className="space-y-3" aria-label="Listas compartilhadas">
          <p className="max-w-2xl text-sm text-muted">Listas que colegas da sua área deixaram para outra pessoa assumir. Ao resgatar, a lista vira sua e libera o espaço de quem compartilhou. Você usa {used} de {LIST_MAX_PER_USER} listas.</p>
          {shared.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Nenhuma lista compartilhada agora.</p> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shared.map((l, i) => (
                <article key={l.id} style={{ "--i": i, background: soft("#f59e0b", 16, 4), borderColor: "color-mix(in srgb, #f59e0b 45%, transparent)" } as React.CSSProperties} className="card-in lift relative space-y-2 overflow-hidden rounded-3xl border-2 p-4">
                  <Share2 aria-hidden size={110} strokeWidth={1.3} className="pointer-events-none absolute -bottom-5 -right-4 -rotate-12 opacity-[.12]" style={{ color: "#f59e0b" }} />
                  <p className="relative truncate font-bold">{l.name}</p>
                  <p className="relative text-xs text-muted">Compartilhada por {l.owner}</p>
                  <p className="figure relative text-3xl font-extrabold">{l.count.toLocaleString("pt-BR")} <span className="text-sm font-normal text-muted">de {l.total.toLocaleString("pt-BR")} leads livres</span></p>
                  <button type="button" className={`${btnPrimary} relative`} disabled={pending || used >= LIST_MAX_PER_USER} onClick={() => run(() => claimSharedListAction(kind, l.id))}><Plus size={14} aria-hidden /> Resgatar lista</button>
                  {used >= LIST_MAX_PER_USER && <p className="relative text-[11px] text-muted">Seus {LIST_MAX_PER_USER} espaços estão ocupados. Exclua ou zere uma lista para resgatar.</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (<>
      {/* Minhas listas */}
      <section className="space-y-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Filter size={16} aria-hidden className="text-accent" /> Suas cartas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l, i) => <ListCard key={l.id} l={l} i={i} kind={kind} pending={pending} run={run} ask={ask} onEdit={() => edit(l)} />)}
          {(!full || lists.length === 0) && (
            <button type="button" onClick={() => { reset(); jump(); }} style={{ "--i": lists.length } as React.CSSProperties} className="card-in group flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-accent/50 bg-accent/5 p-4 text-center transition hover:-translate-y-0.5 hover:bg-accent/10">
              <span className="grid size-14 place-items-center rounded-2xl bg-grad text-on-accent shadow-lg transition group-hover:scale-110 group-hover:rotate-6"><Plus size={28} aria-hidden /></span>
              <span><b className="block">Nova lista</b><span className="text-xs text-muted">Até {LIST_MAX_LEADS} leads por lista</span></span>
            </button>
          )}
        </div>
      </section>

      {/* Ideias prontas */}
      <section className="space-y-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} aria-hidden className="text-accent" /> Comece por uma ideia pronta</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {IDEAS.map((i, n) => (
            <button key={i.title} type="button" onClick={() => { setF({ ...EMPTY_FILTERS, phone: false, ...i.f, color: LIST_COLORS.includes(i.hex) ? i.hex : nearest(i.hex), icon: i.icon }); setName(i.title); setEditId(undefined); jump(); }}
              style={{ "--i": n, background: soft(i.hex, 18, 4), borderColor: `color-mix(in srgb, ${i.hex} 45%, transparent)` } as React.CSSProperties} className="card-in group relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <i.Icon aria-hidden size={70} strokeWidth={1.4} className="pointer-events-none absolute -bottom-3 -right-2 -rotate-12 opacity-[.13] transition duration-300 group-hover:scale-110" style={{ color: i.hex }} />
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl text-white transition group-hover:scale-110 group-hover:-rotate-3" style={{ background: grad(i.hex), boxShadow: `0 8px 18px -8px ${i.hex}` }}><i.Icon size={20} aria-hidden /></span>
              <span className="relative min-w-0 leading-tight"><b className="block text-sm">{i.title}</b><span className="block text-xs text-muted">{i.hint}</span></span>
            </button>
          ))}
        </div>
      </section>

      <div id="lf-build" className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-4">
          <Block n={1} hex="#0ea5e9" icon={MapIcon} title="Onde" hint="Estados e cidade (vazio = Brasil todo)" badge={f.ufs.length || f.city ? `${f.ufs.length} estado${f.ufs.length === 1 ? "" : "s"}${f.city ? " + cidade" : ""}` : undefined}>
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

          <Block n={2} hex="#8b5cf6" icon={Store} title="Quem" hint="Tipo de empresa, palavras suas, porte e andamento" badge={f.segments.length + (f.words ? 1 : 0) + f.tags.length ? `${f.segments.length + (f.words ? 1 : 0) + f.tags.length} filtros` : undefined}>
            <p className="text-xs text-muted">O sistema procura no nome e na atividade (CNAE) da Receita.</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Object.entries(SEGMENT_WORDS).map(([k, v], n) => {
                const vis = SEG_VISUAL[k] ?? { Icon: Building2, hex: "#64748b" }; const on = f.segments.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => set("segments", toggleIn(f.segments, k))} style={{ "--i": n, background: on ? grad(vis.hex) : soft(vis.hex, 12, 3), borderColor: `color-mix(in srgb, ${vis.hex} ${on ? 90 : 35}%, transparent)`, boxShadow: on ? `0 10px 24px -12px ${vis.hex}` : undefined } as React.CSSProperties} className={`card-in group relative flex min-h-[6.5rem] flex-col items-start gap-2 overflow-hidden rounded-2xl border-2 p-3 text-left transition duration-200 hover:-translate-y-0.5 active:scale-[.97] ${on ? "text-white" : ""}`}>
                    <vis.Icon aria-hidden size={72} strokeWidth={1.4} className="pointer-events-none absolute -bottom-3 -right-2 -rotate-12 opacity-[.14] transition duration-300 group-hover:scale-110" style={{ color: on ? "#fff" : vis.hex }} />
                    <span className="relative grid size-9 place-items-center rounded-xl text-white" style={{ background: on ? "rgba(255,255,255,.25)" : grad(vis.hex) }}><vis.Icon size={18} aria-hidden /></span>
                    <span className="relative text-sm font-bold leading-tight">{v.label}</span>
                    {on && <span aria-hidden className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-white" style={{ color: vis.hex }}><Check size={12} /></span>}
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-medium">Palavras suas (separe por vírgula)<input className={inputCls} value={f.words} maxLength={120} onChange={(e) => set("words", e.target.value)} placeholder="Ex.: truck, freios, rolamentos" /></label>
            {tagGroups.map((g) => (
              <div key={g.key} className="space-y-1.5"><p className="text-sm font-bold">{g.name}</p><div className="flex flex-wrap gap-1.5">{g.tags.map((t) => { const v = `${g.key}:${t.key}`; return <Chip key={v} on={f.tags.includes(v)} onClick={() => set("tags", toggleIn(f.tags, v))}>{t.label}</Chip>; })}</div></div>
            ))}
          </Block>

          <Block n={3} hex="#22c55e" icon={Target} title="Qualidade" hint="Quanto o lead já traz de informação" badge={quality ? `${quality} ligado${quality === 1 ? "" : "s"}` : undefined}>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <FlashTag label="Com telefone" color="#22c55e" on={f.phone} onClick={() => set("phone", !f.phone)} Comp={Phone} />
              <FlashTag label="Com e-mail" color="#6366f1" on={f.email} onClick={() => set("email", !f.email)} Comp={AtSign} />
              <FlashTag label="Com nome de contato" color="#f59e0b" on={f.person} onClick={() => set("person", !f.person)} Comp={UserRound} />
              <FlashTag label="Nunca contatados" color="#ef4444" on={f.untouched} onClick={() => set("untouched", !f.untouched)} Comp={Flame} />
            </div>
            <fieldset className="space-y-1.5"><legend className="text-sm font-bold">Consulta de CNPJ</legend>
              <Seg label="Consulta de CNPJ" value={f.enriched} onChange={(v) => set("enriched", v)} options={[["any", "Tanto faz"], ["yes", "Só consultados"], ["no", "Só não consultados"]]} />
            </fieldset>
          </Block>

          <Block n={4} hex="#f59e0b" icon={Zap} title="Ajustes finos" hint="Celular, situação, idade da empresa e tempo sem contato" open={false} badge={fine ? `${fine} ligado${fine === 1 ? "" : "s"}` : undefined}>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <FlashTag label="Só celular (WhatsApp)" color="#14b8a6" on={f.mobile} onClick={() => set("mobile", !f.mobile)} Comp={Smartphone} />
              <FlashTag label="Só empresas ATIVAS" color="#22c55e" on={f.active} onClick={() => set("active", !f.active)} Comp={ShieldCheck} />
            </div>
            <fieldset className="space-y-1.5"><legend className="flex items-center gap-1.5 text-sm font-bold"><Calendar size={14} aria-hidden className="text-accent" /> Idade da empresa</legend>
              <Seg label="Idade da empresa" value={f.age} onChange={(v) => set("age", v)} options={[["any", "Tanto faz"], ["new", "Menos de 2 anos"], ["mid", "2 a 10 anos"], ["old", "Mais de 10 anos"]]} />
              <p className="text-[11px] text-muted">Vale só para leads com a consulta de CNPJ feita.</p>
            </fieldset>
            <fieldset className="space-y-1.5"><legend className="flex items-center gap-1.5 text-sm font-bold"><Clock size={14} aria-hidden className="text-accent" /> Sem nenhum contato há</legend>
              <Seg label="Sem contato há" value={f.quiet} onChange={(v) => set("quiet", v)} options={[[0, "Tanto faz"], [30, "30 dias"], [60, "60 dias"], [90, "90 dias"]]} />
            </fieldset>
          </Block>
        </div>

        {/* A carta da lista (fica à vista) */}
        <aside className="space-y-3 lg:sticky lg:top-20" aria-label="Sua lista">
          <div style={{ background: grad(hex), boxShadow: `0 14px 34px -14px ${hex}` }} className="relative overflow-hidden rounded-3xl border-2 border-white/30 p-4 text-white">
            <PIcon aria-hidden size={130} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-5 -rotate-12 opacity-[.16]" />
            <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 size-32 rounded-full bg-white/25 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/25"><PIcon size={24} aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="text-[11px] font-extrabold uppercase tracking-wider opacity-85">{editId ? "Editando lista" : "Sua nova carta"}</p><p className="truncate text-lg font-extrabold leading-tight">{name.trim() || "Sem nome ainda"}</p></div>
              {(editId || summary.length > 0) && <button type="button" className="text-xs font-bold underline underline-offset-2 opacity-90 hover:opacity-100" onClick={reset}>{editId ? "Cancelar" : "Limpar"}</button>}
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-3">
              <div aria-live="polite"><p className="figure text-5xl font-extrabold leading-none">{reserved.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-90">{loading ? "contando…" : `de ${(pv?.count ?? 0).toLocaleString("pt-BR")} serão reservados`}</p></div>
              <span className="relative"><MetricRing value={(reserved / LIST_MAX_LEADS) * 100} color="#fff" track="rgba(255,255,255,.28)" size="size-16" /><span className="figure absolute inset-0 grid place-items-center text-xs font-extrabold">{f.size}</span></span>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-line bg-panel p-4 shadow-md">
            <div className="flex flex-wrap gap-1.5">
              {f.ufs.map((u) => <Tag key={u} onX={() => set("ufs", toggleIn(f.ufs, u))}><MapPin size={11} aria-hidden /> {u}</Tag>)}
              {f.city && <Tag onX={() => set("city", "")}>{f.city}</Tag>}
              {f.segments.map((s) => <Tag key={s} onX={() => set("segments", toggleIn(f.segments, s))}>{SEGMENT_WORDS[s]?.label}</Tag>)}
              {f.words && <Tag onX={() => set("words", "")}>“{f.words}”</Tag>}
              {f.tags.map((t) => <Tag key={t} onX={() => set("tags", toggleIn(f.tags, t))}>{tagChips.find((c) => c.v === t)?.label ?? t}</Tag>)}
              {f.phone && <Tag onX={() => set("phone", false)}>Telefone</Tag>}{f.email && <Tag onX={() => set("email", false)}>E-mail</Tag>}{f.person && <Tag onX={() => set("person", false)}>Contato</Tag>}{f.untouched && <Tag onX={() => set("untouched", false)}>Nunca contatados</Tag>}
              {f.enriched !== "any" && <Tag onX={() => set("enriched", "any")}>{f.enriched === "yes" ? "CNPJ consultado" : "CNPJ não consultado"}</Tag>}
              {f.mobile && <Tag onX={() => set("mobile", false)}>Celular</Tag>}{f.active && <Tag onX={() => set("active", false)}>ATIVAS</Tag>}
              {f.age !== "any" && <Tag onX={() => set("age", "any")}>{f.age === "new" ? "Novas" : f.age === "mid" ? "2 a 10 anos" : "Mais de 10 anos"}</Tag>}
              {f.quiet > 0 && <Tag onX={() => set("quiet", 0)}>Sem contato {f.quiet}d</Tag>}
              {summary.length === 0 && <span className="text-xs text-muted">Sem filtros: todos os leads disponíveis.</span>}
            </div>

            <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-muted">Cartas de exemplo</p>
              <button type="button" onClick={() => setMix((m) => m + 1)} className="inline-flex items-center gap-1 rounded-full bg-sunk px-2.5 py-1 text-xs font-bold text-accent transition hover:bg-accent/15 active:scale-95"><Shuffle size={12} aria-hidden /> Embaralhar</button></div>
            <div className="grid grid-cols-2 gap-2">
              {(pv?.sample ?? []).slice(0, 4).map((s, n) => (
                <div key={`${mix}-${s.id}`} style={{ "--i": n, background: soft(hex, 14, 3), borderColor: `color-mix(in srgb, ${hex} 40%, transparent)` } as React.CSSProperties} className="card-in lift flex min-h-[5.5rem] flex-col justify-between rounded-2xl border-2 p-2.5">
                  <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: grad(hex) }}><Store size={14} aria-hidden /></span>
                  <p className="line-clamp-2 text-xs font-bold leading-tight">{s.name}</p>
                  <p className="figure text-[10px] text-muted">{s.where || "—"} · {s.phones} tel.</p>
                </div>
              ))}
            </div>
            {pv && pv.sample.length === 0 && <p className="text-sm text-muted">Nenhum lead com esses filtros. Afrouxe algum.</p>}

            <label className="block text-sm font-medium">Nome da lista<input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Postos de molas de SP" /></label>
            <div className="space-y-1.5"><p className="flex items-center justify-between text-sm font-medium"><span>Quantos leads</span><b className="figure">{f.size}</b></p>
              <input type="range" min={10} max={LIST_MAX_LEADS} step={10} value={f.size} onChange={(e) => set("size", Number(e.target.value))} aria-label="Quantos leads reservar" className="w-full" style={{ accentColor: hex }} /></div>
            <div className="space-y-1.5"><p className="text-sm font-medium">Quais leads, se houver mais</p><Seg label="Ordem" value={f.order} onChange={(v) => set("order", v)} options={[["random", "Sorteados"], ["newest", "Mais novos"], ["oldest", "Mais antigos"]]} /></div>
            <div className="space-y-1.5"><p className="text-sm font-medium">Cor e ícone da carta</p>
              <div className="flex flex-wrap gap-1.5">{LIST_COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={f.color === c} onClick={() => set("color", c)} className="grid size-8 place-items-center rounded-full text-white transition hover:scale-110 active:scale-95" style={{ background: grad(c), outline: f.color === c ? `3px solid ${c}` : undefined, outlineOffset: 2 }}>{f.color === c && <Check size={14} aria-hidden />}</button>)}</div>
              <div className="flex flex-wrap gap-1.5">{LIST_ICON_KEYS.map((k) => { const I = listIcon(k); const on = f.icon === k; return <button key={k} type="button" aria-label={`Ícone ${k}`} aria-pressed={on} onClick={() => set("icon", k)} className="grid size-9 place-items-center rounded-xl border-2 transition hover:scale-110 active:scale-95" style={on ? { background: grad(hex), color: "#fff", borderColor: hex } : { borderColor: "var(--line)", color: "var(--muted)" }}><I size={16} aria-hidden /></button>; })}</div></div>

            {(pv?.count ?? 0) > f.size && <p className="rounded-xl border border-line bg-sunk/50 px-3 py-2 text-xs">Há {pv!.count.toLocaleString("pt-BR")} leads livres. Ao salvar, a lista fica com {f.size} ({f.order === "random" ? "sorteados" : f.order === "newest" ? "os mais novos" : "os mais antigos"}); o resto é ignorado.</p>}
            {full && <p role="alert" className="rounded-xl border border-warn/50 bg-warn/10 px-3 py-2 text-xs">Você já usa {used} de {LIST_MAX_PER_USER} listas. Exclua, zere ou compartilhe uma em “Suas cartas” para abrir espaço.</p>}
            <p className="text-[11px] text-muted">Limites: até {LIST_MAX_LEADS} leads por lista e {LIST_MAX_PER_USER} listas por pessoa ({used} em uso). Um lead fica em uma lista só.</p>
            <div className="grid gap-2">
              <button type="button" className={btnPrimary} disabled={pending || full || !pv || pv.count === 0} onClick={() => save(true)}><Play size={15} aria-hidden /> Salvar e ativar no Shuffler</button>
              <button type="button" className={btnGhost} disabled={pending || full} onClick={() => save(false)}><Wand2 size={15} aria-hidden /> Só salvar</button>
            </div>
          </div>
        </aside>
      </div>
      </>)}
      {dialog}
    </div>
  );
}

/** A cor da ideia mais parecida com as cores permitidas das listas. */
function nearest(hex: string): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  return LIST_COLORS.reduce((best, c) => { const [x, y, z] = rgb(c); const d = (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2; return d < best.d ? { c, d } : best; }, { c: LIST_COLORS[0], d: Infinity }).c;
}

function Tag({ children, onX }: { children: React.ReactNode; onX: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-accent">{children}<button type="button" aria-label="Remover filtro" onClick={onX} className="grid size-4 place-items-center rounded-full hover:bg-accent/20"><X size={10} aria-hidden /></button></span>;
}
