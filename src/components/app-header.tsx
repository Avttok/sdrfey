import { LogOut } from "lucide-react";
import Link from "next/link";
import { topRole } from "@/config/roles";
import type { CurrentUser } from "@/modules/auth/guard";
import { logoutAction } from "@/modules/auth/actions";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { RoleBadge } from "./role-badge";
import { ThemeToggle } from "./theme-toggle";
import { btnGhost } from "./ui";

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur">
      <div className="thread" aria-hidden />
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/painel" aria-label="SDR Fey, ir para o painel">
          <Logo />
        </Link>
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
          <NavLinks roles={user.roles} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <div className="mt-0.5 flex justify-end">
              <RoleBadge role={topRole(user.roles)} />
            </div>
          </div>
          <ThemeToggle />
          <form action={logoutAction}>
            <button type="submit" className={btnGhost} aria-label="Sair">
              <LogOut size={16} aria-hidden />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
