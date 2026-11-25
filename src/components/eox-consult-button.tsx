"use client";

import { Loader2, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { eoxConsultLeadAction } from "@/modules/eox/consult-actions";
import { btnGhost } from "./ui";
import { useToast } from "./toast";

/** Botão do Adm no perfil do lead: procura este lead na EOX agora e completa o que faltar (Código/link do perfil, telefones, pessoas, endereço…). */
export function EoxConsultButton({ leadId, checkedAt, linked }: { leadId: number; /** quando a EOX foi pesquisada para este lead (ISO) */ checkedAt?: string | null; linked?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button type="button" disabled={pending} className={btnGhost} title={checkedAt ? "Já pesquisado na EOX: clique para pesquisar de novo" : "Procurar este lead na EOX e completar os dados"} onClick={() => start(async () => { const r = await eoxConsultLeadAction(leadId); toast(r.ok ? "ok" : "bad", r.message ?? ""); if (r.ok) router.refresh(); })}>
      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Plug size={15} aria-hidden />} {checkedAt ? <>Repesquisar na EOX <span className="rounded-full bg-ok/15 px-1.5 text-[10px] font-bold text-ok">pesquisado {new Date(checkedAt).toLocaleDateString("pt-BR")}{linked === false ? " · sem cadastro" : ""}</span></> : "Consultar na EOX"}
    </button>
  );
}
