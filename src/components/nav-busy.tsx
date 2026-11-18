"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useBusyWhile } from "@/components/toast";

/** Mostra “Carregando…” ao clicar em qualquer link interno (paginação, abrir lead, voltar…) até a nova tela chegar. */
export function NavBusy() {
  const path = usePathname();
  const sp = useSearchParams().toString();
  const [navigating, setNavigating] = useState(false);
  useBusyWhile(navigating);

  useEffect(() => setNavigating(false), [path, sp]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setNavigating(true);
    };
    // fase de captura: o Link do Next cancela o clique antes de chegar aqui
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  useEffect(() => {
    if (!navigating) return;
    const t = setTimeout(() => setNavigating(false), 15_000); // segurança: nunca trava a tela
    return () => clearTimeout(t);
  }, [navigating]);
  return null;
}
