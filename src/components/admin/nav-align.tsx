"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { saveNavAlignAction } from "@/modules/admin/config";

const OPTS = [[0, "Esquerda", AlignLeft, "Abas coladas na logo, a partir da esquerda."], [1, "Centro", AlignCenter, "Abas centralizadas na barra."], [2, "Direita", AlignRight, "Abas empurradas para a direita, perto do perfil."]] as const;

/** Onde as pastas/abas ficam na barra superior (vale para todos). */
export function NavAlign({ initial }: { initial: number }) {
  const { run, pending } = useRun();
  const [v, setV] = useState(initial);
  return (
    <div className="space-y-2">
      <h2 className="display text-lg">Posição das abas na barra</h2>
      <p className="text-sm text-muted">Escolha onde as pastas e abas ficam na barra superior. Vale para todos que usam a barra no topo.</p>
      <div role="radiogroup" aria-label="Posição das abas" className="grid gap-2 sm:grid-cols-3">
        {OPTS.map(([k, l, I, h]) => (
          <button key={k} type="button" role="radio" aria-checked={v === k} disabled={pending} onClick={() => { setV(k); run(() => saveNavAlignAction(k)); }}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5 ${v === k ? "border-accent bg-grad-soft shadow-md" : "border-line bg-panel hover:border-accent/50"}`}>
            <span className={`grid size-10 place-items-center rounded-xl ${v === k ? "bg-grad text-on-accent" : "bg-sunk text-muted"}`}><I size={20} aria-hidden /></span>
            <span><b className="block">{l}</b><span className="text-xs text-muted">{h}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
