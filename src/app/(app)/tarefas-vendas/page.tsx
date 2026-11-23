import type { Metadata } from "next";
import { TasksView } from "../tarefas/view";

export const metadata: Metadata = { title: "Tarefas de vendas" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TasksView searchParams={searchParams} area="vendas" />;
}
