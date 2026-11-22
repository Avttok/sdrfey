import type { Metadata } from "next";
import { MetasView } from "./view";

export const metadata: Metadata = { title: "Metas" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MetasView searchParams={searchParams} kind="sdr" />;
}
