import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FirstAccessForm } from "@/components/first-access-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { earnedKeysOf } from "@/modules/achievements/stats";
import { requireUser } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });

  /* Primeiro acesso concluído: nada mais a fazer aqui. A senha só muda em Minha conta. */
  if (!user.mustChangePassword && user.profileDone) redirect("/painel");
  const earned = user.mustChangePassword ? [] : await earnedKeysOf(user.id, user.roles);
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-xl px-5 py-10">
        <div className="flex items-center justify-between"><Logo /><ThemeToggle /></div>
        <h1 className="display mt-8 text-3xl sm:text-4xl">{user.mustChangePassword ? "Primeiro acesso: crie sua senha" : "Personalize seu perfil"}</h1>
        <p className="mb-6 mt-2 text-muted">{user.mustChangePassword ? "Troque a senha provisória por uma só sua e escolha como você aparece, a cor e o tema. Leva um minuto." : "Escolha nome, ícone, banner, cor e tema. Não precisa trocar a senha: ela continua a mesma. Você pode mudar tudo depois em Minha conta."}</p>
        <FirstAccessForm needPassword={user.mustChangePassword} name={user.name} username={user.username} roles={user.shownRoles} accent={user.accent} earned={earned} />
      </div>
    </main>
  );
}
