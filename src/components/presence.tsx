"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NAV } from "@/config/nav";
import { heartbeatAction } from "@/modules/leads/actions";

/** Avisa a cada 30 s que a pessoa está online e em qual aba (a tela de atendimento faz o próprio aviso). */
export function Presence() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith("/atender")) return;
    const label = NAV.find((n) => path.startsWith(n.href))?.label ?? "Navegando";
    const beat = () => void heartbeatAction(null, `Na aba ${label}`);
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [path]);
  return null;
}
