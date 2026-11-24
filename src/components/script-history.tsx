import { ChevronDown, Clock, ExternalLink, Pause, ScrollText, SkipForward } from "lucide-react";
import Link from "next/link";
import { OUTCOMES } from "@/config/scripts";
import type { TaskArea } from "@/config/tasks";
import { RUN_ORDER, RUN_STATUS, type RunHistory, type RunStatus } from "@/modules/scripts/history";

const TONE = { ok: "bg-ok/15 text-ok", info: "bg-accent/15 text-accent", warn: "bg-warn/20 text-warn", bad: "bg-danger/15 text-danger", muted: "bg-sunk text-muted" } as const;
const PERIODS = [[7, "7 dias"], [30, "30 dias"], [90, "90 dias"], [0, "Tudo"]] as const;
const mmss = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min` : s >= 60 ? `${Math.floor(s / 60)}min ${s % 60}s` : `${s}s`);
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Painel do histórico de roteiros (SDR ou Vendas): números, filtros, desempenho por roteiro e a lista com o caminho de cada ligação. */
export function ScriptHistory({ h, area, base, status, days, viewing }: { h: RunHistory; area: TaskArea; base: string; status: RunStatus | null; days: number; viewing: number | null }) {
  const href = (o: { status?: RunStatus | null; days?: number; more?: boolean }) => {
    const q = new URLSearchParams({ aba: "historico" });
    const st = o.status === undefined ? status : o.status; if (st) q.set("status", st);
    const d = o.days ?? days; if (d !== 30) q.set("dias", String(d));
    if (viewing) q.set("u", String(viewing));
    if (o.more) q.set("mais", "1");
    return `${base}?${q}`;
  };
  const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const done = h.total - h.byStatus.parado;
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Resumo dos roteiros">
        <Card label="Roteiros" value={h.total} hint={`${done} terminados`} />
        <Card label="Convertidos" value={h.byStatus.convertido} hint={`${rate(h.byStatus.convertido, h.total)} do total`} tone="ok" />
        <Card label="Agendados" value={h.byStatus.agendado} hint="visita ou retorno" tone="info" />
        <Card label="Parados no meio" value={h.byStatus.parado} hint={`${rate(h.byStatus.parado, h.total)} do total`} tone="warn" />
        <Card label="Leads pulados" value={h.skipped} hint="escondidos agora" icon={<SkipForward size={14} aria-hidden />} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Situação" className="flex flex-wrap gap-1.5">
          <Chip href={href({ status: null })} on={!status}>Todos · {h.total}</Chip>
          {RUN_ORDER.map((k) => <Chip key={k} href={href({ status: k })} on={status === k}>{RUN_STATUS[k].label} · {h.byStatus[k]}</Chip>)}
        </nav>
        <nav aria-label="Período" className="ml-auto flex gap-1 rounded-full border border-line bg-panel p-1">
          {PERIODS.map(([d, l]) => <Link key={d} href={href({ days: d })} className={`rounded-full px-3 py-1 text-xs font-bold ${days === d ? "bg-grad text-on-accent" : "text-muted hover:text-ink"}`}>{l}</Link>)}
        </nav>
      </div>

      {h.byScript.length > 0 && (
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Desempenho por roteiro</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-semibold">Roteiro</th><th className="font-semibold">Usos</th><th className="font-semibold">Convertidos</th><th className="font-semibold">Agendados</th><th className="font-semibold">Parados</th></tr></thead>
              <tbody>{h.byScript.map((s) => <tr key={s.title} className="border-t border-line/60"><td className="py-1.5 pr-2 font-semibold">{s.title}</td><td className="figure">{s.runs}</td><td className="figure text-ok">{s.converted}</td><td className="figure text-accent">{s.scheduled}</td><td className="figure text-warn">{s.stopped}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-label="Roteiros feitos" className="space-y-2">
        {h.rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nenhum roteiro {status ? `“${RUN_STATUS[status].label}” ` : ""}neste período. Eles aparecem aqui sozinhos quando você usa o roteiro numa ligação ({area === "sdr" ? "Shuffler Prospecção" : "Vendas"}).</p>}
        {h.rows.map((r) => {
          const st = RUN_STATUS[r.status];
          const out = r.outcome ? OUTCOMES[r.outcome as keyof typeof OUTCOMES]?.label : null;
          return (
            <details key={r.id} className="group rounded-2xl border border-line bg-panel">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3.5 [&::-webkit-details-marker]:hidden">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[st.tone]}`}>{r.status === "parado" ? <Pause size={11} className="mr-1 inline" aria-hidden /> : null}{st.label}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{r.company}</span>
                <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex"><ScrollText size={12} aria-hidden /> {r.scriptTitle}</span>
                <span className="figure flex items-center gap-1 text-xs text-muted"><Clock size={12} aria-hidden /> {when(r.startedAt)} · {mmss(r.seconds)}</span>
                <ChevronDown size={16} className="text-muted transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-3 border-t border-line/70 p-4 text-sm">
                <p className="text-muted">Roteiro <b className="text-ink">{r.scriptTitle}</b>{r.contactName ? <> · falou com <b className="text-ink">{r.contactName}</b></> : null}{out ? <> · resultado: <b className="text-ink">{out}</b></> : null}{r.status === "parado" ? " · ficou no meio, sem finalizar" : ""}</p>
                {r.steps.length > 0 && (
                  <ol className="space-y-1.5">
                    {r.steps.map((s, i) => (
                      <li key={`${s.id}-${i}`} className="flex gap-2">
                        <span className="figure mt-0.5 w-5 shrink-0 text-right text-xs text-muted">{i + 1}.</span>
                        <span className="min-w-0"><span className="font-semibold">{s.title}</span>{s.answer ? <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-semibold ${s.kind === "objecao" ? "bg-danger/15 text-danger" : s.kind === "ok" ? "bg-ok/15 text-ok" : "bg-sunk text-muted"}`}>{s.answer}</span> : null}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {r.notes.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-muted">{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
                <Link href={`/leads/${r.leadId}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"><ExternalLink size={12} aria-hidden /> Abrir o lead</Link>
              </div>
            </details>
          );
        })}
        {h.hasMore && <Link href={href({ more: true })} className="block rounded-xl border border-line py-2.5 text-center text-sm font-semibold hover:bg-sunk">Mostrar mais</Link>}
      </section>
    </div>
  );
}

function Card({ label, value, hint, tone, icon }: { label: string; value: number; hint: string; tone?: "ok" | "info" | "warn"; icon?: React.ReactNode }) {
  const c = tone === "ok" ? "text-ok" : tone === "info" ? "text-accent" : tone === "warn" ? "text-warn" : "text-ink";
  return <div className="rounded-2xl border border-line bg-panel p-3.5"><p className="flex items-center gap-1.5 text-xs font-semibold text-muted">{icon}{label}</p><p className={`figure text-2xl font-extrabold ${c}`}>{value}</p><p className="text-xs text-muted">{hint}</p></div>;
}
function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`rounded-full border px-3 py-1 text-xs font-bold ${on ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{children}</Link>;
}
