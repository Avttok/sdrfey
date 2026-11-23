import type { Metadata } from "next";
import { TasksView } from "./view";

export const metadata: Metadata = { title: "Tarefas" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TasksView searchParams={searchParams} area="sdr" />;
}
