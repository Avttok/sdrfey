"use client";

import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { clearTestDataAction, createTestLeadsAction } from "@/modules/admin/config";
import { startTestAction } from "@/modules/leads/actions";

export function TestMode({ count }: { count: number }) {
  const [n, setN] = useState(20);
  const { run, pending } = useRun();
  return (
    <section className={`${panelCls} mx-auto max-w-2xl space-y-4 p-5`}>
      <p className="text-sm">Leads de teste existentes: <b>{count}</b>. Eles nunca aparecem em Leads, no Dashboard, nas metas ou no histórico real.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Quantidade<input type="number" min={1} max={200} className={`${inputCls} !w-28`} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => createTestLeadsAction(n))}>Criar leads de teste</button>
        <form action={startTestAction}><button type="submit" className={btnGhost}>Atender em modo teste</button></form>
        <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => { if (confirm("Apagar todos os leads de teste?")) run(() => clearTestDataAction()); }}>Apagar leads de teste</button>
      </div>
    </section>
  );
}
