import type { Metadata } from "next";
import { CalendarCheck, MessageCircle, Shuffle, X } from "lucide-react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/modules/auth/guard";
import { forgetQuickAction, quickLoginAction } from "@/modules/auth/actions";
import { QUICK_COOKIE, readQuick } from "@/modules/auth/token";
import { SubmitButton } from "@/components/submit-button";
import { LoginForm } from "@/components/login-form";
import { Tile, glass, Mark } from "@/components/theme-kit";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Entrar" };

export const dynamic = "force-dynamic";

const FEATURES = [
  { hex: "#3b82f6", icon: Shuffle, title: "Um lead por vez", text: "O sistema sorteia o próximo e trava o lead só para você." },
  { hex: "#10b981", icon: MessageCircle, title: "Do e-mail à ligação", text: "Modelos prontos e WhatsApp em um clique." },
  { hex: "#f59e0b", icon: CalendarCheck, title: "Até o agendamento", text: "Metas do dia, visitas marcadas e tudo no histórico." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ outra?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const qc = (await cookies()).get(QUICK_COOKIE)?.value;
  const quick = qc ? await readQuick(qc) : [];
  const other = (await searchParams).outra === "1";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
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
            {FEATURES.map(({ icon: Icon, title, text, hex }) => (
              <li key={title} className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur-md">
                <Tile icon={Icon} hex={hex} />
                <span><span className="block font-semibold">{title}</span><span className="block text-balance text-sm text-white/70">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-xs text-white/50 lg:block">Made by Ruan</p>
      </section>

      <section className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="hidden justify-end lg:flex"><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="relative overflow-hidden rounded-3xl border-2 p-7 shadow-xl sm:p-8" style={glass("#6366f1", 14, 3)}>
            <Mark icon={Shuffle} hex="#6366f1" size={170} />
            <span aria-hidden className="mb-5 block h-1 w-14 rounded-full bg-grad" />
            <h2 className="display mb-1.5 text-3xl">Bem-vindo de volta</h2>
            {quick.length > 0 && !other ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">Contas neste aparelho. Entre com um clique, sem senha.</p>
                <ul className="space-y-2">
                  {quick.map((q) => (
                    <li key={q.uid} className="flex items-stretch gap-1.5">
                      <form action={quickLoginAction} className="min-w-0 flex-1">
                        <input type="hidden" name="uid" value={q.uid} />
                        <SubmitButton className="!h-auto w-full !justify-start gap-3 !px-3.5 !py-2.5 text-left">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-bold">{q.name.trim().slice(0, 1).toUpperCase()}</span>
                          <span className="min-w-0"><span className="block text-[11px] font-normal opacity-80">Entrar como</span><span className="block truncate text-sm font-semibold">{q.name}</span></span>
                        </SubmitButton>
                      </form>
                      <form action={forgetQuickAction}><input type="hidden" name="uid" value={q.uid} /><button type="submit" aria-label={`Esquecer ${q.name} neste aparelho`} title="Esquecer esta conta" className="grid h-full w-10 place-items-center rounded-xl border border-line text-muted transition hover:border-danger/60 hover:text-danger"><X size={16} aria-hidden /></button></form>
                    </li>
                  ))}
                </ul>
                <a href="/login?outra=1" className="block w-full rounded-xl border border-line px-4 py-2.5 text-center text-sm font-medium transition hover:bg-sunk">Entrar com usuário e senha</a>
              </div>
            ) : (<>
              <p className="mb-7 text-sm text-muted">Entre com o usuário e a senha que você recebeu.</p>
              <LoginForm />
              {quick.length > 0 && <a href="/login" className="mt-4 block text-center text-sm text-muted underline-offset-2 hover:underline">Voltar às contas deste aparelho</a>}
            </>)}
          </div>
        </div>
      </section>
    </main>
  );
}
