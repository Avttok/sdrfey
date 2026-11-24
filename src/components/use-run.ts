"use client";

import { useState, useTransition } from "react";
import { useBusyWhile, useToast } from "@/components/toast";

type R = { ok: boolean; message?: string } | void;

/** Executa uma ação do servidor: mostra “Carregando…” enquanto roda e o resultado num aviso (verde ok, vermelho erro). */
export function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState<string | undefined>(undefined);
  useBusyWhile(pending, label);
  /** `busy` (opcional) força o texto do aviso; senão ele vem do botão apertado (Salvar → Salvando…). */
  const run = (fn: () => Promise<R>, okMsg?: string, after?: () => void, busy?: string) => {
    setLabel(busy);
    start(async () => {
      let r: R;
      try { r = await fn(); } catch { return toast("bad", "Algo deu errado e nada foi alterado. Tente de novo."); }
      if (r && !r.ok) return toast("bad", r.message ?? "Não foi possível concluir.");
      toast("ok", (r && r.message) || okMsg || "Pronto.");
      after?.();
    });
  };
  return { run, pending };
}
