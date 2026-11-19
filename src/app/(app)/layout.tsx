import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { AppHeader, SideBarFor } from "@/components/app-header";
import { navBadges } from "@/modules/deals/queries";
import { getSettings } from "@/modules/settings/get";
import { BottomFade } from "@/components/bottom-fade";
import { SwRegister } from "@/components/sw-register";
import { ChatMount } from "@/components/chat/chat-mount";
import { requireUser } from "@/modules/auth/guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, badges] = await Promise.all([getSettings(), navBadges(user).catch(() => ({}))]);
  const groupNav = settings.nav_group === 1;
  return (
    <ToastProvider>
      <div className={`flex flex-1 flex-col ${user.navLayout === "side" ? "lg:flex-row" : ""}`}>
        <Presence />
        <Suspense fallback={null}><NavBusy /></Suspense>
        {user.navLayout === "side" && <SideBarFor user={user} badges={badges} groupNav={groupNav} />}
        <div className="app-col flex min-w-0 flex-1 flex-col">
          <AppHeader user={user} badges={badges} groupNav={groupNav} />
          <main className="mx-auto flex w-full max-w-[92rem] flex-1 flex-col px-3 py-7 pb-10 sm:px-5 lg:px-6">{children}</main>
          <footer className="relative z-40 px-4 pb-6 text-center text-xs text-muted"><span className="relative inline-block px-4 py-1.5"><span aria-hidden className="glow-pulse absolute inset-0 rounded-full bg-accent/50 blur-lg" /><span className="relative font-medium">Made by Ruan Carlos</span></span></footer>
        </div>
      </div>
      <BottomFade />
      <SwRegister />
      <Suspense fallback={null}><ChatMount user={user} /></Suspense>
    </ToastProvider>
  );
}
