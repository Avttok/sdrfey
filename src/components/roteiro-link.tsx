import Link from "next/link";
import { Play } from "lucide-react";
import { btnSmAccent } from "@/components/ui";

/**
 * Atalho "Roteiro": abre a ligação com roteiro para este lead, de qualquer tela onde ele apareça.
 * É a ação principal do sistema, então ganha cor, ícone de play e um brilho discreto (`roteiro-cta`).
 */
export function RoteiroLink({ leadId, area, compact = false, className }: { leadId: number; area?: "sdr" | "vendas"; compact?: boolean; className?: string }) {
  const href = `/roteiro/${leadId}${area ? `?area=${area}` : ""}`;
  if (compact) return <Link prefetch={false} href={href} title="Ligar com roteiro" aria-label="Ligar com roteiro" className={`${btnSmAccent} ${className ?? ""}`}><Play size={12} fill="currentColor" aria-hidden /> Roteiro</Link>;
  return <Link prefetch={false} href={href} className={`roteiro-cta inline-flex min-h-10 items-center gap-2 rounded-xl bg-grad px-4 py-2 text-sm font-bold text-on-accent shadow-md transition hover:brightness-110 active:scale-95 ${className ?? ""}`}><Play size={15} fill="currentColor" aria-hidden /> Ligar com roteiro</Link>;
}
