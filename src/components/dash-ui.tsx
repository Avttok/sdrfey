import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { panelCls } from "@/components/ui";

/** Anel de progresso para metas e taxas. */
export function MetricRing({ value, color, track = "var(--sunk)", size = "size-16" }: { value: number; color: string; track?: string; size?: string }) {
  const v = Math.max(0, Math.min(100, value)); const r = 22; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className={`${size} shrink-0 -rotate-90`} aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke={track} strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-1000" />
    </svg>
  );
}

/**
 * Cartão de indicador no estilo dos objetivos do roteiro: fundo em degradê da cor do indicador, ícone gigante de marca d'água,
 * brilho no canto e ícone em degradê. `featured` pinta o cartão inteiro (destaque). `bar` mostra um anel de progresso.
 */
export function MetricCard({ I, t, v, s, hex, bar, featured, hot, i = 0 }: { I: LucideIcon; t: string; v: ReactNode; s?: ReactNode; hex: string; bar?: number; featured?: boolean; hot?: boolean; i?: number }) {
  const c = hot ? "var(--danger)" : hex;
  const done = bar !== undefined && bar >= 100;
  if (featured) {
    return (
      <div style={{ "--i": i, background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 62%, #000))`, boxShadow: `0 10px 30px -12px ${c}` } as CSSProperties} className="card-in lift group relative flex min-h-[8.5rem] items-center justify-between gap-3 overflow-hidden rounded-3xl border-2 border-white/30 p-5 text-white">
        <I aria-hidden size={120} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-5 -rotate-12 opacity-[.14] transition duration-300 group-hover:-rotate-6 group-hover:scale-110" />
        <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 size-32 rounded-full bg-white/25 blur-2xl" />
        <div className="relative min-w-0">
          <p className="mb-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: c }}><I size={12} aria-hidden /> {t}</p>
          <p className="figure block text-5xl font-extrabold leading-none">{v}</p>
          {s && <p className="mt-2 text-sm text-white/85">{s}</p>}
        </div>
        {bar !== undefined && <span className="relative"><MetricRing value={bar} color="#fff" track="rgba(255,255,255,.28)" size="size-20" /></span>}
      </div>
    );
  }
  return (
    <div style={{ "--i": i, background: `linear-gradient(145deg, color-mix(in srgb, ${c} 20%, var(--panel)), color-mix(in srgb, ${c} 5%, var(--panel)) 70%)`, borderColor: `color-mix(in srgb, ${c} ${hot ? 70 : 50}%, transparent)` } as CSSProperties} className="card-in group relative flex min-h-[8.5rem] flex-col items-start gap-3 overflow-hidden rounded-3xl border-2 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <I aria-hidden size={96} strokeWidth={1.4} className="pointer-events-none absolute -bottom-5 -right-4 -rotate-12 opacity-[.13] transition duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:opacity-20" style={{ color: c }} />
      <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 size-28 rounded-full opacity-25 blur-2xl" style={{ background: c }} />
      <div className="relative flex w-full items-start justify-between gap-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white transition duration-200 group-hover:scale-110 group-hover:-rotate-3" style={{ background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 65%, #000))`, boxShadow: `0 8px 20px -8px ${c}` }}><I size={24} aria-hidden /></span>
        {bar !== undefined && <MetricRing value={bar} color={done ? "var(--ok)" : c} size="size-12" />}
      </div>
      <div className="relative min-w-0 max-w-full">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">{t}</p>
        <p className="figure mt-0.5 text-3xl font-extrabold leading-none" style={hot || done ? { color: hot ? c : "var(--ok)" } : undefined}>{v}</p>
        {s && <p className="mt-1.5 text-xs leading-snug text-muted">{s}</p>}
      </div>
    </div>
  );
}

/** Título de seção do dashboard com o ícone em degradê. */
export function DashSection({ I, title, hint, hex = "var(--accent)", children }: { I: LucideIcon; title: string; hint?: string; hex?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 65%, #000))`, boxShadow: `0 6px 16px -8px ${hex}` }}><I size={18} aria-hidden /></span>
        <div className="min-w-0"><h2 className="display text-lg leading-tight">{title}</h2>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
      </div>
      {children}
    </section>
  );
}

/** Bloco de gráfico/lista no mesmo estilo (degradê suave, brilho e ícone em degradê). */
export function DashBlock({ I, title, hex = "var(--accent)", children }: { I: LucideIcon; title: string; hex?: string; children: ReactNode }) {
  return (
    <section style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${hex} 9%, var(--panel)), var(--panel) 55%)` }} className={`${panelCls} card-in relative overflow-hidden p-5`}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full opacity-20 blur-2xl" style={{ background: hex }} />
      <I aria-hidden size={110} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-4 -rotate-12 opacity-[.06]" style={{ color: hex }} />
      <h2 className="relative mb-4 flex items-center gap-2.5 text-[15px] font-bold"><span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 65%, #000))`, boxShadow: `0 6px 16px -8px ${hex}` }}><I size={17} aria-hidden /></span> {title}</h2>
      <div className="relative">{children}</div>
    </section>
  );
}
