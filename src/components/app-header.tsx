import Link from "next/link";
import { orderNav, visibleNav } from "@/config/nav";
import { resolveAccent } from "@/config/theme";
import type { CurrentUser } from "@/modules/auth/guard";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { SideBar } from "./side-bar";
import { UserMenu } from "./user-menu";

function navFor(user: CurrentUser) {
  return orderNav(visibleNav(user.permissions, user.roles.includes("admin")).filter((i) => i.href !== "/conta"), user.navOrder).map((i) => i.href);
}

/** Barra horizontal no topo. Com a barra lateral ativa, só aparece em telas pequenas. */
export function AppHeader({ user }: { user: CurrentUser }) {
  const accent = resolveAccent(user.accent, user.roles);
  return (
    <header className={`sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur ${user.navLayout === "side" ? "lg:hidden" : ""}`}>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-x-6 px-4 py-2.5 sm:px-6">
        <Link href="/painel" aria-label="SDR FEY, ir para o início"><Logo /></Link>
        <div className="min-w-0 flex-1"><NavLinks hrefs={navFor(user)} /></div>
        <UserMenu name={user.name} username={user.username} hex={accent.hex} onHex={accent.onAccent} roles={user.roles} />
      </div>
    </header>
  );
}

/** Barra vertical à esquerda (só em telas largas). */
export function SideBarFor({ user }: { user: CurrentUser }) {
  const accent = resolveAccent(user.accent, user.roles);
  return <SideBar hrefs={navFor(user)} name={user.name} username={user.username} hex={accent.hex} onHex={accent.onAccent} roles={user.roles} initialCollapsed={user.navCollapsed} />;
}
