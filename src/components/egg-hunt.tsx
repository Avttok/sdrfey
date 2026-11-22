"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eggHuntAction } from "@/modules/easter/actions";
import { EggBadge } from "@/components/egg-badge";

const TOTAL = 10;
/** Cor do ovo i (0–9): vai do cinza-azulado ao dourado do Douradovo. */
const tint = (i: number) => `color-mix(in oklab, #94a3b8 ${Math.round(100 - (i / (TOTAL - 1)) * 100)}%, #fbbf24)`;
const spawnAt = (prev: number | null) => { for (let k = 0; k < 12; k++) { const x = 4 + Math.random() * 88; if (prev === null || Math.abs(x - prev) >= 20) return x; } return prev === null ? 50 : (prev + 45) % 92 + 4; };

/**
 * A caça aos ovos: um ovo por vez aparece num ponto aleatório do rodapé. Quebre 10 em sequência, sem recarregar a página.
 * Cada ovo muda de cor e de efeito, chegando mais perto do dourado. Recarregou? Recomeça do zero, com o ovo em outro lugar.
 * Sem texto nenhum: quem notar o ovo e clicar vai entender sozinho.
 */
export function EggHunt() {
  const router = useRouter();
  const [n, setN] = useState(0);
  const [x, setX] = useState<number | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; n: number }[]>([]);
  const [open, setOpen] = useState(false);
  const token = useRef<string | null>(null);
  const busy = useRef(false);
  useEffect(() => { setX(spawnAt(null)); }, []);

  const hit = async () => {
    if (busy.current || x === null || open) return;
    busy.current = true;
    const id = Date.now();
    setBursts((b) => [...b.slice(-4), { id, x, n }]);
    try { navigator.vibrate?.(n >= 8 ? 20 : 8); } catch { /* sem vibração */ }
    const r = await eggHuntAction(token.current).catch(() => ({ ok: false as const }));
    if (!r.ok) { token.current = null; setN(0); setX(spawnAt(x)); busy.current = false; return; }
    if (r.open) { setOpen(true); setTimeout(() => router.push("/easter-egg"), 900); return; }
    token.current = r.token ?? null; setN(r.n ?? n + 1); setX(spawnAt(x)); busy.current = false;
  };

  if (x === null) return null;
  const c = tint(n);
  return (
    <div aria-hidden={false} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9">
      {bursts.map((b) => (
        <span key={b.id} className="hunt-burst pointer-events-none absolute bottom-3" style={{ left: `${b.x}%`, "--c": tint(b.n) } as React.CSSProperties} onAnimationEnd={() => setBursts((l) => l.filter((q) => q.id !== b.id))}>
          <i className="hunt-ring" />
          {Array.from({ length: 6 + b.n }, (_, i) => <i key={i} className="hunt-shard" style={{ "--a": `${(360 / (6 + b.n)) * i + b.n * 17}deg`, "--d": `${16 + (i % 3) * 7 + b.n * 2}px` } as React.CSSProperties} />)}
        </span>
      ))}
      {!open && (
        <button key={`${n}-${Math.round(x)}`} type="button" aria-label="Ovo" onClick={hit} className="hunt-egg pointer-events-auto absolute bottom-1 cursor-pointer p-1.5 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent" style={{ left: `${x}%`, "--c": c, "--g": n / (TOTAL - 1) } as React.CSSProperties}>
          <svg viewBox="0 0 40 48" width="24" height="29" aria-hidden>
            <path d="M20 2C11 2 3.5 17 3.5 29c0 9.4 7.1 17 16.5 17s16.5-7.6 16.5-17C36.5 17 29 2 20 2Z" fill="var(--c)" stroke="color-mix(in oklab, var(--c) 55%, #000)" strokeWidth="1.8" />
            <path d="M6 27c4-3 7 3 11 0s7-3 10 0 5 3 7 1" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
            <circle cx="13" cy="14" r="2.6" fill="#fff" fillOpacity=".75" />
          </svg>
        </button>
      )}
      {open && <span className="hunt-final pointer-events-none absolute bottom-1" style={{ left: `${x}%` }}><EggBadge size={26} title="" /></span>}
    </div>
  );
}

/** Para quem já achou o segredo: ovos dourados vivos no rodapé (balançam, brilham e soltam reflexos). */
export function GoldFooterEggs() {
  const spots = [{ x: 7, s: 16, d: 0 }, { x: 19, s: 12, d: 1.1 }, { x: 33, s: 14, d: 2.3 }, { x: 66, s: 13, d: 0.6 }, { x: 80, s: 17, d: 1.7 }, { x: 93, s: 12, d: 2.9 }];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9">
      {spots.map((e, i) => (
        <span key={i} className="gold-foot absolute bottom-1.5" style={{ left: `${e.x}%`, "--dl": `${e.d}s` } as React.CSSProperties}>
          <EggBadge size={e.s} title="" />
          <i className="gold-twinkle" style={{ left: "-30%", top: "-10%" }} /><i className="gold-twinkle" style={{ right: "-30%", top: "35%", animationDelay: "1.2s" }} />
        </span>
      ))}
    </div>
  );
}
