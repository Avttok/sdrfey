import { Cloud } from "lucide-react";

/** Ícone do Salesforce: uma nuvem. */
export function SalesforceIcon({ size = 15 }: { size?: number }) {
  return <Cloud size={size} fill="currentColor" aria-hidden />;
}

/** Ícone do CRM EOX: a letra E. */
export function EoxIcon({ size = 15 }: { size?: number }) {
  return <span aria-hidden className="inline-grid shrink-0 place-items-center font-black leading-none" style={{ width: size, height: size, fontSize: size }}>E</span>;
}

export const SF_COLOR = "#0070d2";
export const EOX_COLOR = "#692E81";

/** Botão de link externo nas cores da marca: Salesforce sempre azul, EOX sempre roxo. */
export function BrandLink({ kind, href, label, small, className = "" }: { kind: "sf" | "eox"; href: string; label?: string; small?: boolean; className?: string }) {
  const color = kind === "sf" ? SF_COLOR : EOX_COLOR;
  const Ico = kind === "sf" ? SalesforceIcon : EoxIcon;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ background: color, borderColor: color }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium text-white transition hover:brightness-110 active:scale-[0.98] ${small ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-[15px]"} ${className}`}>
      <Ico size={small ? 14 : 15} /> {label ?? (kind === "sf" ? "Salesforce" : "CRM (EOX)")}
    </a>
  );
}
