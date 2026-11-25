"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { btnGhost, btnPrimary } from "@/components/ui";

/** Janela de confirmação padrão do sistema (centralizada, com fundo escurecido). */
export function ConfirmDialog({ open, icon: Icon, title, children, confirmLabel, cancelLabel = "Cancelar", tone = "accent", busy, onConfirm, onCancel }: {
  open: boolean; icon?: LucideIcon; title: string; children?: React.ReactNode; confirmLabel: string; cancelLabel?: string;
  tone?: "accent" | "danger" | "warn"; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, onCancel]);
  if (!open || !mounted) return null;
  const hex = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className="modal-card relative w-full max-w-md overflow-hidden rounded-3xl border-2 shadow-2xl" style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${hex} 18%, var(--panel)), color-mix(in srgb, ${hex} 4%, var(--panel)) 72%)`, borderColor: `color-mix(in srgb, ${hex} 55%, transparent)` }}>
        {Icon && <Icon aria-hidden size={130} strokeWidth={1.3} className="pointer-events-none absolute -bottom-6 -right-4 -rotate-12 opacity-[.1]" style={{ color: hex }} />}
        <div className="relative space-y-4 p-6">
          <div className="flex items-start gap-4">
            {Icon && <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-md" style={{ background: `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))` }}><Icon size={24} aria-hidden /></span>}
            <div className="min-w-0 flex-1">
              <h2 className="display text-xl">{title}</h2>
              {children && <div className="mt-2 text-sm text-muted">{children}</div>}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btnGhost} disabled={busy} onClick={onCancel} autoFocus>{cancelLabel}</button>
            <button type="button" disabled={busy} onClick={onConfirm} className={tone === "danger" ? `${btnPrimary} !bg-grad-danger` : btnPrimary}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type AskReq = { title: string; body?: React.ReactNode; label: string; tone?: "accent" | "danger" | "warn"; icon?: LucideIcon; onConfirm: () => void };

/** Confirmação por popup para qualquer ação de apagar/resetar/pular: `ask({...})` abre, `dialog` vai uma vez no JSX. */
export function useConfirm(busy?: boolean) {
  const [req, setReq] = useState<AskReq | null>(null);
  const dialog = (
    <ConfirmDialog open={!!req} tone={req?.tone ?? "danger"} icon={req?.icon} title={req?.title ?? ""} confirmLabel={req?.label ?? "Confirmar"} busy={busy}
      onCancel={() => setReq(null)} onConfirm={() => { const r = req; setReq(null); r?.onConfirm(); }}>{req?.body}</ConfirmDialog>
  );
  return { ask: setReq, dialog };
}
