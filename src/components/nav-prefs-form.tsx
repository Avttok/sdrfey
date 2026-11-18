"use client";

import { ArrowDown, ArrowUp, PanelLeft, PanelTop } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary } from "@/components/ui";
import { NAV } from "@/config/nav";
import { setUserNavAction } from "@/modules/admin/user-prefs";
import { setNavPrefsAction } from "@/modules/users/actions";

/** Posição da barra de navegação (topo ou lateral) e ordem dos itens. */
export function NavPrefsForm({ layout: initialLayout, hrefs, userId }: { layout: "top" | "side"; hrefs: string[]; /** Só o Adm: edita a barra de outra pessoa. */ userId?: number }) {
  const [layout, setLayout] = useState(initialLayout);
  const [order, setOrder] = useState(hrefs);
  const { run, pending } = useRun();
  const move = (i: number, d: -1 | 1) => { const n = [...order]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); };
  const dirty = layout !== initialLayout || order.join() !== hrefs.join();
  const opt = (k: "top" | "side", Icon: typeof PanelTop, title: string, hint: string) => (
    <button type="button" aria-pressed={layout === k} onClick={() => setLayout(k)} className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${layout === k ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}>
      <span className="grid size-10 place-items-center rounded-lg bg-sunk text-accent"><Icon size={20} aria-hidden /></span>
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
    </button>
  );
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Posição da barra</p>
        <div className="grid gap-2 sm:grid-cols-2">{opt("top", PanelTop, "Horizontal no topo", "O estilo atual")}{opt("side", PanelLeft, "Vertical à esquerda", "Em telas pequenas volta para o topo")}</div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Ordem dos menus</p>
        <ol className="space-y-1.5">
          {order.map((h, i) => {
            const item = NAV.find((n) => n.href === h)!;
            return (
              <li key={h} className="flex items-center gap-3 rounded-xl bg-sunk px-3 py-2 text-sm">
                <span className="figure w-5 text-xs text-muted">{i + 1}</span>
                <item.icon size={16} className="text-accent" aria-hidden />
                <span className="flex-1 font-medium">{item.label}</span>
                <button type="button" aria-label={`Subir ${item.label}`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowUp size={15} /></button>
                <button type="button" aria-label={`Descer ${item.label}`} disabled={i === order.length - 1} onClick={() => move(i, 1)} className="rounded-md p-1.5 hover:bg-line disabled:opacity-30"><ArrowDown size={15} /></button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={!dirty || pending} onClick={() => run(() => (userId ? setUserNavAction(userId, { layout, order }) : setNavPrefsAction({ layout, order })))}>Salvar barra</button>
        <button type="button" className={btnGhost} disabled={pending} onClick={() => { setLayout("top"); setOrder(NAV.filter((n) => hrefs.includes(n.href)).map((n) => n.href)); }}>Restaurar padrão</button>
      </div>
    </div>
  );
}
