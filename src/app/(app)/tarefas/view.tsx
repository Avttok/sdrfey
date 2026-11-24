import { History, ListChecks } from "lucide-react";
import Link from "next/link";
import { ScriptHistory } from "@/components/script-history";
import { RUN_ORDER, runHistory, type RunStatus } from "@/modules/scripts/history";
import { and, asc, eq } from "drizzle-orm";
import { PageHead } from "@/components/page-head";
import { TaskBoard } from "@/components/task-board";
import { db, users } from "@/db";
import type { TaskArea } from "@/config/tasks";
import { requirePerm } from "@/modules/auth/guard";
import { visibleUsers } from "@/modules/auth/visibility";
import { CallsToday } from "@/components/calls-today";
import { listTasks } from "@/modules/tasks/queries";
import { todayCalls } from "@/modules/touches/queries";

/** Janela de Tarefas (SDR ou Vendas): o que os scripts deixaram combinado e o que a pessoa criou. Cada pessoa vê as suas; quem vê a equipe escolhe a pessoa. */
export async function TasksView({ searchParams, area }: { searchParams: Promise<Record<string, string | string[] | undefined>>; area: TaskArea }) {
  const me = await requirePerm(area === "sdr" ? "tab.tarefas" : "tab.tarefas_vendas");
  const sp = await searchParams;
  const team = me.isAdmin || !!me.permissions["panel.equipe"];
  const all = team ? await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name)) : [];
  const asked = Number(typeof sp.u === "string" ? sp.u : "");
  const viewing = team && all.some((p) => p.id === asked) ? asked : me.id;
  const other = viewing !== me.id ? all.find((p) => p.id === viewing)?.name ?? null : null;
  const base = area === "sdr" ? "/tarefas" : "/tarefas-vendas";
  const u = viewing !== me.id ? `?u=${viewing}` : "";
  const hist = sp.aba === "historico";
  const tabs = (
    <nav role="tablist" aria-label="Seção" className="inline-flex gap-1 rounded-full border border-line bg-panel p-1">
      <Link role="tab" aria-selected={!hist} href={`${base}${u}`} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold ${!hist ? "bg-grad text-on-accent" : "text-muted hover:text-ink"}`}><ListChecks size={14} aria-hidden /> Tarefas</Link>
      <Link role="tab" aria-selected={hist} href={`${base}?aba=historico${u ? `&u=${viewing}` : ""}`} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold ${hist ? "bg-grad text-on-accent" : "text-muted hover:text-ink"}`}><History size={14} aria-hidden /> Histórico de roteiros</Link>
    </nav>
  );
  if (hist) {
    const st = typeof sp.status === "string" && (RUN_ORDER as string[]).includes(sp.status) ? (sp.status as RunStatus) : null;
    const dn = Number(typeof sp.dias === "string" ? sp.dias : 30);
    const days = [0, 7, 30, 90].includes(dn) ? dn : 30;
    const h = await runHistory(viewing, area, { status: st, days: days || null, limit: sp.mais ? 200 : 30 });
    return (
      <div className="space-y-5">
        <PageHead icon={History} title="Histórico de roteiros" subtitle={`Todos os roteiros ${area === "sdr" ? "do SDR" : "de Vendas"}${other ? ` de ${other}` : ""}: terminados, convertidos, agendados e parados no meio.`} />
        {tabs}
        <ScriptHistory h={h} area={area} base={base} status={st} days={days} viewing={viewing !== me.id ? viewing : null} />
      </div>
    );
  }
  const [{ open, done }, calls] = await Promise.all([listTasks(viewing, area), todayCalls(viewing)]);
  return (
    <div className="space-y-5">
      <PageHead icon={ListChecks} title="Tarefas" subtitle="O que os scripts deixaram combinado: ligar de novo, enviar e-mail, enviar a cotação. Tudo nasce sozinho no fim da ligação." />
      {tabs}
      <CallsToday calls={calls} open={open} />
      <TaskBoard area={area} open={open} done={done} people={team ? all : []} viewing={viewing} meId={me.id} otherName={other} />
    </div>
  );
}
