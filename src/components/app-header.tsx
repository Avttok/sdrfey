import Link from "next/link";
import { orderNav, visibleNav } from "@/config/nav";
import { resolveAccent } from "@/config/theme";
import type { CurrentUser } from "@/modules/auth/guard";
import { AdminViewSwitch } from "./admin-view-switch";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { SideBar } from "./side-bar";
import { UserMenu } from "./user-menu";

function navFor(user: CurrentUser) {
  return orderNav(visibleNav(user.permissions, user.isAdmin).filter((i) => i.href !== "/conta"), user.navOrder).map((i) => i.href);
}

/** Barra horizontal no topo. Com a barra lateral ativa, só aparece em telas pequenas. */
export function AppHeader({ user, badges = {}, groupNav = true }: { user: CurrentUser; badges?: Record<string, number>; groupNav?: boolean }) {
  const accent = resolveAccent(user.accent, user.shownRoles);
  return (
    <header className={`sticky top-0 z-20 border-b border-line bg-panel ${user.navLayout === "side" ? "lg:hidden" : ""}`}>
      <div className="mx-auto flex w-full max-w-[92rem] items-center gap-x-6 px-3 py-2.5 sm:px-5 lg:px-6">
        <Link href="/painel" aria-label="SDR FEY, ir para o início" className="flex items-center transition hover:scale-[1.03]"><Logo /></Link>
        <div className="min-w-0 flex-1"><NavLinks hrefs={navFor(user)} badges={badges} grouped={groupNav} custom={user.navCustom} tree={user.navTree} /></div>
        {user.isAdmin && <AdminViewSwitch mode={user.adminView} />}
        <UserMenu name={user.name} username={user.username} hex={accent.hex} onHex={accent.onAccent} accentKey={accent.key} roles={user.shownRoles} avatar={user.avatar} banner={user.banner} />
      </div>
    </header>
  );
}

/** Barra vertical à esquerda (só em telas largas). */
export function SideBarFor({ user, badges = {}, groupNav = true }: { user: CurrentUser; badges?: Record<string, number>; groupNav?: boolean }) {
  const accent = resolveAccent(user.accent, user.shownRoles);
  return <SideBar hrefs={navFor(user)} name={user.name} username={user.username} hex={accent.hex} onHex={accent.onAccent} accentKey={accent.key} roles={user.shownRoles} avatar={user.avatar} banner={user.banner} initialCollapsed={user.navCollapsed} badges={badges} grouped={groupNav} custom={user.navCustom} tree={user.navTree} />;
}
