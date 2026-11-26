"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Leva o conteúdo para o <body>. O vidro dos cartões (backdrop-filter) prende tudo o que é "fixed" dentro deles: janelas, menus e barras precisam sair do cartão. */
export function Portal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
