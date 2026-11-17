import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { History, CalendarCheck, CheckCircle2, Clock, Search, Timer } from "lucide-react";
import Link from "next/link";
import { AttendButton } from "@/components/attend-button";
import { DateField } from "@/components/date-field";
import { TagChip } from "@/components/tag-chip";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtCnpj, fmtDate, fmtDuration, plural, TZ } from "@/lib/format";
import { SellerHistory } from "@/components/deals/seller-history";
import { isSellerOnly } from "@/config/roles";
import { requirePerm } from "@/modules/auth/guard";
import { parseHistFilters, userHistoryRich, type HistRow } from "@/modules/leads/history";

export const metadata: Metadata = { title: "Meu histórico" };
export const dynamic = "force-dynamic";

const hourFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d)); // AAAA-MM-DD

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.historico");
  const sp = await searchParams;
  if (isSellerOnly(me.roles)) return <SellerHistory userId={me.id} sp={sp} />;
  const f = parseHistFilters(sp);
  const rows = await userHistoryRich(me.id, f);

  const todayKey = dayKey(new Date().toISOString());
  const yKey = dayKey(new Date(Date.now() - 864e5).toISOString());
  const preset = (days: number) => { const to = todayKey; const from = dayKey(new Date(Date.now() - (days - 1) * 864e5).toISOString()); return `/historico?from=${from}&to=${to}`; };

  // Estatísticas do que está filtrado
  const timed = rows.filter((r) => r.seconds != null && r.seconds < 6 * 3600);
  const avg = timed.length ? Math.round(timed.reduce((a, r) => a + (r.seconds ?? 0), 0) / timed.length) : null;
  const qualified = rows.filter((r) => r.tags.some((t) => t.group === "qualificacao" && t.key === "qualificado")).length;
  const scheduled = rows.filter((r) => r.visits).length;
  const rate = rows.length ? Math.round((qualified / rows.length) * 100) : 0;

  const byDay = new Map<string, HistRow[]>();
  for (const r of rows) { const k = dayKey(r.saved_at); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const days = [...byDay.entries()];
  const spark = days.slice(0, 14).reverse();
  const max = Math.max(1, ...spark.map(([, v]) => v.length));
  const label = (k: string) => (k === todayKey ? "Hoje" : k === yKey ? "Ontem" : fmtDate(`${k}T12:00:00-03:00`));
  const hasFilter = !!(f.q || f.from || f.to || f.qual || f.visit);

  return (
    <div className="space-y-6">
      <PageHead icon={History} title="Meu histórico" subtitle="Tudo o que você atendeu e salvou. Use ATENDER para voltar a um lead.">
        <Link className={btnGhost} href={preset(1)}>Hoje</Link>
        <Link className={btnGhost} href={preset(7)}>7 dias</Link>
        <Link className={btnGhost} href={preset(30)}>30 dias</Link>
        <Link className={btnGhost} href="/historico">Tudo</Link>
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CheckCircle2 size={18} />} label="Atendidos" value={String(rows.length)} hint={rows.length === 600 ? "mostrando os 600 mais recentes" : undefined} />
        <Stat icon={<Timer size={18} />} label="Tempo médio" value={fmtDuration(avg)} />
        <Stat icon={<Clock size={18} />} label="Qualificados" value={String(qualified)} hint={`${rate}% dos atendidos`} />
        <Stat icon={<CalendarCheck size={18} />} label="Com visita agendada" value={String(scheduled)} />
      </div>

      {spark.length > 1 && (
        <section className={`${panelCls} p-4`} aria-label="Atendimentos por dia">
          <p className="mb-3 text-sm font-semibold">Atendimentos por dia</p>
          <div className="flex h-28 items-end gap-1.5">
            {spark.map(([k, v]) => (
              <div key={k} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${label(k)}: ${plural(v.length, "atendimento", "atendimentos")}`}>
                <span className="figure text-[11px] text-muted opacity-0 transition group-hover:opacity-100">{v.length}</span>
                <div className="w-full rounded-t-md bg-accent/70 transition-all group-hover:bg-accent" style={{ height: `${(v.length / max) * 100}%`, minHeight: 4 }} />
                <span className="text-[10px] text-muted">{k.slice(8)}/{k.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <form method="get" className={`${panelCls} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]`}>
        <label className="text-sm sm:col-span-2 lg:col-span-1"><span className="mb-1 block text-muted">Buscar</span><span className="relative block"><Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input name="q" defaultValue={f.q} placeholder="Empresa, CNPJ, cidade ou observação" className={`${inputCls} pl-9`} /></span></label>
        <div className="text-sm"><span className="mb-1 block text-muted">De</span><DateField name="from" label="De" defaultValue={f.from} /></div>
        <div className="text-sm"><span className="mb-1 block text-muted">Até</span><DateField name="to" label="Até" defaultValue={f.to} /></div>
        <label className="text-sm"><span className="mb-1 block text-muted">Qualificação</span>
          <select name="qual" defaultValue={f.qual ?? ""} className={inputCls}>
            <option value="">Todas</option><option value="qualificado">Qualificado</option><option value="desqualificado">Desqualificado</option><option value="sem">Sem qualificação</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-1.5 pb-2.5 text-sm"><input type="checkbox" name="visit" value="1" defaultChecked={!!f.visit} className="size-4" /> Só com visita</label>
          <button className={btnPrimary} type="submit">Filtrar</button>
          {hasFilter && <Link className={btnGhost} href="/historico">Limpar</Link>}
        </div>
      </form>

      {days.length === 0 ? (
        <div className={`${panelCls} p-10 text-center text-muted`}>{hasFilter ? "Nada encontrado com esses filtros." : "Você ainda não atendeu nenhum lead."}</div>
      ) : days.map(([k, list]) => (
        <section key={k} className="space-y-2">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold"><span className="display text-lg">{label(k)}</span><span className="font-normal text-muted">{plural(list.length, "atendimento", "atendimentos")}</span></h2>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.session_id} className={`${panelCls} flex flex-wrap items-start gap-3 p-4 transition hover:border-accent/50`}>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link href={`/leads/${r.lead_id}`} className="block truncate font-medium hover:underline">{r.trade_name ?? r.company}</Link>
                  <p className="text-xs text-muted">{hourFmt.format(new Date(r.saved_at))} · {fmtCnpj(r.cnpj)}{r.city ? ` · ${r.city}/${r.uf}` : ""} · tempo {fmtDuration(r.seconds)}{r.visits ? ` · visita ${r.visits}` : ""}</p>
                  {r.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{r.tags.map((t) => <TagChip key={t.key + t.group} label={t.label} color={t.color} />)}</div>}
                  {r.notes && <p className="line-clamp-2 rounded-md bg-sunk px-2.5 py-1.5 text-xs text-muted">{r.notes}</p>}
                </div>
                <AttendButton leadId={r.lead_id} compact />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className={`${panelCls} flex items-center gap-3 p-4`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-grad-soft text-accent">{icon}</span>
      <div className="min-w-0"><p className="text-xs text-muted">{label}</p><p className="figure text-2xl font-bold leading-tight">{value}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
    </div>
  );
}
