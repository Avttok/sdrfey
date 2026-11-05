import type { Metadata } from "next";
import { Check } from "lucide-react";
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">Minha conta</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-muted">
          <span>{user.name}</span>
          <span aria-hidden>·</span>
          <span>{user.username}</span>
          <span className="flex gap-1.5">
            {user.roles.map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${panelCls} p-6`}>
          <h2 className="display mb-5 text-2xl">Meus dados</h2>
          <DisplayNameForm name={user.name} username={user.username} />
          <h2 className="display mb-5 mt-8 text-2xl">Trocar senha</h2>
          <PasswordForm />
        </section>

        <section className={`${panelCls} p-6`}>
          <h2 className="display mb-5 text-2xl">Aparência</h2>

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
      </div>
    </div>
  );
}
