"use client";

import { ScrollText } from "lucide-react";
import { useState } from "react";
import { panelCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { setRoteiroGlobalAction } from "@/modules/scripts/toggle";

/** Chave geral do roteiro durante a ligação. Por pessoa ou cargo: Permissões (Funções). */
export function RoteiroSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function flip() {
    setBusy(true);
    const next = !on;
    const r = await setRoteiroGlobalAction(next).catch(() => ({ ok: false }));
    setBusy(false);
    if (r.ok) { setOn(next); toast("ok", next ? "Roteiro ligado para todos." : "Roteiro desligado para todos."); } else toast("bad", "Não consegui salvar.");
  }
  return (
    <section className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
      <ScrollText size={18} className="text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Roteiro durante a ligação</p>
        <p className="text-sm text-muted">Chave geral. Para liberar ou bloquear só algumas pessoas ou cargos, use Permissões › Funções (“Roteiro” e “Ligar pelo discador”). O discador geral é a chave “Ligado” abaixo.</p>
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={() => void flip()} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-ok" : "bg-line"} disabled:opacity-60`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
        <span className="sr-only">{on ? "Ligado" : "Desligado"}</span>
      </button>
    </section>
  );
}
