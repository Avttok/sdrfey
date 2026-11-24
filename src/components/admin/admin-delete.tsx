"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TypedConfirm } from "@/components/admin/purge-confirm";
import { useRun } from "@/components/use-run";
import { CONFIRM_WORD } from "@/modules/admin/purge-spec";

/** Botão de apagar que só o Adm vê (quem usa decide onde mostrar). Pede para digitar APAGAR. */
export function AdminDelete({ label, title, body, action, then, compact = false }: { label: string; title: string; body: string; action: () => Promise<{ ok: boolean; message?: string }>; /** Para onde ir depois (vazio = só atualizar). */ then?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useRun();
  const router = useRouter();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Só o Adm vê este botão" className={compact ? "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10" : "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-danger/50 px-3 text-sm font-semibold text-danger transition hover:bg-danger/10"}>
        <Trash2 size={compact ? 13 : 15} aria-hidden /> {label}
      </button>
      <TypedConfirm open={open} word={CONFIRM_WORD} busy={pending} label="Apagar" title={title} onCancel={() => setOpen(false)}
        onConfirm={() => { setOpen(false); run(action, undefined, () => (then ? router.replace(then) : router.refresh()), "Apagando…"); }}>
        <p>{body}</p><p>Não dá para desfazer.</p>
      </TypedConfirm>
    </>
  );
}
