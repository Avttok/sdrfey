"use client";

import { Ban, ChevronDown, ClipboardCheck, PhoneMissed, Voicemail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type CallResult = "caixa_postal" | "nao_atendeu" | "numero_errado";
const OPTIONS: { key: CallResult; label: string; hint: string; Icon: typeof Ban; danger?: boolean }[] = [
  { key: "caixa_postal", label: "Caixa postal", hint: "Caiu na caixa postal", Icon: Voicemail },
  { key: "nao_atendeu", label: "Não atende", hint: "Tocou e ninguém atendeu", Icon: PhoneMissed },
  { key: "numero_errado", label: "Inválido", hint: "Marca o número como inválido", Icon: Ban, danger: true },
];

/** Botão "Resultado" com seta: marca como foi a ligação sem sair da etapa. "Inválido" também invalida o número. */
export function CallResultMenu({ onPick, disabled }: { onPick: (r: CallResult) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }); setOpen((o) => !o); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-panel px-3 text-sm font-semibold transition hover:border-accent disabled:opacity-50"><ClipboardCheck size={15} aria-hidden /> Resultado <ChevronDown size={14} aria-hidden className={open ? "rotate-180 transition" : "transition"} /></button>
      {open && pos && (
        <div role="menu" style={{ position: "fixed", top: pos.top, right: pos.right }} className="z-[80] min-w-48 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
          {OPTIONS.map((o) => <button key={o.key} type="button" role="menuitem" title={o.hint} onClick={() => { setOpen(false); onPick(o.key); }} className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm font-semibold hover:bg-accent/10 ${o.danger ? "text-danger" : ""}`}><o.Icon size={15} aria-hidden /> {o.label}</button>)}
        </div>
      )}
    </div>
  );
}
