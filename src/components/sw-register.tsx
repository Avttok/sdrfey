"use client";

import { useEffect } from "react";

/** Registra o cache de arquivos estáticos (só em produção): recarregar a página não baixa tudo de novo. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
