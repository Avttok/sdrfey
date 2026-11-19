import { and, asc, eq } from "drizzle-orm";
import { PanelTop } from "lucide-react";
import Link from "next/link";
import { NavCustomForm } from "@/components/admin/nav-custom-form";
import { NavPrefsForm } from "@/components/nav-prefs-form";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { NAV, orderNav } from "@/config/nav";
import { cleanCustom } from "@/config/nav-icons";
import { db, users } from "@/db";
import { requireAdmin } from "@/modules/auth/guard";
import { settingValue } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  await requireAdmin();
  const uid = Number((await searchParams).u) || 0;
  const people = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true))).orderBy(asc(users.name));
  const person = people.find((p) => p.id === uid);
  const order = ((await settingValue("nav_order")) as string[] | undefined) ?? [];
  const hrefs = orderNav(NAV.filter((i) => i.href !== "/conta"), order).map((i) => i.href);
  const global = cleanCustom(await settingValue("nav_custom"));
  const own = person ? cleanCustom(await settingValue(`nav_custom_u${person.id}`)) : null;
  const tab = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold transition ${active ? "bg-grad text-on-accent shadow" : "text-muted hover:text-ink"}`;
  return (
    <div className="space-y-5">
      <PageHead icon={PanelTop} size="md" title="Barra de menus" />
      <section className={`${panelCls} max-w-3xl space-y-4 p-5`}>
        <h2 className="display text-lg">Nomes e ícones</h2>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="inline-flex rounded-full border border-line bg-sunk p-1"><Link href="/admin/barra" className={tab(!person)}>Para todos</Link><span className={tab(!!person)}>Individual</span></nav>
          <form className="flex items-center gap-2">
            <select name="u" defaultValue={person?.id ?? ""} className="h-9 rounded-lg border border-line bg-panel px-3 text-sm" aria-label="Pessoa">
              <option value="">Escolher pessoa…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="h-9 rounded-lg border border-line bg-panel px-3 text-sm font-medium hover:text-accent">Editar</button>
          </form>
        </div>
        <p className="text-sm text-muted">{person ? `Vale só para ${person.name}; sobrepõe o que for definido para todos.` : "Vale para todo mundo. Só o Adm troca nomes e ícones; cada pessoa ainda reordena o próprio menu."}</p>
        <NavCustomForm key={person?.id ?? "all"} scope={person ? person.id : "global"} initial={person ? own! : global} base={person ? global : { items: {}, groups: {} }} />
      </section>
      <section className={`${panelCls} max-w-3xl p-5`}>
        <h2 className="display mb-1 text-lg">Ordem para todos</h2>
        <p className="mb-4 text-sm text-muted">Substitui as ordens pessoais. Quem não tem acesso a uma aba simplesmente não a vê.</p>
        <NavPrefsForm global layout="top" hrefs={hrefs} />
      </section>
    </div>
  );
}
