import Link from "next/link";
import { CalendarClock, Phone, PhoneCall, PhoneMissed, PhoneIncoming } from "lucide-react";
import { OutcomeChip } from "@/components/touch-timeline";
import { dueBucket } from "@/config/tasks";
import { fmtPhone } from "@/lib/format";
import type { TaskRow } from "@/modules/tasks/queries";
import type { todayCalls } from "@/modules/touches/queries";
import { panelCls } from "@/components/ui";

type Calls = Awaited<ReturnType<typeof todayCalls>>;

/** Ligações do dia (feitas) e as que faltam fazer (tarefas "Ligar" de hoje e atrasadas). */
export function CallsToday({ calls, open }: { calls: Calls; open: TaskRow[] }) {
  const todo = open.filter((t) => t.kind === "ligar" && ["atrasada", "hoje"].includes(dueBucket(t.dueAt)));
  const rate = calls.made ? Math.round((calls.reached / calls.made) * 100) : 0;
  const tile = (Icon: typeof Phone, n: number | string, label: string, tone = "text-accent") => (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3"><Icon size={20} className={tone} aria-hidden /><div><div className="display text-xl tabular-nums leading-none">{n}</div><div className="mt-0.5 text-xs text-muted">{label}</div></div></div>
  );
  return (
    <section className={`${panelCls} space-y-4 p-5`} aria-label="Ligações de hoje">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><PhoneCall size={16} aria-hidden /></span>Ligações de hoje</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tile(Phone, calls.made, "feitas")}
        {tile(PhoneIncoming, calls.made ? `${calls.reached} · ${rate}%` : "0", "falou com alguém", "text-ok")}
        {tile(PhoneMissed, calls.pending, "sem resultado registrado", calls.pending ? "text-warn" : "text-muted")}
        {tile(CalendarClock, todo.length, "a fazer (hoje e atrasadas)", todo.length ? "text-danger" : "text-muted")}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Últimas ligações</p>
          {calls.recent.length === 0 && <p className="text-sm text-muted">Nenhuma ligação por aqui hoje ainda.</p>}
          {calls.recent.map((c) => (
            <Link key={c.id} href={`/leads/${c.leadId}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm hover:bg-sunk/70">
              <span className="min-w-0 flex-1 truncate font-medium">{c.company}</span><span className="figure text-xs text-muted">{fmtPhone(c.target)}</span><OutcomeChip channel="call" outcome={c.outcome} />
            </Link>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ligar agora</p>
          {todo.length === 0 && <p className="text-sm text-muted">Nada de ligação pendente para hoje.</p>}
          {todo.slice(0, 6).map((t) => (
            <Link key={t.id} href={t.lead ? `/roteiro/${t.lead.id}` : "#"} className="flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm hover:bg-sunk/70">
              <span className="min-w-0 flex-1 truncate font-medium">{t.lead?.name ?? t.title}</span>{t.lead?.phone && <span className="figure text-xs text-muted">{fmtPhone(t.lead.phone)}</span>}<span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">Roteiro</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
