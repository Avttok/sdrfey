import type { Metadata } from "next";
import { SellerHistory } from "@/components/deals/seller-history";
import { requirePerm } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Histórico de vendas" };
export const dynamic = "force-dynamic";

/** Histórico das negociações do vendedor (a parte de Vendas do antigo Histórico). */
export default async function SalesHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePerm("tab.historico_vendas");
  return <SellerHistory userId={me.id} sp={await searchParams} />;
}
