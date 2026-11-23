"use client";

import { Car, Cog, Forklift, Hammer, Handshake, Headset, Motorbike, ShieldCheck, ShieldHalf, Tractor, Truck, UserRound, Wrench } from "lucide-react";
import { AVATAR_BY_KEY } from "@/config/avatars";
import type { Role } from "@/config/roles";
import { FeyMark } from "@/components/logo";
import { EggBadge } from "@/components/egg-badge";
import { useMyEgg } from "@/components/person-bubble";

const ROLE_ICON = { user: Headset, seller: Handshake, manager: ShieldHalf, admin: ShieldCheck } as const;

/** Porca e parafuso (não existem no conjunto de ícones): traço fino, no mesmo estilo dos demais. */
const Nut = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z" /><circle cx="12" cy="12" r="3.2" /></svg>;
const Bolt = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2.5h10v5H7z" /><path d="M9 7.5v14M15 7.5v14M9 11h6M9 15h6M9 19h6" /></svg>;
const FIELD = [Tractor, Truck, Car, Motorbike, Cog, Wrench, Hammer, Forklift, Nut, Bolt] as const;

/** Número "aleatório" estável (sem Math.random, para não divergir entre servidor e navegador). */
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/**
 * Chuva suave no banner: o ícone de perfil da pessoa, os ícones dos cargos dela e a marca da FEY caem devagar.
 * Fica atrás do conteúdo, não recebe cliques e para quando a pessoa pede menos animação.
 */
export function BannerRain({ avatar, roles, count = 16, field = false, egg }: { /** Mostra ovos dourados na chuva (padrão: se a pessoa logada achou o segredo) */ egg?: boolean; avatar?: string | null; roles: readonly Role[]; count?: number; /** Tela cheia (Shuffler): mais ícones, do campo e da oficina, e a chuva cobre a tela toda. */ field?: boolean }) {
  const mine = useMyEgg();
  const eggs = egg ?? mine;
  const Mine = (avatar && AVATAR_BY_KEY.get(avatar)?.icon) || UserRound;
  const kinds: ("fey" | "me" | "egg" | Role | number)[] = ["me", "fey", ...roles.filter((r) => r !== "admin" || roles.length === 1), "fey"];
  if (field) { const base = kinds.length; for (let i = 0; i < FIELD.length * 2; i++) kinds.splice(1 + ((i * 3) % (base + i)), 0, i % FIELD.length); }
  // Ovos espalhados por toda a largura: índices uniformes (e não posições fixas da lista, que os juntavam em 2 colunas).
  const eggCount = eggs ? Math.max(2, Math.round(count / (field ? 5 : 6))) : 0;
  const eggAt = new Set(Array.from({ length: eggCount }, (_, j) => Math.min(count - 1, Math.floor((j + 0.25 + rnd(j, 11) * 0.5) * (count / eggCount)))));
  let seq = 0;
  return (
    <span aria-hidden className={`banner-rain pointer-events-none overflow-hidden ${field ? "fixed inset-0 z-0" : "absolute inset-0"}`}>
      {Array.from({ length: count }, (_, i) => {
        const k = eggAt.has(i) ? "egg" : kinds[seq++ % kinds.length];
        // profundidade: 0 = longe (pequeno, lento, apagado, levemente fora de foco), 1 = perto (grande, rápido, desfocado de perto)
        const z = rnd(i, 1);
        const size = Math.round(8 + z * 16) + (field ? 6 : 0);
        const blur = z < 0.3 ? 0.6 : z > 0.8 ? 1.6 : 0;
        const style = { left: `${(i / count) * 100 + rnd(i, 2) * (100 / count) - 3}%`, "--dur": `${13 - z * 7 + rnd(i, 3) * 3}s`, "--del": `${-rnd(i, 4) * 14}s`, "--pos": ((i * 0.618034 + rnd(i, 8) * 0.25) % 1).toFixed(3), "--rot": `${Math.round((rnd(i, 5) - 0.5) * 80)}deg`, "--dist": field ? "112vh" : `${150 + Math.round(rnd(i, 7) * 90)}px`, opacity: k === "egg" ? 0.55 + z * 0.35 : (field ? 0.18 : 0.12) + z * (field ? 0.3 : 0.22) + rnd(i, 6) * 0.08, color: field ? "color-mix(in srgb, var(--accent) 65%, var(--ink))" : undefined, filter: blur ? `blur(${blur}px)` : undefined } as React.CSSProperties;
        return (
          <span key={i} className={`rain-drop absolute -top-6 ${field ? "" : "text-white"}`} style={style}>
            {k === "egg" ? <EggBadge size={Math.round(size * 0.9)} title="" /> : typeof k === "number" ? (() => { const I = FIELD[k]; return <I size={size} />; })() : k === "fey" ? <FeyMark size={size} color="currentColor" /> : k === "me" ? <Mine size={size} /> : (() => { const I = ROLE_ICON[k]; return <I size={size} />; })()}
          </span>
        );
      })}
    </span>
  );
}
