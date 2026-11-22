import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { AppHeader, SideBarFor } from "@/components/app-header";
import { navBadges } from "@/modules/deals/queries";
import { getSettings, settingValue } from "@/modules/settings/get";
import { VocallProvider } from "@/components/vocall-provider";
import { parseVocall, VOCALL_KEY } from "@/modules/vocall/config";
import { AdminViewSwitch } from "@/components/admin-view-switch";
import { GoldMode } from "@/components/gold-mode";
import { goldStatus } from "@/modules/goals/gold";
import { AnnouncementHost } from "@/components/announcement-host";
import { BottomFade } from "@/components/bottom-fade";
import { QuickDock, type QuickKey } from "@/components/quick-dock";
import { EnrichDock } from "@/components/enrich-dock";
import { LiveSnap } from "@/components/live-snap";
import { EggHunt, GoldFooterEggs } from "@/components/egg-hunt";
import { CopyGuard } from "@/components/copy-guard";
import { SwRegister } from "@/components/sw-register";
import { ChatMount } from "@/components/chat/chat-mount";
import { AvatarProvider } from "@/components/person-bubble";
import { db, tags, users } from "@/db";
import { tagIconKey } from "@/config/tag-icons";
import { TagIconProvider } from "@/components/tag-chip";
import { eq, isNotNull } from "drizzle-orm";
import { requireUser } from "@/modules/auth/guard";
import { eggHolders } from "@/modules/achievements/stats";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, badges] = await Promise.all([getSettings(), navBadges(user).catch(() => ({}))]);
  const gold = await goldStatus(user, settings).catch(() => ({ reached: false, label: "", done: 0, qty: 0 }));
  const groupNav = settings.nav_group === 1;
  const av = await db.select({ id: users.id, name: users.name, avatar: users.avatar }).from(users).where(isNotNull(users.avatar));
  const avatars = { byId: Object.fromEntries(av.map((a) => [a.id, a.avatar!])), byName: Object.fromEntries(av.map((a) => [a.name, a.avatar!])), eggs: await eggHolders().catch(() => [] as number[]), me: user.id };
  const tagRows = await db.select({ label: tags.label, key: tags.key, group: tags.groupKey, icon: tags.icon }).from(tags);
  const tagIcons = Object.fromEntries(tagRows.map((t) => [t.label.toUpperCase(), tagIconKey(t.icon, t.key, t.group)]));
  const vocall = parseVocall(await settingValue(VOCALL_KEY));
  const [me] = vocall.on && vocall.host ? await db.select({ a: users.vocallAgentId, r: users.vocallRamal }).from(users).where(eq(users.id, user.id)) : [];
  const dialer = vocall.on && vocall.host && me?.a && me?.r ? { cfg: { host: vocall.host, port: vocall.port, secure: vocall.secure, dac: vocall.dac, senha: vocall.senha, prefix: vocall.prefix }, agentId: me.a, ramal: me.r } : null;
  const shell = (children: React.ReactNode) => (dialer ? <VocallProvider cfg={dialer.cfg} agentId={dialer.agentId} ramal={dialer.ramal}>{children}</VocallProvider> : <>{children}</>);
  const perm = (k: string) => user.isAdmin || !!user.permissions[k];
  const quick: QuickKey[] = [
    ...(perm("tab.negociacoes") && (user.roles.includes("seller") || user.permissions["deals.team"]) ? ["new-deal" as const] : []),
    ...(perm("tab.comecar") ? ["shuffle" as const] : []),
    ...(perm("tab.shuffler_vendas") ? ["shuffle-sales" as const] : []),
    ...(perm("tab.visitas") ? ["visits" as const] : []),
    ...(perm("tab.leads") ? ["leads" as const] : []),
    ...(user.isAdmin ? ["admin" as const] : []),
  ];
  const hasChat = user.permissions["chat.use"] && settings.chat_on === 1;
  return shell(
    <ToastProvider>
      <TagIconProvider value={tagIcons}>
      <AvatarProvider value={avatars}>
      <div className={`flex flex-1 flex-col ${user.navLayout === "side" ? "lg:flex-row" : ""}`}>
        <Presence />
        <Suspense fallback={null}><NavBusy /></Suspense>
        {user.navLayout === "side" && <SideBarFor user={user} badges={badges} groupNav={groupNav} />}
        <div className="app-col flex min-w-0 flex-1 flex-col">
          <AppHeader user={user} badges={badges} groupNav={groupNav} navAlign={settings.nav_align} />
          {user.isAdmin && user.navLayout === "side" && <div className="hidden justify-end px-6 pt-3 lg:flex"><AdminViewSwitch mode={user.adminView} /></div>}
          <main className="mx-auto flex w-full max-w-[92rem] flex-1 flex-col px-3 py-7 pb-10 sm:px-5 lg:px-6">{children}</main>
          <footer className="relative z-40 px-4 pb-6 text-center text-xs text-muted"><span className="relative inline-block px-4 py-1.5"><span aria-hidden className="glow-pulse absolute inset-0 rounded-full bg-accent/50 blur-lg" /><span className="relative font-medium">Made by Ruan Carlos</span></span>{avatars.eggs.includes(user.id) ? <GoldFooterEggs /> : <EggHunt />}</footer>
        </div>
      </div>
      <GoldMode reached={gold.reached} label={gold.label} userId={user.id} />
      <AnnouncementHost />
      <BottomFade />
      <SwRegister />
      <LiveSnap />
      {user.isAdmin && <EnrichDock side={user.navLayout === "side"} />}
      {settings.copy_guard === 1 && !user.isAdmin && <CopyGuard />}
      <QuickDock items={quick} hasChat={!!hasChat} />
      <Suspense fallback={null}><ChatMount user={user} /></Suspense>
      </AvatarProvider>
      </TagIconProvider>
    </ToastProvider>
  );
}
