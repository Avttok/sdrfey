import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/guard";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Entrar" };

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sunk p-12 md:flex">
        <Logo size="lg" />
        <div>
          <h1 className="display max-w-md text-5xl">Um lead por vez, do primeiro contato ao agendamento.</h1>
          <p className="mt-5 max-w-sm text-muted">
            O sistema sorteia o próximo lead, mostra os dados da empresa e guia e-mail, WhatsApp e ligação.
          </p>
        </div>
      </section>

      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between md:justify-end">
          <span className="md:hidden">
            <Logo />
          </span>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="display mb-1.5 text-3xl">Entrar</h2>
          <p className="mb-8 text-muted">Use o usuário e a senha que você recebeu.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
