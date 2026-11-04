"use client";

import { Play } from "lucide-react";
import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { btnPrimary } from "@/components/ui";
import { attendAction } from "@/modules/leads/actions";

/** Botão ATENDER: traz o lead para a tela de atendimento e segue o mesmo fluxo do sorteio. */
export function AttendButton({ leadId, compact = false }: { leadId: number; compact?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={`${btnPrimary} ${compact ? "!px-3 !py-1.5 !text-sm" : ""}`}
      onClick={() => start(async () => { const r = await attendAction(leadId); if (r && !r.ok) toast("bad", r.message); })}
    >
      <Play size={15} aria-hidden /> ATENDER
    </button>
  );
}
