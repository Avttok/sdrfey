"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { NavTree } from "@/config/nav-tree";
import type { NavCustom } from "@/config/nav-icons";
import { NavLinks } from "./nav-links";

/** Celular/tablet: botão de menu que abre uma gaveta com todas as pastas e abas já abertas. */
export function MobileNav({ hrefs, badges, grouped, custom, tree }: { hrefs: string[]; badges: Record<string, number>; grouped: boolean; custom: NavCustom; tree: NavTree | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); };
  }, [open]);
  const total = Object.values(badges).reduce((a, b) => a + b, 0);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl border border-line text-ink transition active:scale-95">
        <Menu size={20} aria-hidden />
        {total > 0 && <span aria-hidden className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-panel bg-danger" />}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[86vw] flex-col border-r border-line bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk"><X size={18} aria-hidden /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <NavLinks hrefs={hrefs} vertical badges={badges} grouped={grouped} custom={custom} tree={tree} />
            </div>
          </div>
        </div>,
        document.body)}
    </div>
  );
}
