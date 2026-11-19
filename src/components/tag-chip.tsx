"use client";

import { createContext, useContext } from "react";
import { TAG_ICONS } from "@/config/tag-icons";

/** nome da tag (em maiúsculas) → chave do ícone. Vem do layout. */
const TagIcons = createContext<Record<string, string>>({});
export const TagIconProvider = TagIcons.Provider;

/** Chip de tag com a cor própria dela e o ícone dela (a cor do cargo nunca aparece aqui). */
export function TagChip({ label, color, on, onClick, small = true, icon }: { label: string; color: string; on?: boolean; onClick?: () => void; small?: boolean; icon?: string | null }) {
  const map = useContext(TagIcons);
  const Icon = TAG_ICONS[icon ?? map[label.toUpperCase()] ?? ""];
  const base = `inline-flex items-center gap-1 rounded-md border ${small ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} font-semibold uppercase tracking-wide`;
  const style = {
    background: `color-mix(in srgb, ${color} ${on ? 42 : 16}%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} ${on ? 100 : 45}%, transparent)`,
    color: `color-mix(in srgb, ${color} 70%, var(--ink))`,
    outline: on ? `1.5px solid ${color}` : undefined,
  } as const;
  const ic = Icon ? <Icon size={small ? 12 : 15} aria-hidden className="shrink-0" /> : null;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={!!on} className={`${base} cursor-pointer transition active:scale-[0.97]`} style={style}>
      {on ? <span aria-hidden>✓</span> : ic}
      {label}
    </button>
  ) : (
    <span className={base} style={style}>
      {ic}
      {label}
    </span>
  );
}
