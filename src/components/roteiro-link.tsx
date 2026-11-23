import Link from "next/link";
import { ScrollText } from "lucide-react";
import { btnGhost } from "@/components/ui";

/** Atalho "Roteiro": abre a ligação com roteiro para este lead, de qualquer tela onde ele apareça. */
export function RoteiroLink({ leadId, area, compact = false, className }: { leadId: number; area?: "sdr" | "vendas"; compact?: boolean; className?: string }) {
  const href = `/roteiro/${leadId}${area ? `?area=${area}` : ""}`;
  if (compact) return <Link prefetch={false} href={href} title="Ligar com roteiro" aria-label="Ligar com roteiro" className={className ?? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent/10"}><ScrollText size={13} aria-hidden /> Roteiro</Link>;
  return <Link prefetch={false} href={href} className={className ?? `${btnGhost} !min-h-9 !px-3.5 !text-sm`}><ScrollText size={15} aria-hidden /> Ligar com roteiro</Link>;
}
