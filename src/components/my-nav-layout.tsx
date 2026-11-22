"use client";

import { PanelLeft, PanelTop } from "lucide-react";
import { useRun } from "@/components/use-run";
import { setMyNavLayoutAction } from "@/modules/users/actions";

/** Escolha da posição da barra de navegação (topo ou lateral esquerda). */
export function MyNavLayout({ current }: { current: "top" | "side" }) {
  const { run, pending } = useRun();
  const opt = (k: "top" | "side", Icon: typeof PanelTop, title: string, hint: string) => (
    <button type="button" disabled={pending} aria-pressed={current === k} onClick={() => current !== k && run(() => setMyNavLayoutAction(k))} className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${current === k ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}>
      <span className="grid size-10 place-items-center rounded-lg bg-sunk text-accent"><Icon size={20} aria-hidden /></span>
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
    </button>
  );
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Posição da barra</p>
      <div className="grid gap-2 sm:grid-cols-2">{opt("top", PanelTop, "Horizontal no topo", "Menus em cima")}{opt("side", PanelLeft, "Vertical à esquerda", "Em telas pequenas volta para o topo")}</div>
      <p className="mt-1.5 text-xs text-muted">A ordem e os nomes dos menus são definidos pela gestão.</p>
    </div>
  );
}
