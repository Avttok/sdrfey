import type { LucideIcon } from "lucide-react";

/** Cabeçalho padrão de toda tela: ícone, título, explicação curta e (opcional) ações à direita. */
export function PageHead({ icon: Icon, title, subtitle, children, size = "lg" }: { icon: LucideIcon; title: string; subtitle?: string; children?: React.ReactNode; size?: "lg" | "md" }) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className={`grid shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent ${size === "lg" ? "size-12" : "size-10"}`}><Icon size={size === "lg" ? 24 : 20} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h1 className={`display leading-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
