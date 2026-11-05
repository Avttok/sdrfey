import type { LucideIcon } from "lucide-react";
import { panelCls } from "@/components/ui";

/** Cartão de seção padrão: ícone, título e conteúdo. Use em qualquer tela que agrupe informações. */
export function SectionCard({ icon: Icon, title, children, className = "" }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${panelCls} space-y-4 p-5 ${className}`}>
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><Icon size={16} aria-hidden /></span>{title}</h2>
      {children}
    </section>
  );
}
