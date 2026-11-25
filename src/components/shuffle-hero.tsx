import { Filter, SearchX, Shuffle } from "lucide-react";
import { Term } from "@/components/terms";
import { FeyMark } from "@/components/logo";
import { BrandMark } from "@/components/logo-morph";
import { RefreshButton } from "@/components/refresh-button";
import { BannerRain } from "@/components/banner-rain";
import type { Role } from "@/config/roles";
import { SubmitButton } from "@/components/submit-button";

/** Tela inicial do Shuffler: fundo vivo, cartas flutuando, título, conteúdo centralizado e botão grande. */
export function ShuffleHero({ action, children, avatar, roles, empty, list, aside, title = "Shuffler Prospecção" }: { /** Cartas do canto direito (listas). Com elas, as metas vão para a esquerda. */ aside?: React.ReactNode; /** Lista do Lista Flow ativa: mostra o botão extra. */ list?: { action: () => void | Promise<void>; name: string; count: number; href: string }; /** Nome exibido no topo da tela inicial. */ title?: string; action: () => void | Promise<void>; children: React.ReactNode; avatar?: string | null; roles: readonly Role[]; /** Sem lead para sortear: troca a tela por um aviso. */ empty?: { hint: string } }) {
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
      <div className="relative -my-3 flex min-h-[26rem] flex-1 flex-col items-center justify-center gap-8 overflow-y-auto overflow-x-hidden lg:overflow-visible p-4 text-center sm:gap-9 sm:p-8">
        <div className="sh-rise flex flex-col items-center gap-4">
          <span className="text-accent"><BrandMark size={92} color="currentColor" legacy={<FeyMark animated size={92} color="currentColor" />} /></span>
          <h1 className="sr-only"><Term>{title}</Term></h1>
        </div>
        {aside ? <div className="grid w-full items-center gap-10 lg:w-[min(94vw,120rem)] lg:grid-cols-2 lg:gap-0"><div className="flex min-w-0 items-center justify-center lg:justify-start lg:pl-[20%] lg:pr-4">{children}</div><div className="flex min-w-0 items-center justify-center lg:justify-end lg:pl-4 lg:pr-[20%]">{aside}</div></div> : <div className="w-full">{children}</div>}
        <form action={action} className="sh-rise flex flex-col items-center gap-3" style={{ "--d": ".5s" } as React.CSSProperties}>
          <div className="relative grid size-32 place-items-center">
            {[["-18deg", "-2.1rem", "0s"], ["16deg", "2.1rem", "-1.4s"]].map(([r, x, d]) => (
              <span key={r} aria-hidden className="sh-card absolute h-20 w-14 rounded-xl border border-accent/30 bg-panel/80 shadow-lg backdrop-blur-sm" style={{ "--r": r, "--x": x, "--d": d } as React.CSSProperties} />
            ))}
            <span className="sh-card relative" style={{ "--d": "-.7s" } as React.CSSProperties}>
              <SubmitButton className="sh-go !size-[6.5rem] !rounded-[2rem] !p-0 shadow-2xl shadow-accent/50">
                <Shuffle size={44} aria-hidden /><span className="sr-only">Iniciar o shuffler</span>
              </SubmitButton>
            </span>
          </div>
          <p className="text-sm font-medium text-muted">Toque para sortear um lead</p>
        </form>
        {list && (
          <form action={list.action} className="sh-rise flex flex-col items-center gap-1.5" style={{ "--d": ".7s" } as React.CSSProperties}>
            <SubmitButton className="glow-pulse !rounded-2xl !px-5 !py-3"><Filter size={18} aria-hidden /> Sortear da lista “{list.name}”</SubmitButton>
            <p className="text-xs text-muted">{list.count.toLocaleString("pt-BR")} leads na lista · <a href={list.href} className="underline">trocar lista</a></p>
          </form>
        )}
      </div>
      )}
    </>
  );
}
