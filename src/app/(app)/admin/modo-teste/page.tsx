import { eq, sql } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import { TestMode } from "@/components/admin/test-mode";
import { PageHead } from "@/components/page-head";
import { db, leads } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.isTest, true));
  return (
    <div className="space-y-5">
      <PageHead icon={FlaskConical} size="md" title="Modo teste" />
      <TestMode count={r?.n ?? 0} />
    </div>
  );
}
