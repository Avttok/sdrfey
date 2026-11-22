"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { FEY_PATH, logoFrame, logoMoveProgress, rectsPath } from "@/config/logo-shapes";

/** Escolhas do Adm para a logo (Parâmetros → Identidade visual): 0 = parada, 1 = morph, 2 = onda. */
export type LogoCfg = { anim: number; pace: number; text: number };
const Ctx = createContext<LogoCfg>({ anim: 1, pace: 1, text: 0 });
export function LogoCfgProvider({ cfg, children }: { cfg: LogoCfg; children: React.ReactNode }) { return <Ctx.Provider value={cfg}>{children}</Ctx.Provider>; }
export const useLogoCfg = () => useContext(Ctx);

const RED = "#E9283A";

/** A marca em quadrado perfeito que alterna FEY ⇄ SDR. `anim`/`pace` só são passados na prévia do painel do Adm. */
export function MorphMark({ size = 38, color = RED, anim, pace, className = "" }: { size?: number; color?: string; anim?: number; pace?: number; className?: string }) {
  const cfg = useLogoCfg();
  const a = anim ?? cfg.anim, pc = pace ?? cfg.pace;
  const ref = useRef<SVGPathElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!a || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.setAttribute("d", FEY_PATH); return; }
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      el.setAttribute("d", rectsPath(logoFrame(now, a === 2 ? "wave" : "morph", pc)));
      // no meio da troca a marca desfoca e esmaece de leve, para a transição FEY ⇄ SDR não ser seca
      const s = Math.sin(Math.PI * logoMoveProgress(now, pc));
      const box = svg.current; if (box) { box.style.filter = s > 0.02 ? `blur(${(s * size * 0.05).toFixed(2)}px)` : ""; box.style.opacity = String(1 - 0.4 * s); }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [a, pc, size]);
  return (
    <svg ref={svg} viewBox="0 0 1248 1248" width={size} height={size} role="img" aria-label="FEY SDR" className={className} fill={color}>
      <path ref={ref} d={FEY_PATH} />
    </svg>
  );
}

/** Logo do sistema. Animada: só a marca (o SDR já aparece nela); parada: marca da FEY + “SDR”, como antes. */
export function LogoView({ size, tone, legacy }: { size: "md" | "lg"; tone: "brand" | "light"; legacy: React.ReactNode }) {
  const { anim, text } = useLogoCfg();
  const light = tone === "light", lg = size === "lg";
  const word = (
    <span className={`display font-bold leading-none tracking-wide ${lg ? "text-5xl" : "text-[1.7rem]"}`} style={light ? { color: "#fff", textShadow: "0 2px 12px rgb(0 0 0 / .35)" } : undefined}>SDR</span>
  );
  return (
    <span className={`inline-flex items-center ${lg ? "gap-4" : "gap-2.5"}`}>
      {anim ? <MorphMark size={lg ? 76 : 42} color={light ? "#fff" : RED} /> : legacy}
      {(!anim || text === 1) && word}
    </span>
  );
}

/** Marca em qualquer tela (shufflers etc.): animada FEY ⇄ SDR, ou a `legacy` se o Adm desligar a animação. */
export function BrandMark({ size, color, legacy }: { size: number; color?: string; legacy: React.ReactNode }) {
  const { anim } = useLogoCfg();
  return anim ? <MorphMark size={size} color={color} /> : <>{legacy}</>;
}
