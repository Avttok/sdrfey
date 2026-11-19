import type { Metadata } from "next";
import { DbHealthPanel } from "@/components/admin/db-health-panel";

export const metadata: Metadata = { title: "Saúde do sistema" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <DbHealthPanel />;
}
