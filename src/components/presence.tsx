"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pingAction } from "@/modules/users/presence";

/** Avisa a cada 30 s que a pessoa está online, em que tela está e se a aba está à vista (o Shuffler faz o próprio aviso). */
export function Presence() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith("/atender")) return;
    const beat = () => void pingAction(path, document.visibilityState === "visible").catch(() => {});
    beat();
    const t = setInterval(beat, 30_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [path]);
  return null;
}
