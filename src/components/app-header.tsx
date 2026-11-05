import Link from "next/link";
import { orderNav, visibleNav } from "@/config/nav";
import { topRole } from "@/config/roles";
import { resolveAccent } from "@/config/theme";
import type { CurrentUser } from "@/modules/auth/guard";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
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
        <UserMenu name={user.name} hex={accent.hex} onHex={accent.onAccent} role={topRole(user.roles)} />
      </div>
    </header>
  );
}

/** Barra vertical à esquerda (só em telas largas). */
export function SideBar({ user }: { user: CurrentUser }) {
  const accent = resolveAccent(user.accent, user.roles);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-panel px-3 py-5 lg:flex">
      <Link href="/painel" aria-label="SDR FEY, ir para o início" className="px-3"><Logo /></Link>
      <div className="min-h-0 flex-1 overflow-y-auto"><NavLinks hrefs={navFor(user)} vertical /></div>
      <div className="border-t border-line pt-4">
        <UserMenu side name={user.name} hex={accent.hex} onHex={accent.onAccent} role={topRole(user.roles)} />
      </div>
    </aside>
  );
}
