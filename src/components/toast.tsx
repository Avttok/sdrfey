"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Kind = "ok" | "info" | "warn" | "bad";
type Item = { id: number; kind: Kind; text: string };

const ToastCtx = createContext<(kind: Kind, text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const STYLE: Record<Kind, { color: string; Icon: typeof Info }> = {
  ok: { color: "#1D9E75", Icon: CheckCircle2 },
  info: { color: "#378ADD", Icon: Info },
  warn: { color: "#EF9F27", Icon: AlertTriangle },
  bad: { color: "#E24B4A", Icon: XCircle },
};

/** Avisos fixos embaixo, centralizados, sempre visíveis (máx. 3 ao mesmo tempo). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === "bad" ? 6000 : 3500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4">
        {items.map(({ id, kind, text }) => {
          const { color, Icon } = STYLE[kind];
          return (
            <div
              key={id}
              role={kind === "bad" ? "alert" : "status"}
              className="pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg"
              style={{ background: `color-mix(in srgb, ${color} 14%, var(--panel))`, borderColor: `color-mix(in srgb, ${color} 55%, transparent)` }}
            >
              <Icon size={18} style={{ color }} aria-hidden />
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
