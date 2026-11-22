"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { btnGhost, btnPrimary } from "@/components/ui";
import type { ClientHistory } from "@/modules/deals/history";
import { clientHistoryAction } from "@/modules/deals/history-actions";
import { ClientHistoryView } from "./client-history";

/**
 * Aviso de cliente que já tem histórico (carteira de algum vendedor): mostra tudo o que o sistema sabe
 * e pergunta se a pessoa quer prosseguir mesmo assim.
 */
export function ExistingClientDialog({ leadId, name, onProceed, onCancel, busy }: { leadId: number; name?: string; onProceed: () => void; onCancel: () => void; busy?: boolean }) {
  const [h, setH] = useState<ClientHistory | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    clientHistoryAction(leadId).then((r) => { if (live) { setH(r); setErr(!r); } }).catch(() => live && setErr(true));
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", key);
    return () => { live = false; document.removeEventListener("keydown", key); };
  }, [leadId, onCancel]);
  const sellers = h?.sellers ?? [];
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50 backdrop-blur-md p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-label="Cliente já cadastrado" className="mx-auto my-6 w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <span aria-hidden className="block h-1 bg-grad" />
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warn/15 text-warn"><AlertTriangle size={24} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 className="display text-xl">{name ?? h?.lead.company ?? "Este cliente"} já está no sistema</h2>
              <p className="mt-1 text-sm text-muted">{h ? (h.open ? <>Tem negociação aberta{h.open.sellerName ? <> com <b className="text-ink">{h.open.sellerName}</b></> : " sem vendedor"}.</> : sellers.length ? <>Está na carteira de <b className="text-ink">{sellers.join(", ")}</b>.</> : "Já tem histórico comercial.") : "Buscando o histórico…"}</p>
            </div>
            <button type="button" aria-label="Fechar" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk" onClick={onCancel}><X size={18} aria-hidden /></button>
          </div>
          {!h && !err && <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted"><Loader2 size={16} className="animate-spin" aria-hidden /> Carregando…</p>}
          {err && <p className="rounded-lg bg-danger/12 px-3 py-2 text-sm text-danger">Não consegui carregar o histórico agora.</p>}
          {h && <ClientHistoryView h={h} maxH="max-h-44" />}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line/70 pt-4">
            <button type="button" className={btnGhost} disabled={busy} onClick={onCancel} autoFocus>Cancelar</button>
            {h?.open
              ? <Link href={`/negociacoes/${h.open.id}`} className={btnPrimary}>Abrir a negociação existente</Link>
              : <button type="button" className={btnPrimary} disabled={busy || !h} onClick={onProceed}>Prosseguir mesmo assim</button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
