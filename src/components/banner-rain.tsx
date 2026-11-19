import { Handshake, Headset, ShieldCheck, ShieldHalf, UserRound } from "lucide-react";
import { AVATAR_BY_KEY } from "@/config/avatars";
import type { Role } from "@/config/roles";
import { FeyMark } from "@/components/logo";

const ROLE_ICON = { user: Headset, seller: Handshake, manager: ShieldHalf, admin: ShieldCheck } as const;

/** Número "aleatório" estável (sem Math.random, para não divergir entre servidor e navegador). */
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/**
 * Chuva suave no banner: o ícone de perfil da pessoa, os ícones dos cargos dela e a marca da FEY caem devagar.
 * Fica atrás do conteúdo, não recebe cliques e para quando a pessoa pede menos animação.
 */
export function BannerRain({ avatar, roles, count = 16 }: { avatar?: string | null; roles: readonly Role[]; count?: number }) {
  const Mine = (avatar && AVATAR_BY_KEY.get(avatar)?.icon) || UserRound;
  const kinds: ("fey" | "me" | Role)[] = ["me", "fey", ...roles.filter((r) => r !== "admin" || roles.length === 1), "fey"];
  return (
    <span aria-hidden className="banner-rain pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const k = kinds[i % kinds.length];
        // profundidade: 0 = longe (pequeno, lento, apagado, levemente fora de foco), 1 = perto (grande, rápido, desfocado de perto)
        const z = rnd(i, 1);
        const size = Math.round(8 + z * 16);
        const blur = z < 0.3 ? 0.6 : z > 0.8 ? 1.6 : 0;
        const style = { left: `${(i / count) * 100 + rnd(i, 2) * (100 / count) - 3}%`, "--dur": `${13 - z * 7 + rnd(i, 3) * 3}s`, "--del": `${-rnd(i, 4) * 14}s`, "--rot": `${Math.round((rnd(i, 5) - 0.5) * 80)}deg`, "--dist": `${150 + Math.round(rnd(i, 7) * 90)}px`, opacity: 0.12 + z * 0.22 + rnd(i, 6) * 0.08, filter: blur ? `blur(${blur}px)` : undefined } as React.CSSProperties;
        return (
          <span key={i} className="rain-drop absolute -top-6 text-white" style={style}>
            {k === "fey" ? <FeyMark size={size} color="currentColor" /> : k === "me" ? <Mine size={size} /> : (() => { const I = ROLE_ICON[k]; return <I size={size} />; })()}
          </span>
        );
      })}
    </span>
  );
}
