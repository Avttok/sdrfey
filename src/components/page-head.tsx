import type { LucideIcon } from "lucide-react";
import { Term } from "@/components/terms";
import { Mark, Tile, glass, StatRow, type Stat } from "@/components/theme-kit";

/**
 * Cabeçalho padrão de toda tela: ícone, título, explicação curta e (opcional) ações à direita.
 * Com `hex`, vira o cabeçalho no tema das cartas (vidro, degradê da cor da página, ícone em gradiente e marca d'água),
 * e `stats` mostra os indicadores da página logo abaixo.
 */
export function PageHead({ icon: Icon, title, subtitle, children, size = "lg", hex, stats }: { icon: LucideIcon; title: string; subtitle?: string; children?: React.ReactNode; size?: "lg" | "md"; hex?: string; stats?: Stat[] }) {
  if (hex) {
    return (
      <div className="space-y-3">
        <header className="group relative flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-3xl border-2 p-4 shadow-[0_14px_40px_-22px_rgb(0_0_0/0.45)] sm:p-5" style={glass(hex, 20, 4)}>
          <Mark icon={Icon} hex={hex} size={170} />
          <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-full opacity-20 blur-3xl" style={{ background: hex }} />
          <span className="relative"><Tile icon={Icon} hex={hex} size="lg" /></span>
          <div className="relative min-w-0 flex-1">
            <h1 className={`display leading-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}><Term>{title}</Term></h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {children && <div className="relative flex flex-wrap items-center gap-2">{children}</div>}
        </header>
        {stats && stats.length > 0 && <StatRow stats={stats} />}
      </div>
    );
  }
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className={`grid shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent ${size === "lg" ? "size-12" : "size-10"}`}><Icon size={size === "lg" ? 24 : 20} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h1 className={`display leading-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}><Term>{title}</Term></h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
