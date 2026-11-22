"use client";

import { useEffect } from "react";

const editable = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, [contenteditable='true']");

/** Dissuasão de cópia (ligada pelo Adm): sem seleção, cópia, arrastar nem menu do botão direito fora dos campos de texto. */
export function CopyGuard() {
  useEffect(() => {
    document.documentElement.setAttribute("data-copy-guard", "on");
    const stop = (e: Event) => { if (!editable(e.target)) e.preventDefault(); };
    const evs = ["copy", "cut", "dragstart", "contextmenu", "selectstart"] as const;
    evs.forEach((n) => document.addEventListener(n, stop));
    return () => { evs.forEach((n) => document.removeEventListener(n, stop)); document.documentElement.removeAttribute("data-copy-guard"); };
  }, []);
  return null;
}
