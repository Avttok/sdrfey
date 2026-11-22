"use client";

import { ChevronDown, FilterX, ListFilter, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

/**
 * Barra de filtros padrão do sistema: o que é principal (a busca) fica sempre à vista; os demais filtros
 * ficam atrás do botão "Filtros", que recolhe/expande com animação e lembra a escolha em cada tela.
 * `active` = quantos filtros estão ligados (vira o número no botão); `chips` = resumo dos filtros ativos.
 */
export function FilterBar({ id, search, active = 0, onClear, chips, children, defaultOpen = false, label = "Filtros" }: {
  id: string; search?: React.ReactNode; active?: number; onClear?: () => void; chips?: React.ReactNode; children?: React.ReactNode; defaultOpen?: boolean; label?: string;
}) {
  void defaultOpen; // todo filtro do sistema nasce recolhido, sempre (sem lembrar a escolha anterior)
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 p-3">
        {search && <div className="relative min-w-60 flex-1">{search}</div>}
        {!search && <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted"><ListFilter size={15} aria-hidden />{active ? `${active} ${active === 1 ? "filtro ativo" : "filtros ativos"}` : "Sem filtros"}</span>}
        {children && (
          <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`filters-${id}`} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${open ? "border-accent bg-accent/10 text-accent" : "border-line hover:bg-sunk"}`}>
            <SlidersHorizontal size={16} aria-hidden /> {label}
            {active ? <span className="figure rounded-full bg-accent px-1.5 text-xs text-on-accent">{active}</span> : null}
            <ChevronDown size={15} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
        {active > 0 && onClear && <button type="button" onClick={onClear} className="inline-flex items-center gap-2 rounded-xl border border-danger/50 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-sunk"><FilterX size={16} aria-hidden /> Limpar</button>}
      </div>
      {chips && <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-sunk/40 px-3 py-2.5">{chips}</div>}
      {children && (
        <div id={`filters-${id}`} className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
          <div className="min-h-0 overflow-hidden"><div inert={!open} className="border-t border-line p-4 sm:p-5">{children}</div></div>
        </div>
      )}
    </div>
  );
}
