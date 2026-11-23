import { Lock } from "lucide-react";
import { ACHIEVEMENT_BY_KEY, RARITY_BY_KEY, rarityOf } from "@/config/achievements";

/** Etiqueta da raridade da conquista que libera um cosmético (Comum, Raro, Lendário, Mítico). */
export function RarityTag({ unlock, className = "" }: { unlock: string; className?: string }) {
  const r = RARITY_BY_KEY.get(rarityOf(unlock))!;
  return <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${className}`} style={{ color: r.color, background: `color-mix(in srgb, ${r.color} 16%, transparent)` }}>{r.label}</span>;
}

/** Texto de como liberar: "Conquista: Nome". */
export const unlockHint = (unlock: string) => `Libera com a conquista “${ACHIEVEMENT_BY_KEY.get(unlock)?.name ?? unlock}”`;
export { Lock };
