import { ListChecks } from "lucide-react";
import { and, asc, eq } from "drizzle-orm";
import { PageHead } from "@/components/page-head";
import { TaskBoard } from "@/components/task-board";
import { db, users } from "@/db";
import type { TaskArea } from "@/config/tasks";
import { requirePerm } from "@/modules/auth/guard";
import { visibleUsers } from "@/modules/auth/visibility";
import { listTasks } from "@/modules/tasks/queries";

/** Janela de Tarefas (SDR ou Vendas): o que os scripts deixaram combinado e o que a pessoa criou. Cada pessoa vê as suas; quem vê a equipe escolhe a pessoa. */
export async function TasksView({ searchParams, area }: { searchParams: Promise<Record<string, string | string[] | undefined>>; area: TaskArea }) {
  const me = await requirePerm(area === "sdr" ? "tab.tarefas" : "tab.tarefas_vendas");
  const sp = await searchParams;
  const team = me.isAdmin || !!me.permissions["panel.equipe"];
  const all = team ? await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), visibleUsers(me))).orderBy(asc(users.name)) : [];
  const asked = Number(typeof sp.u === "string" ? sp.u : "");
  const viewing = team && all.some((p) => p.id === asked) ? asked : me.id;
  const { open, done } = await listTasks(viewing, area);
  const other = viewing !== me.id ? all.find((p) => p.id === viewing)?.name ?? null : null;
  return (
    <div className="space-y-5">
      <PageHead icon={ListChecks} title="Tarefas" subtitle="O que os scripts deixaram combinado: ligar de novo, enviar e-mail, enviar a cotação. Tudo nasce sozinho no fim da ligação." />
      <TaskBoard area={area} open={open} done={done} people={team ? all : []} viewing={viewing} meId={me.id} otherName={other} />
    </div>
  );
}
