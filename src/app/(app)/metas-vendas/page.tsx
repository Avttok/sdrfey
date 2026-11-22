import type { Metadata } from "next";
import { MetasView } from "../metas/view";

export const metadata: Metadata = { title: "Metas de vendas" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MetasView searchParams={searchParams} kind="vendas" />;
}
