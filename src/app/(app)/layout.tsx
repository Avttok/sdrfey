import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { AppHeader, SideBarFor } from "@/components/app-header";
import { navBadges } from "@/modules/deals/queries";
import { getSettings } from "@/modules/settings/get";
import { ChatMount } from "@/components/chat/chat-mount";
import { requireUser } from "@/modules/auth/guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, badges] = await Promise.all([getSettings(), navBadges(user).catch(() => ({}))]);
  const groupNav = settings.nav_group === 1;
  return (
    <ToastProvider>
      <div className={`min-h-dvh ${user.navLayout === "side" ? "lg:flex" : ""}`}>
        <Presence />
        <Suspense fallback={null}><NavBusy /></Suspense>
        {user.navLayout === "side" && <SideBarFor user={user} badges={badges} groupNav={groupNav} />}
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <AppHeader user={user} badges={badges} groupNav={groupNav} />
          <main className="mx-auto w-full max-w-[92rem] flex-1 px-3 py-7 pb-10 sm:px-5 lg:px-6">{children}</main>
          <footer className="px-4 pb-6 text-center text-xs text-muted">Made by Ruan Carlos</footer>
        </div>
      </div>
      <Suspense fallback={null}><ChatMount user={user} /></Suspense>
    </ToastProvider>
  );
}
