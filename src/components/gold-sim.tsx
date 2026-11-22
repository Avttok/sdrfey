"use client";

import { FlaskConical, PartyPopper, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { goldFxOff } from "@/lib/gold-fx";

/** Só para administradores: simula a meta do dia batida para testar o tema e o confete dourados. Não grava nada e vale só neste navegador. */
export function GoldSim() {
  const [on, setOn] = useState(false);
  const [off, setOff] = useState(false);
  useEffect(() => { setOff(goldFxOff()); const f = () => setOff(goldFxOff()); window.addEventListener("gold-fx", f); return () => window.removeEventListener("gold-fx", f); }, []);
  const fire = (d: "on" | "off") => { setOn(d === "on"); window.dispatchEvent(new CustomEvent("gold-sim", { detail: d })); };
  const btn = "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95";
  return (
    <div className="mx-3 mb-3 rounded-2xl border border-dashed border-[#f5c542]/60 bg-sunk p-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-[#f5c542] text-[#3b2a00]"><FlaskConical size={16} aria-hidden /></span>Simular meta batida<span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">Admin</span></p>
      <p className="mt-1.5 text-xs text-muted">Liga o tema dourado e o confete como se a meta do dia tivesse sido batida. Nada é gravado e só você vê.</p>
      {off && <p className="mt-1.5 text-xs text-warn">Os efeitos dourados estão desligados acima: ligue-os para ver o teste.</p>}
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={() => fire("on")} className={`${btn} bg-[#f5c542] text-[#3b2a00] hover:brightness-105`}><PartyPopper size={14} aria-hidden /> {on ? "Repetir confete" : "Simular"}</button>
        {on && <button type="button" onClick={() => fire("off")} className={`${btn} border border-line bg-panel text-muted hover:text-ink`}><RotateCcw size={13} aria-hidden /> Encerrar</button>}
      </div>
    </div>
  );
}
