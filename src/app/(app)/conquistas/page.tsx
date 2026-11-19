import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { AchievementsView } from "@/components/achievements-view";
import { PageHead } from "@/components/page-head";
import { groupsFor } from "@/config/achievements";
import { db, users } from "@/db";
import { requireUser } from "@/modules/auth/guard";
import { achievementsOf } from "@/modules/achievements/stats";

export const metadata: Metadata = { title: "Conquistas" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const me = await requireUser();
  const isAdmin = me.roles.includes("admin");
  const sp = await searchParams;
  const target = isAdmin && Number(sp.u) > 0 ? Number(sp.u) : me.id;
  const [person] = target === me.id ? [{ id: me.id, name: me.name, roles: me.roles }] : await db.select({ id: users.id, name: users.name, roles: users.roles }).from(users).where(eq(users.id, target));
  if (!person) return <p className="text-sm text-muted">Pessoa não encontrada.</p>;
  const [{ list }, people] = await Promise.all([achievementsOf(person.id, person.roles), isAdmin ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)) : Promise.resolve([])]);
  return (
    <div className="space-y-5">
      <PageHead icon={Trophy} title="Conquistas">
        {isAdmin && (
          <nav aria-label="Ver conquistas de" className="flex max-w-full flex-wrap gap-1.5">
            {people.map((p) => <Link key={p.id} href={p.id === me.id ? "/conquistas" : `/conquistas?u=${p.id}`} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${p.id === person.id ? "border-accent bg-accent/12 text-accent" : "border-line text-muted hover:bg-sunk"}`}>{p.name.split(" ")[0]}</Link>)}
          </nav>
        )}
      </PageHead>
      <AchievementsView rows={list.map((a) => ({ key: a.key, earned: a.earned, value: a.value, manual: a.manual }))} groups={groupsFor(person.roles)} who={person.id === me.id ? "Suas medalhas" : `Medalhas de ${person.name}`} adminFor={isAdmin ? person.id : undefined} />
    </div>
  );
}
