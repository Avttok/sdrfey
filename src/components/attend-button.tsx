"use client";

import { Play } from "lucide-react";
import { useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, btnSmGhost, btnSmPrimary } from "@/components/ui";
import { attendAction } from "@/modules/leads/actions";
import { attendInactiveAction } from "@/modules/sales/actions";

/** Botão ATENDER: traz o lead para a tela de atendimento e segue o mesmo fluxo do sorteio. */
export function AttendButton({ leadId, compact = false, sales = false, label = "Atender", ghost = false }: { leadId: number; compact?: boolean; label?: string; ghost?: boolean; /** Lead inativo (cliente): o vendedor puxa para o Shuffler Vendas. */ sales?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  return (
    <button
      type="button"
      disabled={pending}
      className={ghost ? (compact ? btnSmGhost : btnGhost) : compact ? btnSmPrimary : btnPrimary}
      onClick={() => start(async () => { const r = await (sales ? attendInactiveAction(leadId) : attendAction(leadId)); if (r && !r.ok) toast("bad", r.message); })}
    >
      {pending ? <Spinner size={15} /> : <Play size={14} aria-hidden />} {label}
    </button>
  );
}
