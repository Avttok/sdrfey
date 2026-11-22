import { and, asc, eq } from "drizzle-orm";
import { PanelTop } from "lucide-react";
import Link from "next/link";
import { NavAlign } from "@/components/admin/nav-align";
import { getSettings } from "@/modules/settings/get";
import { NavCustomForm } from "@/components/admin/nav-custom-form";
import { PageHead } from "@/components/page-head";
import { panelCls } from "@/components/ui";
import { NAV, orderNav } from "@/config/nav";
import { cleanTree, defaultTree } from "@/config/nav-tree";
import { cleanCustom, mergeCustom } from "@/config/nav-icons";
import { db, users } from "@/db";
import { requireAdmin } from "@/modules/auth/guard";
import { settingValue } from "@/modules/settings/get";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  await requireAdmin();
  const uid = Number((await searchParams).u) || 0;
  const people = await db.select({ id: users.id, name: users.name, navOrder: users.navOrder, navLayout: users.navLayout }).from(users).where(and(eq(users.active, true))).orderBy(asc(users.name));
  const person = people.find((p) => p.id === uid);
  const order = ((await settingValue("nav_order")) as string[] | undefined) ?? [];
  const hrefs = orderNav(NAV.filter((i) => i.href !== "/conta"), person?.navOrder?.length ? person.navOrder : order).map((i) => i.href);
  const global = cleanCustom(await settingValue("nav_custom"));
  const own = person ? cleanCustom(await settingValue(`nav_custom_u${person.id}`)) : null;
  const ownTree = person ? cleanTree(await settingValue(`nav_tree_u${person.id}`)) : null;
  const globalTree = cleanTree(await settingValue("nav_tree"));
  const merged = mergeCustom(global, own);
  const gl = Object.fromEntries(Object.entries(merged.groups).map(([k, v]) => [k, v.label])), gi = Object.fromEntries(Object.entries(merged.groups).map(([k, v]) => [k, v.icon]));
  const tree = ownTree ?? globalTree ?? defaultTree(hrefs, gl, gi);
  const hadTree = !!(ownTree ?? globalTree);
  const tab = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold transition ${active ? "bg-grad text-on-accent shadow" : "text-muted hover:text-ink"}`;
  return (
    <div className="space-y-5">
      <PageHead icon={PanelTop} size="md" title="Barra de menus" />
      <section className={`${panelCls} p-5`}><NavAlign initial={(await getSettings()).nav_align} /></section>
      <section className={`${panelCls} space-y-4 p-5`}>
        <h2 className="display text-lg">Nome, ícone e ordem</h2>
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
        <p className="text-sm text-muted">{person ? `Vale só para ${person.name}; sobrepõe o que for definido para todos.` : "Vale para todo mundo. Só o Adm troca nomes e ícones; cada pessoa ainda reordena o próprio menu. A ordem aqui substitui as ordens pessoais."}</p>
        <NavCustomForm key={person?.id ?? "all"} scope={person ? person.id : "global"} initial={person ? own! : global} base={person ? global : { items: {}, groups: {} }} tree={tree} hadTree={hadTree} />
      </section>
    </div>
  );
}
