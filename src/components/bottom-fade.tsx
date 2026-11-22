"use client";

import { useEffect, useState } from "react";

/** Degradê fixo na borda de baixo da tela visível (acompanha as barras do navegador e o teclado). */
const EXTRA = 200;
export function BottomFade() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const f = () => setInset(Math.max(0, Math.round(window.innerHeight - (v.offsetTop + v.height))));
    f();
    v.addEventListener("resize", f); v.addEventListener("scroll", f); window.addEventListener("resize", f);
    return () => { v.removeEventListener("resize", f); v.removeEventListener("scroll", f); window.removeEventListener("resize", f); };
  }, []);
  /* O degradê desce 200px além da borda da tela (parte de baixo sólida): se a barra do navegador ou a troca de aba mexer na altura, nunca aparece o corte entre o fim do degradê e o fim da página. */
  return <div aria-hidden className="pointer-events-none fixed inset-x-0 z-30" style={{ bottom: inset - EXTRA, height: EXTRA + 96, background: `linear-gradient(to top, color-mix(in srgb, var(--bg) 90%, transparent) ${EXTRA}px, color-mix(in srgb, var(--bg) 60%, transparent) ${EXTRA + 40}px, transparent)` }} />;
}
