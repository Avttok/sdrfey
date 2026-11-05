"use client";

import { Link2, Map } from "lucide-react";
import { useRun } from "@/components/use-run";
import { setMapModeAction } from "@/modules/users/actions";

/** Mapa do Google embutido (padrão) ou só o link "Google Maps" ao lado do endereço. */
export function MapModePicker({ current }: { current: "map" | "link" }) {
  const { run, pending } = useRun();
  const opt = (k: "map" | "link", Icon: typeof Map, title: string, hint: string) => (
    <button type="button" disabled={pending} aria-pressed={current === k} onClick={() => current !== k && run(() => setMapModeAction(k), "Preferência salva.")}
      className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${current === k ? "border-accent bg-grad-soft" : "border-line hover:bg-sunk"}`}>
      <span className="grid size-10 place-items-center rounded-lg bg-sunk text-accent"><Icon size={20} aria-hidden /></span>
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
    </button>
  );
  return <div className="grid gap-2 sm:grid-cols-2">{opt("map", Map, "Mapa do Google", "Mostra o mapa abaixo do representante mais próximo (padrão)")}{opt("link", Link2, "Só o link", "Esconde o mapa e deixa o link Google Maps ao lado do endereço")}</div>;
}
