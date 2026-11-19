import { Play, SearchX, Shuffle } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";
import { BannerRain } from "@/components/banner-rain";
import type { Role } from "@/config/roles";
import { SubmitButton } from "@/components/submit-button";

/** Tela inicial do Shuffler: fundo vivo, cartas flutuando, título, conteúdo centralizado e botão grande. */
export function ShuffleHero({ action, children, avatar, roles, empty }: { action: () => void | Promise<void>; children: React.ReactNode; avatar?: string | null; roles: readonly Role[]; /** Sem lead para sortear: troca a tela por um aviso. */ empty?: { hint: string } }) {
  return (
    <>
      <div aria-hidden className="spawn-fade pointer-events-none fixed inset-0 -z-10" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 26%, var(--bg)) 0%, color-mix(in srgb, var(--accent) 7%, var(--bg)) 48%, color-mix(in srgb, var(--accent) 20%, var(--bg)) 100%)" }}>
        <div className="absolute -left-24 -top-24 size-[30rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 size-[34rem] rounded-full bg-accent/20 blur-3xl" />
      </div>
      <BannerRain field count={34} avatar={avatar} roles={roles} />
      {empty ? (
        <div className="relative -my-3 flex min-h-[26rem] flex-1 flex-col items-center justify-center gap-6 p-4 text-center sm:p-8">
          <div className="sh-rise flex flex-col items-center gap-5">
            <div className="relative grid size-24 place-items-center">
              <span aria-hidden className="sh-card absolute h-16 w-12 rounded-xl border border-dashed border-accent/40 bg-panel/70 shadow-lg backdrop-blur-sm" style={{ "--r": "-14deg", "--x": "-1.7rem", "--d": "0s" } as React.CSSProperties} />
              <span aria-hidden className="sh-card absolute h-16 w-12 rounded-xl border border-dashed border-accent/40 bg-panel/70 shadow-lg backdrop-blur-sm" style={{ "--r": "14deg", "--x": "1.7rem", "--d": "-1.4s" } as React.CSSProperties} />
              <span className="sh-card relative grid size-[4.5rem] place-items-center rounded-3xl border-2 border-dashed border-accent/50 bg-panel/90 text-accent shadow-2xl" style={{ "--d": "-.7s" } as React.CSSProperties}><SearchX size={34} aria-hidden /></span>
            </div>
            <h1 className="display text-3xl sm:text-4xl">Não há leads disponíveis…</h1>
            <p className="max-w-md text-balance text-muted">{empty.hint}</p>
          </div>
          <div className="sh-rise" style={{ "--d": ".35s" } as React.CSSProperties}><RefreshButton /></div>
        </div>
      ) : (
      <div className="relative -my-3 flex min-h-[26rem] flex-1 flex-col items-center justify-center gap-8 overflow-y-auto overflow-x-hidden p-4 text-center sm:gap-10 sm:p-8">
        <div className="sh-rise flex flex-col items-center gap-5">
          <div className="relative grid size-24 place-items-center">
            {[["-18deg", "-1.6rem", "0s"], ["16deg", "1.6rem", "-1.4s"]].map(([r, x, d]) => (
              <span key={r} aria-hidden className="sh-card absolute h-16 w-12 rounded-xl border border-accent/30 bg-panel/80 shadow-lg backdrop-blur-sm" style={{ "--r": r, "--x": x, "--d": d } as React.CSSProperties} />
            ))}
            <span className="sh-card relative grid size-[4.5rem] place-items-center rounded-3xl bg-grad text-on-accent shadow-2xl shadow-accent/50" style={{ "--d": "-.7s" } as React.CSSProperties}><Shuffle size={34} aria-hidden /></span>
          </div>
          <h1 className="display text-4xl sm:text-5xl">Bora?</h1>
        </div>
        <div className="w-full">{children}</div>
        <form action={action} className="sh-rise" style={{ "--d": ".5s" } as React.CSSProperties}>
          <SubmitButton className="sh-go !rounded-2xl !px-14 !py-5 !text-2xl font-bold shadow-2xl shadow-accent/40"><Play size={28} aria-hidden /> Iniciar</SubmitButton>
        </form>
      </div>
      )}
    </>
  );
}
