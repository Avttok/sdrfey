"use client";

import { DatabaseZap } from "lucide-react";
import { btnPrimary, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { enrichPendingDealsAction } from "@/modules/deals/actions";

/** Aviso das negociações importadas que esperam a consulta de CNPJ para entrar no kanban. */
export function PendingEnrich({ n }: { n: number }) {
  const { run, pending } = useRun();
  return (
    <div role="status" className={`${panelCls} flex flex-wrap items-center gap-3 border-accent/50 p-4`}>
      <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><DatabaseZap size={20} aria-hidden /></span>
      <p className="min-w-52 flex-1 text-sm"><b>{n} {n === 1 ? "negociação importada aguarda" : "negociações importadas aguardam"} a consulta de CNPJ</b><span className="block text-xs text-muted">Elas aparecem no kanban assim que o CNPJ for consultado (a consulta automática também cuida disso).</span></p>
      <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(() => enrichPendingDealsAction())}>{pending ? "Consultando…" : "Consultar agora"}</button>
    </div>
  );
}
