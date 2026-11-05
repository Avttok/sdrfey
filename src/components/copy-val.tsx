"use client";

import { Copy } from "lucide-react";
import { useToast } from "@/components/toast";

/** Valor com o pequeno ícone de copiar ao lado. `text` é o que vai para a área de transferência. */
export function CopyVal({ children, text, className = "" }: { children: React.ReactNode; text?: string | null; className?: string }) {
  const toast = useToast();
  const t = text ?? (typeof children === "string" || typeof children === "number" ? String(children) : "");
  if (!t) return <span className={className}>{children}</span>;
  const copy = async () => { try { await navigator.clipboard.writeText(t); toast("info", `Copiado: ${t}`); } catch { toast("warn", "Não consegui copiar."); } };
  return (
    <span className={`inline-flex min-w-0 items-start gap-1.5 ${className}`}>
      <span className="min-w-0 break-words">{children}</span>
      <button type="button" aria-label={`Copiar ${t}`} title="Copiar" onClick={copy} className="mt-0.5 shrink-0 rounded p-0.5 text-muted transition hover:bg-sunk hover:text-accent"><Copy size={13} aria-hidden /></button>
    </span>
  );
}
