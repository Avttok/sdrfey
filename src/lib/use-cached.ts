"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "sdrfey:c:";

/** Lê/grava no navegador sem quebrar quando o armazenamento está bloqueado. */
export const lsGet = <T,>(key: string): T | null => { try { const v = localStorage.getItem(PREFIX + key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
export const lsSet = (key: string, v: unknown) => { try { localStorage.setItem(PREFIX + key, JSON.stringify(v)); } catch {} };

/**
 * "Mostra o que já tem, atualiza por trás": devolve na hora a cópia guardada neste navegador (se houver)
 * e busca a versão nova em seguida. `key` deve incluir o id da pessoa para contas diferentes não se misturarem.
 */
export function useCached<T>(key: string, fetcher: () => Promise<T | null | undefined>): [T | null, (v: T) => void, boolean] {
  const [data, setData] = useState<T | null>(null);
  const [fresh, setFresh] = useState(false);
  const f = useRef(fetcher); f.current = fetcher;
  useEffect(() => {
    let live = true;
    const cached = lsGet<T>(key);
    if (cached) setData(cached);
    void f.current().then((v) => { if (!live) return; if (v) { setData(v); lsSet(key, v); } setFresh(true); }).catch(() => live && setFresh(true));
    return () => { live = false; };
  }, [key]);
  const set = useCallback((v: T) => { setData(v); lsSet(key, v); }, [key]);
  return [data, set, fresh];
}
