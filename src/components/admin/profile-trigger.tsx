"use client";

import { Sparkles } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { useRun } from "@/components/use-run";
import { btnGhost, panelCls } from "@/components/ui";
import { triggerProfileScreenAction } from "@/modules/admin/users";

/** Dev/Adm: faz a tela de primeiro acesso (personalizar perfil) aparecer para todos. */
export function ProfileTriggerAll() {
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  return (
    <div className={`${panelCls} flex flex-wrap items-center gap-3 p-4`}>
      {dialog}
      <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><Sparkles size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1"><p className="font-semibold">Tela de primeiro acesso</p><p className="text-xs text-muted">Faz todos os usuários passarem de novo pela personalização do perfil (a senha não muda). Também dá para pedir só para uma pessoa, no cartão dela.</p></div>
      <button type="button" className={btnGhost} disabled={pending} onClick={() => ask({ title: "Mostrar para todos?", body: "Todos os usuários ativos, inclusive você, verão a tela de personalização no próximo acesso.", label: "Sim, mostrar para todos", icon: Sparkles, tone: "warn", onConfirm: () => run(() => triggerProfileScreenAction("all")) })}><Sparkles size={15} aria-hidden /> Mostrar para todos</button>
    </div>
  );
}
