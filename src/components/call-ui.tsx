"use client";

import { useEffect, useState } from "react";

export function Timer({ since, endedAt }: { since: number; endedAt?: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    if (endedAt) return;
    setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t);
  }, [endedAt]);
  const s = Math.max(0, Math.floor(((endedAt ?? now) - since) / 1000));
  return <span className="figure text-lg font-bold tabular-nums">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

/** O VocallAgent chama de "Atendido" o que, para o time, é "Em chamada". */
export const estadoLabel = (estado: string | null, ended: boolean) => (ended ? (estado === "Finalizado" || !estado ? "Ligação encerrada" : estado) : /^atendid/i.test(estado ?? "") ? "Em chamada" : (estado ?? "Em ligação"));

