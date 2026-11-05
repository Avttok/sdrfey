import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { PasswordForm } from "@/components/password-form";
import { panelCls } from "@/components/ui";
import { requireUser } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Escolha sua senha" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });

  return (
    <main className="min-h-dvh">
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <Logo />
        <h1 className="display mt-10 text-3xl">
          {user.mustChangePassword ? `Olá, ${user.name}. Crie sua senha.` : "Trocar senha"}
        </h1>
        <p className="mb-8 mt-2 text-muted">
          {user.mustChangePassword
            ? "A senha inicial é provisória. Escolha uma só sua para continuar."
            : "Informe a senha atual e escolha uma nova."}
        </p>
        <div className={`${panelCls} p-6`}>
          <PasswordForm submitLabel="Salvar e entrar" />
        </div>
      </div>
    </main>
  );
}
