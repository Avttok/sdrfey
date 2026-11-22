"use client";

import { CheckCircle2, Coins, Lock, Trophy } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { ACHIEVEMENT_BY_KEY, type Achievement, type AchievementGroup } from "@/config/achievements";
import { achievementCoins } from "@/config/shop";
import { setAchievementAction } from "@/modules/achievements/actions";

/** O que vem do servidor: só dados simples. Nome, ícone e cor saem do catálogo aqui no cliente. */
export type AchievementRow = { key: string; earned: boolean; value: number; manual: "granted" | "blocked" | null };
export type Paid = Record<string, { amount: number; at: string }>;
type Row = Achievement & Omit<AchievementRow, "key"> & { reward: number; received: number | null; receivedAt: string | null };

const nf = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Medalha redonda: acesa quando ganha, apagada com cadeado quando não. */
export function Medal({ a, size = 56, onClick, active }: { a: Row; size?: number; onClick?: () => void; active?: boolean }) {
  const I = a.icon;
  return (
    <button type="button" onClick={onClick} aria-label={a.name} aria-pressed={active} className={`medal group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition hover:-translate-y-0.5 ${active ? "bg-sunk" : ""}`} style={{ ["--cor" as string]: a.color }}>
      <span className="medal-disc relative grid place-items-center rounded-full border-2 transition" data-on={a.earned} style={{ width: size, height: size }}>
        <I size={size * 0.42} aria-hidden />
        {!a.earned && <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border border-line bg-panel text-muted"><Lock size={11} aria-hidden /></span>}
      </span>
      <span className={`line-clamp-2 text-[11px] font-semibold leading-tight ${a.earned ? "" : "text-muted"}`}>{a.name}</span>
      <span className={`figure inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${a.received ? "bg-ok/15 text-ok" : "bg-sunk text-muted"}`} title={a.received ? "Moedas já recebidas" : "Moedas que paga ao ser conquistada"}>{a.received ? <CheckCircle2 size={10} aria-hidden /> : <Coins size={10} aria-hidden />}{a.received ? `+${a.received}` : a.reward}</span>
    </button>
  );
}

export function AchievementsView({ rows: raw, groups, who, adminFor, paid = {} }: { rows: AchievementRow[]; groups: AchievementGroup[]; who: string; adminFor?: number; paid?: Paid }) {
  const rows: Row[] = raw.flatMap((r) => { const a = ACHIEVEMENT_BY_KEY.get(r.key); return a ? [{ ...a, ...r, reward: achievementCoins(a.goal), received: paid[r.key]?.amount ?? null, receivedAt: paid[r.key]?.at ?? null }] : []; });
  const [show, setShow] = useState<"all" | "got" | "todo">("all");
  const { run, pending } = useRun();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<AchievementGroup | "Todas">("Todas");
  const shown = rows.filter((r) => (tab === "Todas" || r.group === tab) && (show === "all" || (show === "got" ? r.earned : !r.earned)));
  const ordered = [...shown.filter((r) => r.earned), ...shown.filter((r) => !r.earned)];
  const got = rows.filter((r) => r.earned).length;
  const cur = rows.find((r) => r.key === sel) ?? null;
  const received = rows.reduce((t, r) => t + (r.received ?? 0), 0);
  const earnedPending = rows.filter((r) => r.earned && !r.received).reduce((t, r) => t + r.reward, 0);
  const toEarn = rows.filter((r) => !r.earned).reduce((t, r) => t + r.reward, 0);
  const pct = rows.length ? Math.round((got / rows.length) * 100) : 0;
  return (
    <div className="space-y-5">
      <section className={`${panelCls} flex flex-wrap items-center gap-5 p-5`}>
        <span className="relative grid size-20 place-items-center">
          <svg viewBox="0 0 36 36" className="size-20 -rotate-90" aria-hidden><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} /></svg>
          <span className="figure absolute text-lg font-bold">{pct}%</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="display text-2xl"><span className="figure">{got}</span> <span className="text-muted">de {rows.length} conquistas</span></p>
          <p className="text-sm text-muted">{who}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-xl bg-ok/12 px-3 py-1.5 font-semibold text-ok"><CheckCircle2 size={15} aria-hidden /><span className="figure">{nf(received)}</span> moedas recebidas</span>
            {earnedPending > 0 && <span className="inline-flex items-center gap-2 rounded-xl bg-warn/12 px-3 py-1.5 font-semibold text-warn"><Coins size={15} aria-hidden /><span className="figure">{nf(earnedPending)}</span> a receber</span>}
            <span className="inline-flex items-center gap-2 rounded-xl bg-sunk px-3 py-1.5 font-semibold text-muted"><Lock size={14} aria-hidden /><span className="figure">{nf(toEarn)}</span> ainda por conquistar</span>
          </div>
        </div>
        <div role="radiogroup" aria-label="Mostrar" className="inline-flex rounded-xl border border-line bg-sunk/50 p-1">
          {([["all", "Todas"], ["got", "Ganhas"], ["todo", "Em andamento"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={show === k} onClick={() => setShow(k)} className={`min-h-9 rounded-lg px-3.5 text-sm font-medium transition ${show === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>)}
        </div>
        <div role="tablist" aria-label="Grupo" className="inline-flex rounded-xl border border-line bg-sunk/50 p-1">
          {(["Todas", ...groups] as const).map((g) => <button key={g} type="button" role="tab" aria-selected={tab === g} onClick={() => setTab(g)} className={`min-h-9 rounded-lg px-3.5 text-sm font-medium transition ${tab === g ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{g}</button>)}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={`${panelCls} p-4`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1">
            {ordered.map((r) => <Medal key={r.key} a={r} active={sel === r.key} onClick={() => setSel(sel === r.key ? null : r.key)} />)}
          </div>
        </section>
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className={`${panelCls} space-y-3 p-5`}>
            {!cur ? <p className="flex items-center gap-2 text-sm text-muted"><Trophy size={16} aria-hidden /> Toque numa medalha.</p> : (
              <>
                <div className="flex items-center gap-3"><Medal a={cur} size={64} /><div className="min-w-0"><h2 className="display text-lg leading-tight">{cur.name}</h2><p className="text-xs text-muted">{cur.group}</p></div></div>
                <p className="text-sm">{cur.desc}</p>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (cur.value / cur.goal) * 100)}%`, background: cur.color }} /></div>
                  <p className="mt-1 text-xs text-muted"><b className="figure text-ink">{nf(Math.min(cur.value, cur.goal))}</b> de {nf(cur.goal)} {cur.unit}{cur.manual === "granted" ? " · dada pelo Adm" : cur.manual === "blocked" ? " · bloqueada pelo Adm" : ""}</p>
                </div>
                <div className={`flex items-center gap-3 rounded-xl p-3 ${cur.received ? "bg-ok/12" : "bg-sunk"}`}>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${cur.received ? "bg-ok text-white" : "bg-panel text-accent ring-1 ring-line"}`}>{cur.received ? <CheckCircle2 size={18} aria-hidden /> : <Coins size={18} aria-hidden />}</span>
                  <p className="min-w-0 text-sm"><b className="figure text-base">{cur.received ? `+${nf(cur.received)}` : nf(cur.reward)} moedas</b>
                    <span className="block text-xs text-muted">{cur.received ? `Recebidas${cur.receivedAt ? ` em ${new Date(cur.receivedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}` : cur.received === 0 ? "Conquistada com o ganho de moedas bloqueado: sem moedas" : cur.earned ? "Conquistada: entra no saldo em instantes" : "É o que ela paga quando for conquistada"}</span></p>
                </div>
                {adminFor !== undefined && (
                  <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3">
                    <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => setAchievementAction(adminFor, cur.key, "granted"))}>Dar</button>
                    <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => setAchievementAction(adminFor, cur.key, "blocked"))}>Bloquear</button>
                    <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => setAchievementAction(adminFor, cur.key, "auto"))}>Automático</button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
