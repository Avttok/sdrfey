"use client";

import { LockOpen, LogOut, Unplug } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useRun } from "@/components/use-run";
import { btnGhost } from "@/components/ui";
import { disconnectAllAction, disconnectUserAction, releaseAllLeadsAction } from "@/modules/admin/live";

/** Botões do topo de “Ao vivo”: liberar todos os leads e desconectar todo mundo. */
export function LiveToolbar() {
  const [ask, setAsk] = useState<"leads" | "all" | null>(null);
  const { run, pending } = useRun();
  return (
    <>
      <button type="button" className={btnGhost} disabled={pending} onClick={() => setAsk("leads")}><LockOpen size={15} aria-hidden /> Liberar todos os leads</button>
      <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => setAsk("all")}><Unplug size={15} aria-hidden /> Desconectar todos</button>
      <ConfirmDialog open={ask === "leads"} icon={LockOpen} tone="warn" busy={pending} title="Liberar todos os leads?" confirmLabel="Sim, liberar todos" cancelLabel="Cancelar" onCancel={() => setAsk(null)}
        onConfirm={() => { setAsk(null); run(() => releaseAllLeadsAction(), "Leads liberados."); }}>
        Todo lead que está sendo atendido volta para o sorteio agora. Quem estiver com um lead aberto vai receber outro no próximo Shuffler. Use quando houver congestionamento.
      </ConfirmDialog>
      <ConfirmDialog open={ask === "all"} icon={Unplug} tone="danger" busy={pending} title="Desconectar todos?" confirmLabel="Sim, desconectar" cancelLabel="Cancelar" onCancel={() => setAsk(null)}
        onConfirm={() => { setAsk(null); run(() => disconnectAllAction()); }}>
        Todas as pessoas, menos você, saem do sistema e precisam entrar de novo. Os leads que estavam com elas voltam ao sorteio.
      </ConfirmDialog>
    </>
  );
}

/** Derruba a sessão de uma pessoa. */
export function DisconnectButton({ id, name }: { id: number; name: string }) {
  const [ask, setAsk] = useState(false);
  const { run, pending } = useRun();
  return (
    <>
      <button type="button" className={`${btnGhost} !px-2.5 text-danger`} disabled={pending} title={`Desconectar ${name}`} onClick={() => setAsk(true)}><LogOut size={15} aria-hidden /> Desconectar</button>
      <ConfirmDialog open={ask} icon={LogOut} tone="danger" busy={pending} title={`Desconectar ${name}?`} confirmLabel="Sim, desconectar" cancelLabel="Cancelar" onCancel={() => setAsk(false)}
        onConfirm={() => { setAsk(false); run(() => disconnectUserAction(id)); }}>
        {name} sai do sistema agora e precisa entrar de novo. O lead que estiver com essa pessoa volta ao sorteio.
      </ConfirmDialog>
    </>
  );
}
