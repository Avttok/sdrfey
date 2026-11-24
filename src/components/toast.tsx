"use client";

import { AlertTriangle, CheckCircle2, Download, Info, Plus, RotateCcw, Save, Search, Send, Trash2, Upload, XCircle, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Spinner } from "./spinner";

type Kind = "ok" | "info" | "warn" | "bad";
type Item = { id: number; kind: Kind; text: string };

const ToastCtx = createContext<(kind: Kind, text: string) => void>(() => {});
const BusyCtx = createContext<{ begin: (label?: string) => void; end: (label?: string) => void }>({ begin: () => {}, end: () => {} });
export const useToast = () => useContext(ToastCtx);

/** Mostra o aviso “Carregando…” enquanto `active` for verdadeiro (ações do servidor, filtros, etc.). */
export function useBusyWhile(active: boolean, label?: string) {
  const { begin, end } = useContext(BusyCtx);
  useEffect(() => {
    if (!active) return;
    const l = label ?? busyLabelFrom(document.activeElement); // sem rótulo: vem do botão apertado
    begin(l);
    return () => end(l);
  }, [active, label, begin, end]);
}
export const useBusy = () => useContext(BusyCtx);

/** Texto e ícone animado do aviso de carregamento, de acordo com o que a pessoa acabou de pedir (Salvar → "Salvando…" com disquete). */
const VERBS: [RegExp, string, LucideIcon, string][] = [
  [/^(salvar|gravar|confirmar|aplicar)/i, "Salvando…", Save, "animate-floppy"],
  [/^(cancelar|encerrar|parar)/i, "Cancelando…", XCircle, "animate-pulse"],
  [/^(resetar|reiniciar|restaurar|reabrir)/i, "Resetando…", RotateCcw, "animate-spin"],
  [/^(descartar|excluir|apagar|remover|deletar|limpar)/i, "Removendo…", Trash2, "animate-shake"],
  [/^(pesquisar|buscar|atualizar informa|enriquecer|consultar|procurar)/i, "Pesquisando…", Search, "animate-pulse"],
  [/^(adicionar|criar|novo|nova|cadastrar|registrar|agendar)/i, "Adicionando…", Plus, "animate-pulse"],
  [/^(enviar|compartilhar|notificar)/i, "Enviando…", Send, "animate-bounce"],
  [/^(importar|anexar|carregar|subir)/i, "Importando…", Upload, "animate-bounce"],
  [/^(exportar|baixar|gerar)/i, "Gerando…", Download, "animate-bounce"],
];
export function busyKind(label: string): { Icon: LucideIcon | null; anim: string } {
  const v = VERBS.find(([, text]) => text === label);
  return v ? { Icon: v[2], anim: v[3] } : { Icon: null, anim: "" };
}
/** Descobre o rótulo do aviso a partir do botão que a pessoa acabou de apertar. */
export function busyLabelFrom(el: Element | null): string {
  const b = el?.closest?.("button, a, [role=button]") as HTMLElement | null;
  const txt = (b?.getAttribute("aria-label") || b?.textContent || "").trim();
  return VERBS.find(([re]) => re.test(txt))?.[1] ?? "Carregando…";
}

const STYLE: Record<Kind, { color: string; Icon: typeof Info }> = {
  ok: { color: "#1D9E75", Icon: CheckCircle2 },
  info: { color: "#378ADD", Icon: Info },
  warn: { color: "#EF9F27", Icon: AlertTriangle },
  bad: { color: "#E24B4A", Icon: XCircle },
};

/** Avisos fixos embaixo, centralizados, sempre visíveis (máx. 3). Mais o aviso de carregamento no topo. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === "bad" ? 6000 : 3500);
  }, []);
  const busyApi = useMemo(() => ({ begin: (l = "Carregando…") => setBusy((n) => [...n, l]), end: (l = "Carregando…") => setBusy((n) => { const i = n.lastIndexOf(l); return i < 0 ? n : n.filter((_, j) => j !== i); }) }), []);
  return (
    <ToastCtx.Provider value={push}>
      <BusyCtx.Provider value={busyApi}>
        {children}
        {busy.length > 0 && (
          <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-8 py-5 text-lg font-semibold shadow-2xl">
              {(() => { const last = busy[busy.length - 1]; const { Icon, anim } = busyKind(last); return Icon ? <Icon size={30} className={`text-accent ${anim}`} aria-hidden /> : <Spinner size={28} className="text-accent" />; })()} {busy[busy.length - 1]}
            </div>
          </div>
        )}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4">
          {items.map(({ id, kind, text }) => {
            const { color, Icon } = STYLE[kind];
            return (
              <div key={id} role={kind === "bad" ? "alert" : "status"} className="pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg" style={{ background: `color-mix(in srgb, ${color} 14%, var(--panel))`, borderColor: `color-mix(in srgb, ${color} 55%, transparent)` }}>
                <Icon size={18} style={{ color }} aria-hidden />
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      </BusyCtx.Provider>
    </ToastCtx.Provider>
  );
}
