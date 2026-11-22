import { asc } from "drizzle-orm";
import { Tags } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { TagsAdmin } from "@/components/admin/tags-admin";
import { count, eq } from "drizzle-orm";
import { db, leadTags, tagGroups, tags } from "@/db";

export const dynamic = "force-dynamic";

export default async function Page() {
  const groups = await db.select().from(tagGroups).orderBy(asc(tagGroups.sort));
  const all = await db.select().from(tags).orderBy(asc(tags.sort), asc(tags.label));
  const uses = new Map((await db.select({ id: leadTags.tagId, n: count() }).from(leadTags).groupBy(leadTags.tagId)).map((u) => [u.id, Number(u.n)]));
  return (
    <div className="space-y-5">
      <PageHead icon={Tags} size="md" title="Tags" />
      <p className="rounded-xl bg-sunk px-4 py-3 text-sm text-muted">“Tira do sorteio” esconde o lead do sorteio; “Volta em X dias” o traz de volta. Porte e capital nascem sozinhos na importação.</p>
      <TagsAdmin groups={groups.map((g) => ({ key: g.key, name: g.name, tags: all.filter((t) => t.groupKey === g.key).map((t) => ({ id: t.id, groupKey: t.groupKey, label: t.label, color: t.color, blocksSorting: t.blocksSorting, cooldownDays: t.cooldownDays, active: t.active, autoOnly: t.autoOnly, icon: t.icon, tagKey: t.key, uses: uses.get(t.id) ?? 0 })) }))} />
    </div>
  );
}
