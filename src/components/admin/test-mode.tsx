"use client";

import { useConfirm } from "@/components/confirm-dialog";
import { FlaskConical, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { clearTestDataAction, createTestLeadsAction } from "@/modules/admin/config";
import { startTestAction } from "@/modules/leads/actions";

export function TestMode({ count }: { count: number }) {
  const [n, setN] = useState(20);
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  return (
    <div className="space-y-4">
      <section className={`${panelCls} flex items-center gap-4 p-5`}>
        <span className="grid size-14 place-items-center rounded-2xl bg-grad-soft text-accent"><FlaskConical size={26} aria-hidden /></span>
        <div><p className="figure text-3xl font-bold leading-none">{count}</p><p className="mt-1 text-sm text-muted">leads de teste existentes. Eles nunca aparecem em Leads, Dashboard, metas ou histórico real.</p></div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className={`${panelCls} space-y-3 p-5`}>
          <h2 className="font-semibold">Criar leads de teste</h2>
          <label className="block text-sm"><span className="mb-1 block text-muted">Quantidade (1 a 200)</span><input type="number" min={1} max={200} className={inputCls} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
          <button type="button" className={`${btnPrimary} w-full`} disabled={pending} onClick={() => run(() => createTestLeadsAction(n))}><Plus size={16} aria-hidden /> Criar leads de teste</button>
        </section>
        <section className={`${panelCls} flex flex-col gap-3 p-5`}>
          <h2 className="font-semibold">Treinar e limpar</h2>
          <form action={startTestAction}><button type="submit" className={`${btnGhost} w-full`}><Play size={15} aria-hidden /> Atender em modo teste</button></form>
          <button type="button" className={`${btnGhost} w-full text-danger`} disabled={pending} onClick={() => ask({ title: "Apagar todos os leads de teste?", body: "Todos os leads, atendimentos e visitas do modo teste serão apagados. Os leads reais não mudam.", label: "Sim, apagar", icon: Trash2, onConfirm: () => run(() => clearTestDataAction()) })}><Trash2 size={15} aria-hidden /> Apagar leads de teste</button>
        </section>
      </div>
      {dialog}
    </div>
  );
}
