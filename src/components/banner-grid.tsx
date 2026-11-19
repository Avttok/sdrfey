"use client";

import { Check } from "lucide-react";
import { BANNERS, bannerStyle } from "@/config/banners";

/** Amostras dos padrões de banner (usam a cor do sistema da pessoa). */
export function BannerGrid({ value, onPick, disabled }: { value: string | null; onPick: (k: string | null) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Banner do perfil">
      {BANNERS.map((b) => {
        const on = (value ?? "aurora") === b.key;
        return (
          <button key={b.key} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onPick(b.key === "aurora" ? null : b.key)} className={`group relative overflow-hidden rounded-xl border-2 text-left transition hover:-translate-y-0.5 ${on ? "border-accent shadow-md" : "border-line"}`}>
            <span className="block h-14" style={bannerStyle(b.key)} />
            <span className="flex items-center justify-between bg-panel px-2.5 py-1.5 text-xs font-medium">{b.label}{on && <Check size={13} className="text-accent" aria-hidden />}</span>
          </button>
        );
      })}
    </div>
  );
}
