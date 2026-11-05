"use client";

import { Play } from "lucide-react";
import { useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnPrimary } from "@/components/ui";
import { attendAction } from "@/modules/leads/actions";

/** Botão ATENDER: traz o lead para a tela de atendimento e segue o mesmo fluxo do sorteio. */
export function AttendButton({ leadId, compact = false }: { leadId: number; compact?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  return (
    <button
      type="button"
      disabled={pending}
      className={`${btnPrimary} ${compact ? "!px-3 !py-1.5 !text-sm" : ""}`}
      onClick={() => start(async () => { const r = await attendAction(leadId); if (r && !r.ok) toast("bad", r.message); })}
    >
      {pending ? <Spinner size={15} /> : <Play size={15} aria-hidden />} ATENDER
    </button>
  );
}
