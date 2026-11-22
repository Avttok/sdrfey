"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { goldFxOff, setGoldFxOff } from "@/lib/gold-fx";

/** Liga/desliga os efeitos dourados (confete e tema dourado ao bater a meta do dia). */
export function GoldFxToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => { setOff(goldFxOff()); const f = () => setOff(goldFxOff()); window.addEventListener("gold-fx", f); return () => window.removeEventListener("gold-fx", f); }, []);
  return (
    <button type="button" role="switch" aria-checked={!off} onClick={() => setGoldFxOff(!off)} className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-sunk p-3 text-left transition hover:bg-sunk/70">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f5c542] text-[#3b2a00]"><Sparkles size={17} aria-hidden /></span>
      <span className="min-w-0 flex-1 text-sm font-semibold">Efeitos dourados<span className="block text-xs font-normal text-muted">Confete e tema dourado ao bater a meta</span></span>
      <span aria-hidden className={`relative h-6 w-10 shrink-0 rounded-full transition ${off ? "bg-line" : "bg-accent"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${off ? "left-0.5" : "left-[1.15rem]"}`} /></span>
    </button>
  );
}
