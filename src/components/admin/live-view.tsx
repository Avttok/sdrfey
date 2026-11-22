"use client";

import { Eye, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { btnGhost, panelCls } from "@/components/ui";

type Snap = { id?: number; image?: string; path?: string | null; at?: string };

/** Botão “Ver tela” e a janela que mostra a foto da tela da pessoa, renovada a cada 3 s. */
export function LiveView({ uid, name }: { uid: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<Snap>({});
  const [stale, setStale] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    if (!open) return;
    let alive = true; last.current = 0; setSnap({}); setStale(false);
    const pull = async () => {
      try {
        const j = (await (await fetch(`/api/live/snap?uid=${uid}&after=${last.current}`, { cache: "no-store" })).json()) as Snap;
        if (!alive) return;
        if (j.id) { last.current = j.id; setSnap(j); setStale(false); }
        else if (last.current && Date.now() - new Date(snap.at ?? Date.now()).getTime() > 15_000) setStale(true);
      } catch { /* tenta de novo */ }
    };
    void pull();
    const t = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, uid]);
  return (
    <>
      <button type="button" className={`${btnGhost} !px-2.5`} title={`Ver a tela de ${name}`} onClick={() => setOpen(true)}><Eye size={15} aria-hidden /> Ver tela</button>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-md p-4" role="dialog" aria-modal="true" aria-label={`Tela de ${name}`} onClick={() => setOpen(false)}>
          <div className={`${panelCls} !bg-panel/85 backdrop-blur-3xl backdrop-saturate-150 flex max-h-[90vh] w-full max-w-5xl flex-col gap-3 p-4`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{name}{snap.path && <span className="ml-2 text-xs font-normal text-muted">{snap.path}</span>}</p>
              <button type="button" className={`${btnGhost} !px-2`} onClick={() => setOpen(false)} aria-label="Fechar"><X size={16} aria-hidden /></button>
            </div>
            <div className="grid min-h-48 flex-1 place-items-center overflow-auto rounded-xl bg-sunk">
              {snap.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={snap.image} alt={`Tela de ${name}`} className="h-auto max-h-[70vh] w-full object-contain" />
                : <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Esperando a tela de {name}… (pode levar até 20 s; a pessoa precisa estar com a aba aberta)</p>}
            </div>
            <p className="text-xs text-muted">{stale ? "Sem imagem nova há alguns segundos (aba em segundo plano ou offline)." : snap.at ? `Atualizada às ${new Date(snap.at).toLocaleTimeString("pt-BR")} · foto comprimida, renova a cada 3 s · guardamos só as 10 últimas por 5 min` : "A pessoa vê um aviso enquanto a tela está sendo compartilhada."}</p>
          </div>
        </div>
      )}
    </>
  );
}
