import { eq, sql } from "drizzle-orm";
import { TestMode } from "@/components/admin/test-mode";
import { db, leads } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.isTest, true));
  return <TestMode count={r?.n ?? 0} />;
}
