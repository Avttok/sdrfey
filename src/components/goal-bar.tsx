"use client";

import { Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COLORS = ["#f5c542", "#ffe08a", "#f97316", "#ec4899", "#22c55e", "#3b82f6", "#a855f7"];
/** Confete que sai do troféu em leque para a direita, sempre dentro do cartão (nada vaza nem cobre o texto). */
const PIECES = Array.from({ length: 18 }, (_, i) => ({ dx: 24 + i * 12 + (i % 3) * 5, dy: ((i % 5) - 2) * 9, rot: (i * 83) % 360, c: COLORS[i % COLORS.length], d: (i % 6) * 0.05 }));

/** Barra que enche conforme o número sobe. Ao bater a meta o cartão fica dourado, com troféu, brilho e confete. */
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
    <div className={`relative overflow-hidden rounded-xl transition-colors ${done ? "gold-card -mx-2 px-2 py-2" : ""}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          {done && (
            <span className="trophy-medal relative grid size-7 shrink-0 place-items-center rounded-full text-[#5b3a00]">
              <Trophy size={15} aria-hidden />
            </span>
          )}
          <span className={`truncate ${done ? "font-semibold text-[#8a6100] dark:text-[#f5c542]" : "font-medium text-muted"}`}>{done ? `${label} · meta batida!` : label}</span>
        </span>
        <span className="figure shrink-0 text-sm font-bold text-ink">{value}<span className="font-normal text-muted"> / {qty}</span></span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={qty} aria-label={label}>
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? "gold-bar" : "bg-grad"}`} style={{ width: `${pct}%` }} />
      </div>
      {burst > 0 && done && (
        <span key={burst} aria-hidden className="pointer-events-none absolute left-6 top-1/2">
          {PIECES.map((p, i) => (
            <i key={i} className="confetti" style={{ background: p.c, ["--dx" as string]: `${p.dx}px`, ["--dy" as string]: `${p.dy}px`, ["--rot" as string]: `${p.rot}deg`, animationDelay: `${p.d}s` }} />
          ))}
        </span>
      )}
    </div>
  );
}
