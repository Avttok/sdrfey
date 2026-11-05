"use client";

import { Check } from "lucide-react";
import { useRun } from "@/components/use-run";
import { FONTS } from "@/config/fonts";
import { setFontAction } from "@/modules/users/actions";

/** Escolha da fonte do app: cada cartão mostra a própria fonte. */
export function FontPicker({ current }: { current: string }) {
  const { run, pending } = useRun();
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {FONTS.map((f) => {
        const on = f.key === current;
        return (
          <button key={f.key} type="button" disabled={pending} aria-pressed={on} onClick={() => !on && run(() => setFontAction(f.key), "Fonte atualizada.")}
            className={`relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${on ? "border-accent bg-grad-soft" : "border-line hover:border-muted hover:bg-sunk"}`}>
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-sunk text-2xl font-semibold" style={{ fontFamily: `${f.css}, sans-serif` }}>Aa</span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold" style={{ fontFamily: `${f.css}, sans-serif` }}>{f.label}</span>
              <span className="block truncate text-xs text-muted">{f.note}</span>
            </span>
            {on && <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-grad text-on-accent"><Check size={12} aria-hidden /></span>}
          </button>
        );
      })}
    </div>
  );
}
