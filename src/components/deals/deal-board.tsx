"use client";

import { FilterBar } from "@/components/filter-bar";
import { Building2, MessageCircle, CalendarCheck, CalendarClock, Clock, FileText, LayoutGrid, MapPin, Phone, PhoneCall, Rows3, ScrollText, Search, Columns3, UserPlus, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRun } from "@/components/use-run";
import { SocialLink } from "@/components/brand-icons";
import { MARKER_BY_KEY } from "@/config/markers";
import { trackTouch } from "@/lib/touch-bus";
import { DealPrefsMenu, useDealPrefs, type Prefs } from "./deal-prefs";
import { btnPrimary, inputCls, panelCls } from "@/components/ui";
import { BOARD_COLUMNS, fmtBRL, STAGE_META } from "@/config/deals";
import { chatproUrl, fmtDate, fmtPhone } from "@/lib/format";
import { claimDealAction } from "@/modules/deals/actions";
import type { DealWithExtra } from "@/modules/deals/extras";
import { AlertChip, StageChip } from "./deal-ui";
import { DealSheet } from "./deal-sheet";
import { DealFilterPanel, filterChips, type FilterOpts } from "./deal-filter-panel";
import { activeCount, isOpenDeal, lastTouch, matches, NO_FILTER, sortDeals, SORTS, type DF, type Scope } from "./deal-filters";

type View = "quadro" | "blocos" | "planilha";
const VIEWS: [View, string, typeof Columns3][] = [["quadro", "Quadro", Columns3], ["blocos", "Blocos", LayoutGrid], ["planilha", "Planilha", Rows3]];

const ago = (iso: string) => { const h = (Date.now() - new Date(iso).getTime()) / 3600_000; return h < 1 ? "agora" : h < 24 ? `há ${Math.floor(h)} h` : h < 48 ? "ontem" : `há ${Math.floor(h / 24)} d`; };

/** Pequena etiqueta de registro: ícone + número (só aparece quando há algo). */
function Count({ I, n, label }: { I: typeof Phone; n: number; label: string }) {
  if (!n) return null;
  return <span title={`${n} ${label}`} className="figure inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[11px] font-semibold text-muted"><I size={11} aria-hidden />{n}</span>;
}

const tintBg = (hex: string, a = 16, b = 4) => ({ backgroundColor: "color-mix(in srgb, var(--panel) 66%, transparent)", backgroundImage: `linear-gradient(145deg, color-mix(in srgb, ${hex} ${a}%, transparent), color-mix(in srgb, ${hex} ${b}%, transparent) 70%)`, borderColor: `color-mix(in srgb, ${hex} 38%, var(--line))` });
const iconTile = (hex: string) => `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))`;
const MARK_SHOW = ["site", "redes", "celular", "email", "ativo", "mei", "eox", "cliente"];

function Card({ d, meId, canClaim, i = 0, prefs }: { d: DealWithExtra; meId: number; canClaim: boolean; i?: number; prefs: Prefs }) {
  const { run, pending } = useRun();
  const hex = d.color ?? STAGE_META[d.stage].color;
  const touch = lastTouch(d);
  const open = isOpenDeal(d);
  const c = prefs.card, tight = prefs.density === "compacto";
  const danger = d.alerts.some((a) => a.tone === "danger");
  const siteUrl = d.site && /^https?:\/\//i.test(d.site) ? d.site : d.site && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(d.site) ? `https://${d.site}` : null;
  const digits = d.phone?.replace(/\D/g, "") ?? "";
  const marks = d.markers.filter((k) => MARK_SHOW.includes(k));
  const showCounts = c.counts && (d.x.contacts + d.x.quotes + d.x.scriptRuns + d.x.visits > 0 || (d.cycles ?? 1) > 1);
  return (
    <li style={{ "--i": Math.min(i, 12), ...tintBg(hex), borderWidth: "1.5px", ...(danger ? { borderColor: "color-mix(in srgb, var(--danger) 55%, var(--line))" } : {}), WebkitBackdropFilter: "blur(16px) saturate(1.4)", backdropFilter: "blur(16px) saturate(1.4)" } as React.CSSProperties}
      className="card-in group relative flex flex-col overflow-hidden rounded-2xl border shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)] transition hover:-translate-y-0.5 hover:shadow-xl">
      <Building2 aria-hidden size={tight ? 64 : 92} strokeWidth={1.3} className="pointer-events-none absolute -bottom-3 -right-2 -rotate-12 opacity-[.1] transition duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ color: hex }} />
      <Link href={`/negociacoes/${d.id}`} className={`relative flex flex-1 flex-col outline-none after:absolute after:inset-0 focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-accent/50 ${tight ? "gap-1.5 p-3" : "gap-2.5 p-4"}`}>
        <div className="flex items-start gap-2.5">
          <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl text-white shadow-md ${tight ? "size-8" : "size-10"}`} style={{ background: iconTile(hex) }}><Building2 size={tight ? 16 : 19} /></span>
          <p className={`min-w-0 flex-1 font-bold leading-snug ${tight ? "line-clamp-1 text-[13px]" : "line-clamp-2 min-h-9 text-[14px]"}`} title={d.company}>{d.company}</p>
          {!open && <StageChip stage={d.stage} />}
        </div>
        {c.contact && (
          <p className="flex min-h-4 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {d.city && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{d.city}/{d.uf}</span>}
            {d.phone && <span className="inline-flex items-center gap-1"><Phone size={12} aria-hidden />{fmtPhone(d.phone)}</span>}
            {d.quoteNumber && <span className="figure inline-flex items-center gap-1"><FileText size={12} aria-hidden />Cot. {d.quoteNumber}</span>}
            {!d.city && !d.phone && !d.quoteNumber && <span>Sem dados de contato</span>}
          </p>
        )}
        {c.marks && marks.length > 0 && <span className="flex flex-wrap gap-1">{marks.map((k) => { const m = MARKER_BY_KEY.get(k); return m ? <span key={k} title={m.hint} className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: `color-mix(in srgb, ${m.color} 72%, var(--ink))` }}>{m.label}</span> : null; })}</span>}
        {c.talked && d.x.talkedTo && <p className="flex items-center gap-1.5 text-xs"><UserRound size={12} aria-hidden className="text-accent" /><span className="text-muted">SDR falou com</span><b className="truncate">{d.x.talkedTo}</b></p>}
        {c.note && d.handoffNote && d.stage === "novo" && !tight && <p className="line-clamp-2 rounded-lg bg-sunk/60 px-2.5 py-1.5 text-xs text-muted" title={d.handoffNote}>“{d.handoffNote}”</p>}
        {showCounts && (
          <span className="flex flex-wrap items-center gap-1.5">
            <Count I={PhoneCall} n={d.x.contacts} label="contatos do vendedor" /><Count I={FileText} n={d.x.quotes} label="cotações" /><Count I={ScrollText} n={d.x.scriptRuns} label="ligações com roteiro" /><Count I={CalendarCheck} n={d.x.visits} label="visitas" />
            {(d.cycles ?? 1) > 1 && <span className="figure rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent" title="Todo o histórico do cliente fica dentro da janela">{d.cycles} negociações{d.billedCount ? ` · ${d.billedCount} faturada${d.billedCount > 1 ? "s" : ""}` : ""}</span>}
          </span>
        )}
        {c.next && open && d.nextActionAt && <p className="flex items-center gap-1.5 text-xs text-muted" title={d.nextActionNote ?? undefined}><CalendarClock size={12} aria-hidden />Retorno {fmtDate(d.nextActionAt)}{d.nextActionNote ? ` · ${d.nextActionNote}` : ""}</p>}
        {(d.alerts.length > 0 || d.expired) && (
          <span className="flex flex-wrap gap-1.5">
            {d.expired && <span className="inline-flex items-center rounded-full bg-sunk px-2.5 py-0.5 text-xs font-semibold text-muted">Fora da carteira</span>}
            {d.alerts.map((a) => <AlertChip key={a.kind} a={a} />)}
          </span>
        )}
      </Link>
      {c.quick && (digits.length >= 10 || siteUrl) && (
        <div className={`relative z-10 flex flex-wrap items-center gap-1.5 ${tight ? "px-3 pb-2" : "px-4 pb-3"}`}>
          {digits.length >= 10 && <a href={chatproUrl(digits)} target="_blank" rel="noreferrer" onClick={() => void trackTouch({ leadId: d.leadId, channel: "whatsapp", target: digits, label: d.company })} className="inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110" style={{ background: "#25D366" }}><MessageCircle size={13} aria-hidden /> WhatsApp</a>}
          {siteUrl && <SocialLink kind="site" href={siteUrl} />}
        </div>
      )}
      {c.seller && (
        <div className={`relative mt-auto flex items-center justify-between gap-2 border-t border-line/60 text-xs text-muted ${tight ? "px-3 py-2" : "px-4 py-2.5"}`}>
          <span className="min-w-0 truncate" title={d.sdrName ? `Repassado por ${d.sdrName}` : undefined}>
            {d.sellerName ? <b className="font-semibold text-ink">{d.sellerId === meId ? "Você" : d.sellerName}</b> : "Sem vendedor"}
            {open && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px]"><Clock size={10} aria-hidden />{ago(touch)}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">{d.mainCents ? <b className="figure rounded-full px-2.5 py-0.5 text-sm text-on-accent shadow-sm" style={{ background: iconTile(hex) }}>{fmtBRL(d.mainCents)}</b> : null}</span>
        </div>
      )}
      {!d.sellerId && canClaim && open && (
        <div className={`relative ${tight ? "px-3 pb-3" : "px-4 pb-4"}`}><button type="button" disabled={pending} onClick={() => run(() => claimDealAction(d.id))} className={`${btnPrimary} relative z-10 w-full !py-2 !text-sm`}><UserPlus size={15} aria-hidden /> Assumir</button></div>
      )}
    </li>
  );
}

const GRID = "grid items-stretch gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]";

export function DealBoard({ deals, meId, canClaim, team, opts }: { deals: DealWithExtra[]; meId: number; canClaim: boolean; team: boolean; opts: FilterOpts }) {
  const [f, setF] = useState<DF>(NO_FILTER);
  const set = (p: Partial<DF>) => setF((x) => ({ ...x, ...p }));
  const [prefs] = useDealPrefs();
  const [view, setView] = useState<View>("quadro");
  useEffect(() => { try { const v = localStorage.getItem("neg-view"); if (v === "blocos" || v === "planilha") setView(v); } catch { /* sem armazenamento: fica no quadro */ } }, []);
  const pick = (v: View) => { setView(v); try { localStorage.setItem("neg-view", v); } catch { /* ignora */ } };

  const open = useMemo(() => deals.filter(isOpenDeal), [deals]);
  const closed = useMemo(() => deals.filter((d) => !isOpenDeal(d)), [deals]);
  /** Última coluna do quadro: o que foi faturado neste mês. */
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const billedMonth = (d: DealWithExtra) => d.stage === "ganho" && (d.closedOn ?? d.closedAt ?? "").slice(0, 7) === month;
  const counts: Record<Scope, number> = { todas: open.length, minhas: open.filter((d) => d.sellerId === meId).length, grupo: open.filter((d) => !d.sellerId).length, avisos: open.filter((d) => d.alerts.length).length, fechadas: closed.length };

  /** Base de cada atalho: "Encerradas" mostra as fechadas; escolher etapas no filtro avançado olha tudo; senão, as abertas (+ faturadas no mês, no quadro). */
  const pool = f.stages.length ? deals : f.scope === "fechadas" ? closed : open;
  const billedExtra = !f.stages.length && (f.scope === "todas" || f.scope === "minhas") ? deals.filter(billedMonth) : [];
  const shown = useMemo(() => sortDeals(pool.filter((d) => matches(d, f, meId)), f.sort), [pool, f, meId]);
  const billedShown = useMemo(() => sortDeals(billedExtra.filter((d) => matches(d, { ...f, scope: f.scope === "minhas" ? "minhas" : "todas" }, meId)), f.sort), [billedExtra, f, meId]);
  const all = f.scope === "todas" || f.scope === "minhas" ? [...shown, ...billedShown.filter((b) => !shown.includes(b))] : shown;
  const n = activeCount(f);
  const chips = filterChips(f, set, opts);
  const shortcuts: [Scope, string][] = [["todas", team ? "Todas abertas" : "Abertas"], ["minhas", "Minhas"], ["grupo", "Sem vendedor"], ["avisos", "Com aviso"], ["fechadas", "Encerradas"]];
  const sortLabel = SORTS.find(([k]) => k === f.sort)?.[1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Forma de ver as negociações" className="card-surface card-edge flex w-fit gap-1 rounded-full p-1">
          {VIEWS.map(([k, label, Icon]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => pick(k)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${view === k ? "bg-grad text-white shadow-sm" : "text-muted hover:text-ink"}`}><Icon size={15} aria-hidden /> {label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3"><DealPrefsMenu scope="lista" /><p className="text-sm text-muted" role="status" aria-live="polite">Mostrando <b className="figure text-ink">{all.length}</b> de {deals.length} · {sortLabel?.toLowerCase()}</p></div>
      </div>
      <FilterBar id="negociacoes" defaultOpen active={n} onClear={() => setF(NO_FILTER)} label="Filtros avançados"
        search={<><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" aria-label="Buscar negociação" placeholder="Buscar por empresa, contato, cidade, vendedor, SDR, CNPJ, telefone ou nº da cotação" className={`${inputCls} !pl-10`} value={f.q} onChange={(e) => set({ q: e.target.value })} /></>}
        chips={chips.length ? <>{chips.map((c) => <button key={c.key} type="button" onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-accent transition hover:bg-accent/20" aria-label={`Tirar filtro: ${c.label}`}>{c.label}<X size={12} aria-hidden /></button>)}</> : undefined}>
        <DealFilterPanel f={f} set={set} opts={opts} />
      </FilterBar>

      {/* os atalhos principais ficam sempre à vista, fora do painel recolhido */}
      <div role="tablist" aria-label="Atalhos rápidos" className="-mt-1 flex flex-wrap gap-2">
        {shortcuts.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={f.scope === k} onClick={() => set({ scope: k })} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${f.scope === k ? "border-transparent bg-grad text-white shadow-sm" : "border-line bg-panel text-muted hover:text-ink"}`}>
            {label}<span className={`figure rounded-full px-1.5 text-xs ${f.scope === k ? "bg-black/15" : "bg-sunk text-muted"} ${k === "avisos" && counts.avisos && f.scope !== k ? "!bg-danger/15 !text-danger" : ""}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {view === "planilha" ? <DealSheet deals={all} meId={meId} canClaim={canClaim} />
      : view === "blocos" || f.scope === "fechadas" || f.scope === "avisos" || f.scope === "grupo" || f.stages.length ? (
        all.length ? <ul className={GRID}>{all.map((d, i) => <Card key={d.id} d={d} i={i} meId={meId} canClaim={canClaim} prefs={prefs} />)}</ul> : <Empty text={n ? "Nenhuma negociação com esses filtros." : "Nenhuma negociação aqui."} clear={n ? () => setF(NO_FILTER) : undefined} />
      ) : all.length === 0 ? <Empty text={n ? "Nenhuma negociação com esses filtros." : "Nenhuma negociação aberta."} clear={n ? () => setF(NO_FILTER) : undefined} /> : (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(14.5rem,1fr))]">
          {BOARD_COLUMNS.filter(({ key }) => prefs.cols[key]).map(({ key, stages }) => {
            const col = key === "ganho" ? billedShown : shown.filter((d) => stages.includes(d.stage));
            return (
              <section key={key} className="min-w-0 space-y-3 rounded-3xl border-[1.5px] p-2.5" style={{ ...tintBg(STAGE_META[key].color, 9, 2), WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)" }}>
                <header className="relative flex items-center justify-between gap-2 overflow-hidden rounded-2xl px-2.5 py-2" style={{ background: iconTile(STAGE_META[key].color) }}>
                  <span className="whitespace-nowrap text-sm font-extrabold text-white">{STAGE_META[key].label}</span>
                  <span className="figure whitespace-nowrap rounded-full bg-black/25 px-2 text-sm font-bold text-white">{col.length}</span>
                </header>
                {col.some((x) => x.mainCents) && <p className="figure -mt-1 px-1.5 text-xs font-semibold text-muted">{fmtBRL(col.reduce((a, x) => a + (x.mainCents ?? 0), 0))}</p>}
                <ul className="space-y-2.5">{col.map((d, i) => <Card key={d.id} d={d} i={i} meId={meId} canClaim={canClaim} prefs={prefs} />)}{col.length === 0 && <li className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted">Vazio</li>}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ text, clear }: { text: string; clear?: () => void }) {
  return <div className={`${panelCls} space-y-3 p-8 text-center text-sm text-muted`}><p>{text}</p>{clear && <button type="button" onClick={clear} className="font-semibold text-accent hover:underline">Limpar todos os filtros</button>}</div>;
}
