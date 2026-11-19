import { Play, Shuffle } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";

/** Tela inicial do Shuffler: fundo vivo, cartas flutuando, título, conteúdo centralizado e botão grande. */
export function ShuffleHero({ action, children }: { action: () => void | Promise<void>; children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="spawn-fade pointer-events-none fixed inset-0 -z-10" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 26%, var(--bg)) 0%, color-mix(in srgb, var(--accent) 7%, var(--bg)) 48%, color-mix(in srgb, var(--accent) 20%, var(--bg)) 100%)" }}>
        <div className="absolute -left-24 -top-24 size-[30rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 size-[34rem] rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="relative -my-3 flex min-h-[26rem] flex-1 flex-col items-center justify-center gap-8 overflow-y-auto overflow-x-hidden p-4 text-center sm:gap-10 sm:p-8">
        <div className="sh-rise flex flex-col items-center gap-5">
          <div className="relative grid size-24 place-items-center">
            {[["-18deg", "-1.6rem", "0s"], ["16deg", "1.6rem", "-1.4s"]].map(([r, x, d]) => (
              <span key={r} aria-hidden className="sh-card absolute h-16 w-12 rounded-xl border border-accent/30 bg-panel/80 shadow-lg backdrop-blur-sm" style={{ "--r": r, "--x": x, "--d": d } as React.CSSProperties} />
            ))}
            <span className="sh-card relative grid size-[4.5rem] place-items-center rounded-3xl bg-grad text-on-accent shadow-2xl shadow-accent/50" style={{ "--d": "-.7s" } as React.CSSProperties}><Shuffle size={34} aria-hidden /></span>
          </div>
          <h1 className="display text-4xl sm:text-5xl">Bora shufflar?</h1>
        </div>
        <div className="w-full">{children}</div>
        <form action={action} className="sh-rise" style={{ "--d": ".5s" } as React.CSSProperties}>
          <SubmitButton className="sh-go !rounded-2xl !px-14 !py-5 !text-2xl font-bold shadow-2xl shadow-accent/40"><Play size={28} aria-hidden /> Iniciar</SubmitButton>
        </form>
      </div>
    </>
  );
}
