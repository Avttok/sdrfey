"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Confere de novo se apareceu lead disponível. */
export function RefreshButton({ label = "Conferir de novo" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => router.refresh())} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/80 px-6 py-3 text-base font-semibold shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-accent/60 disabled:opacity-60">
      {pending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <RefreshCw size={18} aria-hidden />} {label}
    </button>
  );
}
