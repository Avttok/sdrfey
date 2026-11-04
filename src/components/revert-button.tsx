"use client";

import { Undo2 } from "lucide-react";
import { useRun } from "@/components/use-run";
import { btnGhost } from "@/components/ui";
import { revertAuditAction } from "@/modules/audit/revert";

export function RevertButton({ id }: { id: number }) {
  const { run, pending } = useRun();
  return <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => { if (confirm("Reverter esta alteração?")) run(() => revertAuditAction(id)); }}><Undo2 size={15} aria-hidden /> Reverter</button>;
}
