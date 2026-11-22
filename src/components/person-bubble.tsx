"use client";

import { createContext, useContext } from "react";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { AVATAR_BY_KEY } from "@/config/avatars";

export type AvatarMap = { byId: Record<number, string>; byName: Record<string, string>; /** quem tem o Douraovo */ eggs?: number[]; /** quem está logado */ me?: number };
const Ctx = createContext<AvatarMap>({ byId: {}, byName: {} });
/** A pessoa logada tem o Douraovo? */
export const useMyEgg = () => { const m = useContext(Ctx); return !!m.me && !!m.eggs?.includes(m.me); };
/** Ícones de perfil de todo mundo (equipe pequena): as bolhas de nome mostram o ícone antes do nome. */
export const AvatarProvider = ({ value, children }: { value: AvatarMap; children: React.ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

/** Bolha com a cor escolhida pela pessoa (a mesma em todo o sistema), com o ícone de perfil antes do nome. */
export function PersonBubble({ name, hex, prefix, userId }: { name: string; hex: string; prefix?: string; userId?: number | null }) {
  const m = useContext(Ctx);
  const key = (userId ? m.byId[userId] : undefined) ?? m.byName[name] ?? m.byName[name.trim()];
  return (
    <span title={prefix ? `${prefix}: ${name}` : name} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `color-mix(in srgb, ${hex} 22%, transparent)`, color: `color-mix(in srgb, ${hex} 75%, var(--ink))`, border: `1px solid color-mix(in srgb, ${hex} 45%, transparent)` }}>
      {prefix && <span className="opacity-70">{prefix}:</span>}
      {key && AVATAR_BY_KEY.has(key) && <AvatarGlyph avatar={key} initials="" size={12} />}
      {name.split(" ")[0]}
    </span>
  );
}
