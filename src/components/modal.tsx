"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SIZE = { sm: "sm:max-w-md", md: "sm:max-w-2xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" } as const;

/**
 * Janela padrão do sistema (popups). Cabeçalho com ícone, título e subtítulo; corpo rolável; rodapé fixo para os botões.
 * Fecha com Esc, clique fora ou no X (a menos que `locked`); prende o foco dentro, trava a rolagem da página e, no celular, sobe de baixo como uma folha.
 */
export function Modal({ onClose, title, subtitle, icon: Icon, badges, size = "md", locked = false, footer, children, label }: {
  onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; icon?: LucideIcon; badges?: React.ReactNode; size?: keyof typeof SIZE;
  /** Com alterações não salvas: Esc e clique fora não fecham. */
  locked?: boolean; footer?: React.ReactNode; children: React.ReactNode; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const lockRef = useRef(locked); lockRef.current = locked;
  const titleId = useId();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const body = document.body; const keep = body.style.overflow; body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lockRef.current) { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); body.style.overflow = keep; prev?.focus?.(); };
  }, []);
  if (!host) return null;
  return createPortal(
    <div className="modal-back fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={label ? undefined : titleId}
        className={`modal-card card-edge card-surface flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl outline-none sm:max-h-[90dvh] sm:rounded-3xl ${SIZE[size]}`}>
        <header className="relative flex items-start gap-3 overflow-hidden border-b-2 border-accent/25 bg-grad-soft px-5 py-4 sm:px-6">
          {Icon && <Icon aria-hidden size={110} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-3 -rotate-12 text-accent opacity-[.1]" />}
          {Icon && <span className="card-tile relative grid size-12 shrink-0 place-items-center rounded-2xl"><Icon size={22} aria-hidden /></span>}
          <div className="relative min-w-0 flex-1">
            <h2 id={titleId} className="display break-words text-xl leading-tight sm:text-2xl">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
          </div>
          <button type="button" aria-label="Fechar" className="relative grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-sunk hover:text-ink" onClick={onClose}><X size={18} aria-hidden /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t-2 border-accent/20 bg-panel/80 px-5 py-3.5 sm:px-6">{footer}</footer>}
      </div>
    </div>,
    host,
  );
}

/** Bloco com título dentro de uma janela ou página (mesmo visual em todo o sistema). */
export function Block({ title, icon: Icon, children, className = "" }: { title: string; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border-2 border-accent/20 bg-sunk/40 p-4 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">{Icon && <span className="card-tile grid size-6 place-items-center rounded-lg"><Icon size={13} aria-hidden /></span>}{title}</h3>
      {children}
    </section>
  );
}
