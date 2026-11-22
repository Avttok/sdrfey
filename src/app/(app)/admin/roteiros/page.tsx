import { sql } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import { ScriptsAdmin, type AdminScriptRow } from "@/components/admin/scripts-admin";
import { PageHead } from "@/components/page-head";
import { db } from "@/db";
import { ensureGlobalScripts, SEED_VERSION } from "@/modules/scripts/seed";

export const dynamic = "force-dynamic";

export default async function Page() {
  await ensureGlobalScripts();
  const rows = await db.execute<{ id: number; title: string; goal: string; n: number; seed_key: string | null; edited: boolean; at: Date }>(sql`select id, title, goal, jsonb_array_length(nodes)::int as n, seed_key, (updated_at > created_at + interval '2 seconds') as edited, updated_at as at from scripts where owner_id is null order by seed_key is null, goal, title`);
  const list: AdminScriptRow[] = rows.map((r) => ({ id: r.id, title: r.title, goal: r.goal, nodes: r.n, seed: !!r.seed_key, edited: r.edited, updatedAt: new Date(r.at).toISOString() }));
  return <div className="space-y-5"><PageHead icon={ScrollText} size="md" title="Roteiros de ligação" /><ScriptsAdmin rows={list} version={SEED_VERSION} /></div>;
}
