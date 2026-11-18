"use client";

import { Undo2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { useRun } from "@/components/use-run";
import { btnGhost } from "@/components/ui";
import { revertAuditAction } from "@/modules/audit/revert";

export function RevertButton({ id }: { id: number }) {
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  return (
    <>
      <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Reverter esta alteração?", body: "O valor volta ao que era antes desta mudança. A reversão também fica registrada.", label: "Sim, reverter", icon: Undo2, tone: "warn", onConfirm: () => run(() => revertAuditAction(id)) })}><Undo2 size={15} aria-hidden /> Reverter</button>
      {dialog}
    </>
  );
}
