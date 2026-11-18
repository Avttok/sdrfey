"use client";

import { Eye, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export type MetasTab = { key: string; label: string; sub: string; icon: React.ReactNode; view: React.ReactNode; edit?: React.ReactNode; /** filtro de período (dia ou mês), só no Resumo */ filter?: React.ReactNode };

/** Casca da tela de Metas: uma aba por área (SDR, Vendas) e, dentro dela, "Resumo" (só ver) ou "Editar metas". */
export function MetasShell({ tabs }: { tabs: MetasTab[] }) {
  const [key, setKey] = useState(tabs[0]?.key);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const cur = tabs.find((t) => t.key === key) ?? tabs[0];
  if (!cur) return null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Área das metas" className="inline-flex gap-1 rounded-2xl border border-line/60 bg-panel/70 p-1">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={t.key === cur.key} onClick={() => { setKey(t.key); setMode("view"); }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${t.key === cur.key ? "bg-grad text-on-accent shadow" : "text-muted hover:bg-sunk hover:text-ink"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}
        <p className="min-w-0 flex-1 text-sm text-muted">{cur.sub}</p>
        {mode === "view" && cur.filter}
        {cur.edit && (
          <div role="tablist" aria-label="Modo" className="inline-flex gap-1 rounded-xl border border-line/60 bg-panel/70 p-1 text-sm">
            {([["view", "Resumo", Eye], ["edit", "Editar metas", SlidersHorizontal]] as const).map(([m, l, I]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${mode === m ? "bg-accent/15 text-accent" : "text-muted hover:bg-sunk"}`}><I size={14} aria-hidden /> {l}</button>
            ))}
          </div>
        )}
      </div>
      <div key={`${cur.key}-${mode}`} className="pop-in">{mode === "edit" && cur.edit ? cur.edit : cur.view}</div>
    </div>
  );
}
