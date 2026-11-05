import Link from "next/link";
import { visibleNav } from "@/config/nav";
import { topRole } from "@/config/roles";
import { resolveAccent } from "@/config/theme";
import type { CurrentUser } from "@/modules/auth/guard";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

export function AppHeader({ user }: { user: CurrentUser }) {
  const accent = resolveAccent(user.accent, user.roles);
  const hrefs = visibleNav(user.permissions, user.roles.includes("admin")).map((i) => i.href).filter((h) => h !== "/conta");
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-x-6 px-4 py-2.5 sm:px-6">
        <Link href="/painel" aria-label="SDR Fey, ir para o início"><Logo /></Link>
        <div className="min-w-0 flex-1"><NavLinks hrefs={hrefs} /></div>
        <UserMenu name={user.name} hex={accent.hex} onHex={accent.onAccent} role={topRole(user.roles)} />
      </div>
    </header>
  );
}
