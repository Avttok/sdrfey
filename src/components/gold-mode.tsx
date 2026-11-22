"use client";

import { EyeOff, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { goldFxOff, setGoldFxOff } from "@/lib/gold-fx";
import { goalReachedAction } from "@/modules/goals/gold-actions";

const COLORS = ["#f5c542", "#fff1a8", "#e0a800", "#ffd96b", "#b8860b", "#ffffff"];
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

/** Meta do dia batida: o sistema inteiro vira dourado, com confete e troféus uma vez por dia. Dá para ocultar os efeitos. */
export function GoldMode({ reached, label, userId }: { reached: boolean; label: string; userId: number }) {
  const [off, setOff] = useState(false);
  const [show, setShow] = useState(false);
  /** Simulação do admin (só visual, não grava nada): liga o tema dourado e repete a comemoração para testar. */
  const [sim, setSim] = useState(false);
  const [boom, setBoom] = useState(0);
  useEffect(() => {
    const f = (e: Event) => {
      const d = (e as CustomEvent<string>).detail;
      if (d === "off") { setSim(false); setShow(false); return; }
      setSim(true); setBoom((n) => n + 1);
    };
    window.addEventListener("gold-sim", f);
    return () => window.removeEventListener("gold-sim", f);
  }, []);
  const on = reached || sim;
  useEffect(() => { setOff(goldFxOff()); const f = () => setOff(goldFxOff()); window.addEventListener("gold-fx", f); return () => window.removeEventListener("gold-fx", f); }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (on && !off) root.dataset.gold = "on"; else delete root.dataset.gold;
    return () => { delete root.dataset.gold; };
  }, [on, off]);
  useEffect(() => {
    if (!boom || goldFxOff()) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 14_000);
    return () => clearTimeout(t);
  }, [boom]);
  useEffect(() => {
    if (!reached) return;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const key = `gold-seen-${userId}-${day}`;
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; localStorage.setItem(key, "1"); } catch { /* sem armazenamento: celebra de novo, sem problema */ }
    if (seen) return;
    void goalReachedAction(label).catch(() => {});
    if (goldFxOff()) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 14_000);
    return () => clearTimeout(t);
  }, [reached, label, userId]);

  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: rnd(i, 1) * 100, d: rnd(i, 2) * 1.6, t: 3.2 + rnd(i, 3) * 2.6, s: 6 + rnd(i, 4) * 8, c: COLORS[i % COLORS.length], r: rnd(i, 5) * 720 - 360, w: (rnd(i, 6) - 0.5) * 120, trophy: i % 9 === 0 })), []);
  if (!on) return null;
  return (
    <>
      {!off && <div aria-hidden className="gold-ribbon pointer-events-none fixed inset-x-0 top-0 z-[90] h-1" />}
      {show && !off && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[85] overflow-hidden">
            {pieces.map((p, i) => p.trophy
              ? <Trophy key={i} className="gold-fall absolute text-[#f5c542]" size={22 + (i % 3) * 6} style={{ left: `${p.x}%`, top: "-40px", "--w": `${p.w}px`, "--r": `${p.r}deg`, animationDelay: `${p.d}s`, animationDuration: `${p.t + 1.5}s` } as React.CSSProperties} />
              : <i key={i} className="gold-fall absolute block rounded-[2px]" style={{ left: `${p.x}%`, top: "-20px", width: p.s, height: p.s * 0.55, background: p.c, "--w": `${p.w}px`, "--r": `${p.r}deg`, animationDelay: `${p.d}s`, animationDuration: `${p.t}s` } as React.CSSProperties} />)}
          </div>
          <div role="status" className="fixed bottom-24 left-1/2 z-[86] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#f5c542]/60 bg-panel px-4 py-3 shadow-2xl gold-card ann-drop">
            <span className="grid size-10 place-items-center rounded-xl bg-[#f5c542] text-[#3b2a00]"><Trophy size={20} aria-hidden /></span>
            <div><p className="font-semibold leading-tight">{sim && !reached ? "Meta do dia batida! (simulação)" : "Meta do dia batida!"}</p><p className="text-xs text-muted">{sim && !reached ? "Teste do administrador: nada foi gravado." : "Parabéns, a plataforma ficou dourada para você."}</p></div>
            <button type="button" onClick={() => { setGoldFxOff(true); setShow(false); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:bg-sunk hover:text-ink"><EyeOff size={13} aria-hidden /> Ocultar efeitos</button>
          </div>
        </>
      )}
    </>
  );
}
