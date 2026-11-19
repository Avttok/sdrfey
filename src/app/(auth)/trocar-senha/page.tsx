import type { Metadata } from "next";
import { FirstAccessForm } from "@/components/first-access-form";
import { Logo } from "@/components/logo";
import { PasswordForm } from "@/components/password-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { panelCls } from "@/components/ui";
import { requireUser } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });

  if (!user.mustChangePassword) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-md px-6 py-12">
          <Logo />
          <h1 className="display mt-10 text-3xl">Trocar senha</h1>
          <p className="mb-8 mt-2 text-muted">Informe a senha atual e escolha uma nova.</p>
          <div className={`${panelCls} p-6`}><PasswordForm submitLabel="Salvar nova senha" /></div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-xl px-5 py-10">
        <div className="flex items-center justify-between"><Logo /><ThemeToggle /></div>
        <h1 className="display mt-8 text-3xl sm:text-4xl">Vamos deixar tudo com a sua cara</h1>
        <p className="mb-6 mt-2 text-muted">Escolha como você aparece, a cor e o tema, e crie sua senha. Leva um minuto.</p>
        <FirstAccessForm name={user.name} username={user.username} roles={user.roles} accent={user.accent} />
      </div>
    </main>
  );
}
