"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";

/** Confirmação para apagar em massa: a pessoa precisa digitar a palavra (ex.: APAGAR) para liberar o botão. */
export function TypedConfirm({ open, title, children, word, label, busy, onCancel, onConfirm }: {
  open: boolean; title: string; children?: React.ReactNode; word: string; label: string; busy?: boolean; onCancel: () => void; onConfirm: (typed: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setTyped(""); }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, onCancel]);
  if (!open || !mounted) return null;
  const ok = typed.trim().toUpperCase() === word;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 backdrop-blur-md p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form role="alertdialog" aria-modal="true" aria-label={title} className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
        onSubmit={(e) => { e.preventDefault(); if (ok && !busy) onConfirm(typed); }}>
        <span aria-hidden className="block h-1 bg-grad-danger" />
        <div className="space-y-4 p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger"><AlertTriangle size={24} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 className="display text-xl">{title}</h2>
              {children && <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>}
            </div>
          </div>
          <label className="block text-sm"><span className="mb-1 block text-muted">Para confirmar, digite <b className="text-ink">{word}</b></span>
            <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} aria-label={`Digite ${word}`} /></label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btnGhost} disabled={busy} onClick={onCancel}>Cancelar</button>
            <button type="submit" disabled={!ok || busy} className={`${btnPrimary} !bg-grad-danger`}>{label}</button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
