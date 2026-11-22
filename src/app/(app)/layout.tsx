import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { AppHeader, SideBarFor } from "@/components/app-header";
import { navBadges } from "@/modules/deals/queries";
import { getSettings } from "@/modules/settings/get";
import { AdminViewSwitch } from "@/components/admin-view-switch";
import { GoldMode } from "@/components/gold-mode";
import { goldStatus } from "@/modules/goals/gold";
import { AnnouncementHost } from "@/components/announcement-host";
import { BottomFade } from "@/components/bottom-fade";
import { CopyGuard } from "@/components/copy-guard";
import { SwRegister } from "@/components/sw-register";
import { ChatMount } from "@/components/chat/chat-mount";
import { AvatarProvider } from "@/components/person-bubble";
import { db, tags, users } from "@/db";
import { tagIconKey } from "@/config/tag-icons";
import { TagIconProvider } from "@/components/tag-chip";
import { isNotNull } from "drizzle-orm";
import { requireUser } from "@/modules/auth/guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, badges] = await Promise.all([getSettings(), navBadges(user).catch(() => ({}))]);
  const gold = await goldStatus(user, settings).catch(() => ({ reached: false, label: "", done: 0, qty: 0 }));
  const groupNav = settings.nav_group === 1;
  const av = await db.select({ id: users.id, name: users.name, avatar: users.avatar }).from(users).where(isNotNull(users.avatar));
  const avatars = { byId: Object.fromEntries(av.map((a) => [a.id, a.avatar!])), byName: Object.fromEntries(av.map((a) => [a.name, a.avatar!])) };
  const tagRows = await db.select({ label: tags.label, key: tags.key, group: tags.groupKey, icon: tags.icon }).from(tags);
  const tagIcons = Object.fromEntries(tagRows.map((t) => [t.label.toUpperCase(), tagIconKey(t.icon, t.key, t.group)]));
  return (
    <ToastProvider>
      <TagIconProvider value={tagIcons}>
      <AvatarProvider value={avatars}>
      <div className={`flex flex-1 flex-col ${user.navLayout === "side" ? "lg:flex-row" : ""}`}>
        <Presence />
        <Suspense fallback={null}><NavBusy /></Suspense>
        {user.navLayout === "side" && <SideBarFor user={user} badges={badges} groupNav={groupNav} />}
        <div className="app-col flex min-w-0 flex-1 flex-col">
          <AppHeader user={user} badges={badges} groupNav={groupNav} />
          {user.isAdmin && user.navLayout === "side" && <div className="hidden justify-end px-6 pt-3 lg:flex"><AdminViewSwitch mode={user.adminView} /></div>}
          <main className="mx-auto flex w-full max-w-[92rem] flex-1 flex-col px-3 py-7 pb-10 sm:px-5 lg:px-6">{children}</main>
          <footer className="relative z-40 px-4 pb-6 text-center text-xs text-muted"><span className="relative inline-block px-4 py-1.5"><span aria-hidden className="glow-pulse absolute inset-0 rounded-full bg-accent/50 blur-lg" /><span className="relative font-medium">Made by Ruan Carlos</span></span></footer>
        </div>
      </div>
      <GoldMode reached={gold.reached} label={gold.label} userId={user.id} />
      <AnnouncementHost />
      <BottomFade />
      <SwRegister />
      {settings.copy_guard === 1 && !user.isAdmin && <CopyGuard />}
      <Suspense fallback={null}><ChatMount user={user} /></Suspense>
      </AvatarProvider>
      </TagIconProvider>
    </ToastProvider>
  );
}
