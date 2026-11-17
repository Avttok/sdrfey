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
        <div className="min-w-0 flex-1">
          <AppHeader user={user} badges={badges} groupNav={groupNav} />
          <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:px-6">{children}</main>
        </div>
      </div>
      <Suspense fallback={null}><ChatMount user={user} /></Suspense>
    </ToastProvider>
  );
}
