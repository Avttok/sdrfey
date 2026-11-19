"use client";

import { ChevronDown, ListChecks } from "lucide-react";
import { useState } from "react";
import type { GuideCol } from "@/config/import-guide";

/** Guia de colunas: o que cada uma significa e todos os valores que aceita. Abre inteiro por padrão. */
export function ImportGuide({ cols, extra = {} }: { cols: GuideCol[]; /** valores extras por coluna (ex.: condições de pagamento já cadastradas) */ extra?: Record<string, string[]> }) {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const list = cols.filter((c) => !q || `${c.col} ${c.what} ${(c.alias ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left text-sm font-semibold"><ListChecks size={16} className="text-accent" aria-hidden /> O que vai em cada coluna<ChevronDown size={15} className={`ml-auto transition ${open ? "rotate-180" : ""}`} aria-hidden /></button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-line p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar coluna…" aria-label="Procurar coluna" className="w-full rounded-lg border border-line bg-sunk px-3 py-2 text-sm sm:max-w-xs" />
          <ul className="divide-y divide-line/70">
            {list.map((c) => {
              const vals = [...(c.values ?? []), ...(extra[c.col] ?? [])];
              return (
                <li key={c.col} className="grid gap-1.5 py-2.5 md:grid-cols-[13rem_1fr]">
                  <div>
                    <p className="text-sm font-semibold">{c.col}{c.required && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-px text-[10px] font-semibold text-accent">obrigatória</span>}</p>
                    {c.alias && <p className="text-[11px] text-muted">também aceita: {c.alias.join(", ")}</p>}
                  </div>
                  <div className="min-w-0 space-y-1.5 text-sm">
                    <p className="text-muted">{c.what}</p>
                    {c.format && <p className="text-xs"><span className="text-muted">Formato: </span><code className="rounded bg-sunk px-1.5 py-0.5">{c.format}</code></p>}
                    {vals.length > 0 && <div className="flex flex-wrap items-center gap-1"><span className="text-xs text-muted">Valores aceitos:</span>{vals.map((v) => <code key={v} className="rounded-md border border-line bg-sunk px-1.5 py-0.5 text-xs">{v}</code>)}</div>}
                  </div>
                </li>
              );
            })}
            {list.length === 0 && <li className="py-3 text-sm text-muted">Nenhuma coluna com esse nome.</li>}
          </ul>
          <p className="text-xs text-muted">Maiúsculas, minúsculas e acentos não importam nos nomes das colunas nem nos valores. A ordem das colunas também não.</p>
        </div>
      )}
    </div>
  );
}
