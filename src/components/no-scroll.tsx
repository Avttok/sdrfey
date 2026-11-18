"use client";

import { useEffect } from "react";

/** Enquanto está na tela, a página cabe exatamente na janela (sem rolagem) e o rodapé continua visível. */
export function NoScroll() {
  useEffect(() => {
    document.documentElement.classList.add("fit-screen");
    return () => document.documentElement.classList.remove("fit-screen");
  }, []);
  return null;
}
