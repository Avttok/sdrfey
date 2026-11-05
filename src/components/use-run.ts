"use client";

import { useTransition } from "react";
import { useBusyWhile, useToast } from "@/components/toast";

type R = { ok: boolean; message?: string } | void;

/** Executa uma ação do servidor: mostra “Carregando…” enquanto roda e o resultado num aviso (verde ok, vermelho erro). */
export function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const run = (fn: () => Promise<R>, okMsg?: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok) return toast("bad", r.message ?? "Não foi possível concluir.");
      toast("ok", (r && r.message) || okMsg || "Pronto.");
      after?.();
    });
  return { run, pending };
}
