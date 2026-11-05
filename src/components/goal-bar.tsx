"use client";

import { Sparkles, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COLORS = ["#f5c542", "#fff1a8", "#f97316", "#ec4899", "#22c55e", "#3b82f6", "#a855f7"];
const PIECES = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.2;
  const r = 38 + (i % 5) * 14;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r - 14, rot: (i * 67) % 360, c: COLORS[i % COLORS.length], d: (i % 4) * 0.05 };
});

/** Barra que enche conforme o número sobe. Ao bater a meta fica dourada, brilha, ganha troféu e solta confete. */
export function GoalBar({ label, value, qty }: { label: string; value: number; qty: number; alt?: boolean }) {
  const pct = qty > 0 ? Math.min(100, (value / qty) * 100) : 0;
  const done = qty > 0 && value >= qty;
  const [burst, setBurst] = useState(0);
  const was = useRef(done);
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    const key = `goal-party-${label}-${day}`;
    let seen = false;
    try { seen = sessionStorage.getItem(key) === "1"; } catch {}
    if (done && (!was.current || !seen)) {
      setBurst((n) => n + 1);
      try { sessionStorage.setItem(key, "1"); } catch {}
    }
    was.current = done;
  }, [done, label]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-muted">
          {done && (
            <span className="relative inline-grid size-6 place-items-center rounded-full text-[#5b3a00]" style={{ background: "linear-gradient(135deg,#fff1a8,#f5c542 55%,#b8860b)", animation: "trophy-pop .6s ease-out both, trophy-float 2.4s ease-in-out .6s infinite", boxShadow: "0 0 12px rgb(245 197 66 / .8)" }}>
              <Trophy size={14} aria-hidden />
              <Sparkles size={9} className="absolute -right-1.5 -top-1.5 text-[#f5c542]" style={{ animation: "sparkle 1.6s ease-in-out infinite" }} aria-hidden />
              <Sparkles size={8} className="absolute -bottom-1 -left-1.5 text-[#f5c542]" style={{ animation: "sparkle 1.6s ease-in-out .7s infinite" }} aria-hidden />
            </span>
          )}
          <span className={done ? "font-semibold text-[#b8860b] dark:text-[#f5c542]" : ""}>{done ? `${label} · meta batida!` : label}</span>
        </span>
        <span className="figure text-sm font-bold text-ink">{value}<span className="font-normal text-muted"> / {qty}</span></span>
      </div>
      <div className="relative">
        <div className="h-3 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={qty} aria-label={label}>
          <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? "gold-bar" : "bg-grad"}`} style={{ width: `${pct}%` }} />
        </div>
        {burst > 0 && (
          <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
            {PIECES.map((p, i) => (
              <i key={i} className="confetti" style={{ background: p.c, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, animationDelay: `${p.d}s` }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
