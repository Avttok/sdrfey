"use client";

import { useEffect, useState } from "react";

/** Degradê fixo na borda de baixo da tela visível (acompanha as barras do navegador e o teclado). */
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
  return <div aria-hidden className="pointer-events-none fixed inset-x-0 z-30 h-24 bg-gradient-to-t from-bg/90 via-bg/60 to-transparent" style={{ bottom: inset }} />;
}
