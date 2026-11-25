import type { LucideIcon } from "lucide-react";

/** Cartão de seção padrão no tema das cartas: vidro, borda na cor do tema, ícone em gradiente e marca d'água. */
export function SectionCard({ icon: Icon, title, children, className = "" }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card-edge card-surface relative space-y-4 overflow-hidden rounded-3xl p-5 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.35)] ${className}`}>
      <Icon aria-hidden size={120} strokeWidth={1.2} className="pointer-events-none absolute -bottom-6 -right-4 -rotate-12 text-accent opacity-[.06]" />
      <h2 className="relative flex items-center gap-2.5 text-[15px] font-bold"><span className="card-tile grid size-8 place-items-center rounded-xl"><Icon size={16} aria-hidden /></span>{title}</h2>
      <div className="relative space-y-4">{children}</div>
    </section>
  );
}
