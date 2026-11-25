import type { LucideIcon } from "lucide-react";

/**
 * Peças do tema das cartas, para montar cada página no mesmo idioma visual:
 * vidro (fundo translúcido + blur), borda na cor da página, degradê tintado, ícone gigante de marca d'água e ícone em gradiente.
 * Cada página escolhe a própria cor (hex) e os próprios ícones.
 */
export const glass = (hex: string, a = 16, b = 4): React.CSSProperties => ({
  backgroundColor: "color-mix(in srgb, var(--panel) 66%, transparent)",
  backgroundImage: `linear-gradient(145deg, color-mix(in srgb, ${hex} ${a}%, transparent), color-mix(in srgb, ${hex} ${b}%, transparent) 70%)`,
  borderColor: `color-mix(in srgb, ${hex} 40%, var(--line))`,
  WebkitBackdropFilter: "blur(18px) saturate(1.4)", backdropFilter: "blur(18px) saturate(1.4)",
});
export const tile = (hex: string) => `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))`;

/** Marca d'água: ícone gigante inclinado no canto. */
export function Mark({ icon: I, hex, size = 120, className = "" }: { icon: LucideIcon; hex: string; size?: number; className?: string }) {
  return <I aria-hidden size={size} strokeWidth={1.3} className={`pointer-events-none absolute -bottom-5 -right-3 -rotate-12 opacity-[.1] transition duration-300 group-hover:scale-110 group-hover:-rotate-6 ${className}`} style={{ color: hex }} />;
}

/** Ícone quadrado em gradiente. */
export function Tile({ icon: I, hex, size = "md" }: { icon: LucideIcon; hex: string; size?: "sm" | "md" | "lg" }) {
  const d = size === "lg" ? "size-14 rounded-2xl" : size === "sm" ? "size-8 rounded-xl" : "size-11 rounded-2xl";
  return <span aria-hidden className={`grid shrink-0 place-items-center text-white shadow-md ${d}`} style={{ background: tile(hex) }}><I size={size === "lg" ? 26 : size === "sm" ? 15 : 20} /></span>;
}

export type Stat = { icon: LucideIcon; label: string; value: string | number; hint?: string; hex?: string; hot?: boolean };

/** Indicador no estilo dos objetivos: carta tintada, número grande e ícone de marca d'água. */
export function StatTile({ icon: I, label, value, hint, hex = "#6366f1", hot }: Stat) {
  const c = hot ? "#ef4444" : hex;
  return (
    <div className="group relative overflow-hidden rounded-3xl border-[1.5px] p-4 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)] transition hover:-translate-y-0.5 hover:shadow-xl" style={glass(c, 18, 4)}>
      <Mark icon={I} hex={c} size={92} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="figure mt-2 text-3xl font-extrabold leading-none" style={hot ? { color: c } : undefined}>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
          {hint && <p className="mt-2 truncate text-xs text-muted">{hint}</p>}
        </div>
        <Tile icon={I} hex={c} />
      </div>
    </div>
  );
}

export function StatRow({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  if (!stats.length) return null;
  return <div className={`grid grid-cols-2 gap-3 ${stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : ""} ${className}`}>{stats.map((s) => <StatTile key={s.label} {...s} />)}</div>;
}

/** Painel tintado com título: o "cartão de seção" colorido de cada página. */
export function Panel({ icon: I, title, hint, hex = "#6366f1", right, children, className = "" }: { icon: LucideIcon; title?: string; hint?: string; hex?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`group relative overflow-hidden rounded-3xl border-[1.5px] p-5 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)] ${className}`} style={glass(hex, 10, 2)}>
      <Mark icon={I} hex={hex} size={150} className="opacity-[.06]" />
      {(title || right) && (
        <header className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Tile icon={I} hex={hex} size="sm" />
            <div className="min-w-0"><h2 className="text-[15px] font-bold leading-tight">{title}</h2>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
          </div>
          {right}
        </header>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}
