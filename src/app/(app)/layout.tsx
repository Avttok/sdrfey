import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { eoxBaseUrl } from "@/modules/eox/sync";
import { TouchHost } from "@/components/touch-host";
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
import { TermsProvider } from "@/components/terms";
import { getTermOverrides } from "@/modules/terms/get";
import { QuickDock, type QuickKey } from "@/components/quick-dock";
import { EnrichDock } from "@/components/enrich-dock";
import { LiveSnap } from "@/components/live-snap";
import { EggHunt, GoldFooterEgg } from "@/components/egg-hunt";
import { CopyGuard } from "@/components/copy-guard";
import { UpdateNotice } from "@/components/update-notice";
import { SwRegister } from "@/components/sw-register";
import { ChatMount } from "@/components/chat/chat-mount";
import { AvatarProvider } from "@/components/person-bubble";
import { db, tags, users } from "@/db";
import { tagIconKey } from "@/config/tag-icons";
import { TagIconProvider } from "@/components/tag-chip";
import { eq, isNotNull } from "drizzle-orm";
import { ScrollAssist } from "@/components/scroll-assist";
import { roteiroEnabled } from "@/modules/scripts/gate";
import { requireUser } from "@/modules/auth/guard";
import { eggHolders } from "@/modules/achievements/stats";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // tudo o que não depende de outra consulta sai junto: cada ida ao banco custa e, em fila, a soma pesa em toda tela
  const [settings, badges, termOverrides, av, eggs, tagRows, vocallRaw] = await Promise.all([
    getSettings(),
    navBadges(user).catch(() => ({})),
    getTermOverrides(),
    db.select({ id: users.id, name: users.name, avatar: users.avatar }).from(users).where(isNotNull(users.avatar)),
    eggHolders().catch(() => [] as number[]),
    db.select({ label: tags.label, key: tags.key, group: tags.groupKey, icon: tags.icon }).from(tags),
    settingValue(VOCALL_KEY),
  ]);
  const vocall = parseVocall(vocallRaw);
  const eoxBase = vocall.on ? await eoxBaseUrl().catch(() => "") : "";
  const [gold, vocallMe] = await Promise.all([
    goldStatus(user, settings).catch(() => ({ reached: false, label: "", done: 0, qty: 0 })),
    vocall.on && vocall.host ? db.select({ a: users.vocallAgentId, r: users.vocallRamal }).from(users).where(eq(users.id, user.id)) : Promise.resolve([] as { a: string | null; r: string | null }[]),
  ]);
  const groupNav = settings.nav_group === 1;
  const avatars = { byId: Object.fromEntries(av.map((a) => [a.id, a.avatar!])), byName: Object.fromEntries(av.map((a) => [a.name, a.avatar!])), eggs, me: user.id };
  const tagIcons = Object.fromEntries(tagRows.map((t) => [t.label.toUpperCase(), tagIconKey(t.icon, t.key, t.group)]));
  const [me] = vocallMe;
  const canDial = user.isAdmin || !!user.permissions["fn.dialer"];
  const roteiroOn = await roteiroEnabled(user);
  const dialer = canDial && vocall.on && vocall.host && me?.a && me?.r ? { cfg: { host: vocall.host, port: vocall.port, secure: vocall.secure, dac: vocall.dac, senha: vocall.senha, prefix: vocall.prefix }, agentId: me.a, ramal: me.r } : null;
  const shell = (children: React.ReactNode) => (dialer ? <VocallProvider cfg={dialer.cfg} agentId={dialer.agentId} ramal={dialer.ramal} eoxBase={eoxBase} roteiroOn={roteiroOn}>{children}</VocallProvider> : <>{children}</>);
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
      <TermsProvider value={termOverrides}>
      <TagIconProvider value={tagIcons}>
      <AvatarProvider value={avatars}>
      <div className={`flex flex-1 flex-col ${user.navLayout === "side" ? "lg:flex-row" : ""}`}>
        <Presence />
        <TouchHost />
        <Suspense fallback={null}><NavBusy /></Suspense>
        {user.navLayout === "side" && <div className="contents embed-hide"><SideBarFor user={user} badges={badges} groupNav={groupNav} /></div>}
        <div className="app-col flex min-w-0 flex-1 flex-col">
          <div className="contents embed-hide"><AppHeader user={user} badges={badges} groupNav={groupNav} navAlign={settings.nav_align} /></div>
          {user.isAdmin && user.navLayout === "side" && <div className="embed-hide hidden justify-end px-6 pt-3 lg:flex"><AdminViewSwitch mode={user.adminView} /></div>}
          <ScrollAssist />
          <main className="mx-auto flex w-full max-w-[92rem] flex-1 flex-col px-3 py-7 pb-10 sm:px-5 lg:px-6">{children}</main>
          <footer className="embed-hide relative z-40 px-4 pb-6 text-center text-xs text-muted"><span className="relative inline-block px-4 py-1.5"><span aria-hidden className="glow-pulse absolute inset-0 rounded-full bg-accent/50 blur-lg" /><span className="relative font-medium">Made by Ruan Carlos</span>{avatars.eggs.includes(user.id) && <GoldFooterEgg />}</span>{!avatars.eggs.includes(user.id) && <EggHunt />}</footer>
        </div>
      </div>
      <div className="contents embed-hide"><GoldMode reached={gold.reached} label={gold.label} userId={user.id} /></div>
      <div className="contents embed-hide"><AnnouncementHost /></div>
      <div className="contents embed-hide"><BottomFade /></div>
      <SwRegister />
      <UpdateNotice />
      <LiveSnap />
      {user.isAdmin && <div className="contents embed-hide"><EnrichDock side={user.navLayout === "side"} /></div>}
      {settings.copy_guard === 1 && !user.isAdmin && <CopyGuard />}
      <div className="embed-hide pointer-events-none fixed bottom-5 right-5 z-[45] flex flex-col items-end gap-2.5"><QuickDock items={quick} hasChat={!!hasChat} /><Suspense fallback={hasChat ? <div className="size-14" aria-hidden /> : null}><ChatMount user={user} /></Suspense></div>
      
      </AvatarProvider>
      </TagIconProvider>
      </TermsProvider>
    </ToastProvider>
  );
}
