import type { Metadata } from "next";
import { CalendarCheck, MessageCircle, Shuffle } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/guard";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Entrar" };

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Shuffle, title: "Um lead por vez", text: "O sistema sorteia o próximo e trava o lead só para você." },
  { icon: MessageCircle, title: "Do e-mail à ligação", text: "Modelos prontos, WhatsApp em um clique e telefones em ordem." },
  { icon: CalendarCheck, title: "Até o agendamento", text: "Metas do dia, visitas marcadas e tudo no histórico." },
];

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="relative flex flex-col justify-between gap-10 overflow-hidden px-6 py-8 text-white sm:px-12 sm:py-12" style={{ backgroundImage: "linear-gradient(145deg, #0b1020 0%, #1e1b4b 45%, #312e81 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-[26rem] rounded-full bg-[#3b82f6]/40 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 right-[-6rem] size-[30rem] rounded-full bg-[#ec4899]/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute right-1/4 top-1/3 size-72 rounded-full bg-[#8b5cf6]/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between lg:block">
          <Logo size="lg" tone="light" />
          <span className="lg:hidden"><ThemeToggle /></span>
        </div>
        <div className="relative">
          <h1 className="display max-w-lg text-4xl sm:text-5xl">Um lead por vez, do primeiro contato ao <span className="bg-gradient-to-r from-[#93c5fd] via-[#c4b5fd] to-[#f9a8d4] bg-clip-text text-transparent">agendamento.</span></h1>
          <ul className="mt-9 hidden max-w-md space-y-4 sm:block">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 ring-1 ring-white/20 backdrop-blur"><Icon size={19} aria-hidden /></span>
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-white/70">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-xs text-white/50 lg:block">SDR FEY · Gestão de leads da equipe</p>
      </section>

      <section className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="hidden justify-end lg:flex"><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="rounded-3xl border border-line bg-panel p-7 shadow-xl sm:p-8">
            <span aria-hidden className="mb-5 block h-1 w-14 rounded-full bg-grad" />
            <h2 className="display mb-1.5 text-3xl">Bem-vindo de volta</h2>
            <p className="mb-7 text-sm text-muted">Entre com o usuário e a senha que você recebeu.</p>
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
