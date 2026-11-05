import type { Metadata } from "next";
import { FontPicker } from "@/components/font-picker";
import { NavPrefsForm } from "@/components/nav-prefs-form";
import { orderNav, visibleNav } from "@/config/nav";
import { PageHead } from "@/components/page-head";
import { Check, UserRound } from "lucide-react";
import { DisplayNameForm } from "@/components/display-name-form";
import { PasswordForm } from "@/components/password-form";
import { RoleBadge } from "@/components/role-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnGhost, panelCls } from "@/components/ui";
import { CHOOSABLE_ACCENTS, resolveAccent } from "@/config/theme";
import { requireUser } from "@/modules/auth/guard";
import { setAccentAction } from "@/modules/users/actions";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  const current = resolveAccent(user.accent, user.roles);
  const navHrefs = orderNav(visibleNav(user.permissions, user.roles.includes("admin")).filter((i) => i.href !== "/conta"), user.navOrder).map((i) => i.href);

  return (
    <div className="space-y-6">
      <PageHead icon={UserRound} title="Minha conta" subtitle={`${user.name} · ${user.username}`}>
        <span className="flex gap-1.5">{user.roles.map((r) => <RoleBadge key={r} role={r} />)}</span>
      </PageHead>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${panelCls} p-6`}>
          <h2 className="display mb-5 text-xl">Meus dados</h2>
          <DisplayNameForm name={user.name} username={user.username} />
          <h2 className="display mb-5 mt-8 text-xl">Trocar senha</h2>
          <PasswordForm />
        </section>

        <section className={`${panelCls} p-6`}>
          <h2 className="display mb-5 text-xl">Aparência</h2>

          <p className="mb-2 text-sm font-medium">Cor do sistema</p>
          <p className="mb-3 text-xs text-muted">Vale para botões, destaques e para a sua bolha, que todos veem no sistema (Leads, Dashboard, Ao vivo).</p>
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
                  style={{ background: a.hex, color: a.key === "lima" ? "#1a1a1a" : "#fff" }}
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
          <h2 className="display mb-1 text-xl">Fonte</h2>
          <p className="mb-4 text-sm text-muted">A letra usada em todo o sistema, só para você.</p>
          <FontPicker current={user.font} />
        </section>

        <section className={`${panelCls} p-6 lg:col-span-2`}>
          <h2 className="display mb-5 text-xl">Barra de navegação</h2>
          <NavPrefsForm layout={user.navLayout} hrefs={navHrefs} />
        </section>
      </div>
    </div>
  );
}
