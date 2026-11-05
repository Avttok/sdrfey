"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Spinner } from "./spinner";

type Kind = "ok" | "info" | "warn" | "bad";
type Item = { id: number; kind: Kind; text: string };

const ToastCtx = createContext<(kind: Kind, text: string) => void>(() => {});
const BusyCtx = createContext<{ begin: () => void; end: () => void }>({ begin: () => {}, end: () => {} });
export const useToast = () => useContext(ToastCtx);

/** Mostra o aviso “Carregando…” enquanto `active` for verdadeiro (ações do servidor, filtros, etc.). */
export function useBusyWhile(active: boolean) {
  const { begin, end } = useContext(BusyCtx);
  useEffect(() => {
    if (!active) return;
    begin();
    return end;
  }, [active, begin, end]);
}
export const useBusy = () => useContext(BusyCtx);

const STYLE: Record<Kind, { color: string; Icon: typeof Info }> = {
  ok: { color: "#1D9E75", Icon: CheckCircle2 },
  info: { color: "#378ADD", Icon: Info },
  warn: { color: "#EF9F27", Icon: AlertTriangle },
  bad: { color: "#E24B4A", Icon: XCircle },
};

/** Avisos fixos embaixo, centralizados, sempre visíveis (máx. 3). Mais o aviso de carregamento no topo. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(0);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === "bad" ? 6000 : 3500);
  }, []);
  const busyApi = useMemo(() => ({ begin: () => setBusy((n) => n + 1), end: () => setBusy((n) => Math.max(0, n - 1)) }), []);
  return (
    <ToastCtx.Provider value={push}>
      <BusyCtx.Provider value={busyApi}>
        {children}
        {busy > 0 && (
          <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium shadow-lg">
              <Spinner size={16} className="text-accent" /> Carregando…
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
