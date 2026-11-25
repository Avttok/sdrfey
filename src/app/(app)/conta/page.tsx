import { BannerPicker } from "@/components/banner-picker";
import { AvatarPicker } from "@/components/avatar-picker";
import type { Metadata } from "next";
import { MapModePicker } from "@/components/map-mode-picker";
import { FontPicker } from "@/components/font-picker";
import { MyNavLayout } from "@/components/my-nav-layout";
import { PageHead } from "@/components/page-head";
import { Check, UserRound } from "lucide-react";
import { DisplayNameForm } from "@/components/display-name-form";
import { PasswordForm } from "@/components/password-form";
import { RoleBadge } from "@/components/role-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnGhost, panelCls } from "@/components/ui";
import { CHOOSABLE_ACCENTS, resolveAccent, swatchBg } from "@/config/theme";
import { earnedKeysOf } from "@/modules/achievements/stats";
import { requireUser } from "@/modules/auth/guard";
import { MyDialerForm } from "@/components/my-dialer-form";
import { db, shopPurchases, users } from "@/db";
import { eq } from "drizzle-orm";
import { setAccentAction } from "@/modules/users/actions";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  const current = resolveAccent(user.accent, user.shownRoles);
  const earned = await earnedKeysOf(user.id, user.roles);
  const ownedShop = (await db.select({ k: shopPurchases.itemKey }).from(shopPurchases).where(eq(shopPurchases.userId, user.id))).map((r) => r.k);
  const canDial = user.isAdmin || !!user.permissions["fn.dialer"];
  const [vp] = canDial ? await db.select({ a: users.vocallAgentId, r: users.vocallRamal }).from(users).where(eq(users.id, user.id)) : [];

  return (
    <div className="space-y-6">
      <PageHead icon={UserRound} hex="#8b5cf6" title="Minha conta" subtitle={`${user.name} · ${user.username}`}>
        <span className="flex gap-1.5">{user.shownRoles.map((r) => <RoleBadge key={r} role={r} />)}</span>
      </PageHead>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${panelCls} p-6`}>
          <h2 className="display mb-5 text-xl">Meus dados</h2>
          <DisplayNameForm name={user.name} username={user.username} />
          {canDial && <><h2 className="display mb-5 mt-8 text-xl">Discador (VocallPhone)</h2><MyDialerForm agentId={vp?.a ?? ""} ramal={vp?.r ?? ""} /></>}
          <h2 className="display mb-5 mt-8 text-xl">Trocar senha</h2>
          <PasswordForm />
        </section>

        <section className={`${panelCls} p-6`}>
          <h2 className="display mb-5 text-xl">Aparência</h2>

          <div className="mb-6"><BannerPicker current={user.banner} earned={earned} ownedShop={ownedShop} /></div>
          <div className="mb-6"><AvatarPicker earned={earned} current={user.avatar} initials={user.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()} /></div>

          <div className="mb-6"><MyNavLayout current={user.navLayout} /></div>

          <p className="mb-2 text-sm font-medium">Cor do sistema</p>
          <form action={setAccentAction} className="flex flex-wrap gap-2.5">
            {CHOOSABLE_ACCENTS.map((a) => {
              const selected = a.key === current.key;
              return (
                <button
                  key={a.key}
                  type="submit"
                  name="accent"
                  value={a.key}
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={selected}
                  className="flex size-10 items-center justify-center rounded-full ring-offset-2 ring-offset-panel transition hover:scale-105 aria-pressed:ring-2 aria-pressed:ring-ink"
                  style={{ background: swatchBg(a), color: a.key === "lima" ? "#1a1a1a" : "#fff" }}
                >
                  {selected && <Check size={18} aria-hidden />}
                </button>
              );
            })}
          </form>
          <form action={setAccentAction} className="mt-3">
            <button type="submit" name="accent" value="" className={btnGhost}>
              Voltar à cor padrão do meu cargo
            </button>
          </form>

          <p className="mb-2 mt-8 text-sm font-medium">Tema</p>
          <ThemeToggle withLabels />
        </section>

        <section className={`${panelCls} p-6 lg:col-span-2`}>
          <h2 className="display mb-1 text-xl">Mapa do lead</h2>
          <MapModePicker current={user.mapMode} />
        </section>

        <section className={`${panelCls} p-6 lg:col-span-2`}>
          <h2 className="display mb-1 text-xl">Fonte</h2>
          <p className="mb-4 text-sm text-muted">A letra usada em todo o sistema, só para você.</p>
          <FontPicker current={user.font} />
        </section>

        <section className={`${panelCls} p-6 lg:col-span-2`}>
          <h2 className="display mb-5 text-xl">Barra de navegação</h2>
          {user.navTree && <p className="mb-4 rounded-xl bg-sunk px-4 py-3 text-sm text-muted">As pastas e a ordem do menu foram definidas pelo Adm. A posição da barra (topo ou lateral) você ainda escolhe aqui.</p>}
        </section>
      </div>
    </div>
  );
}
