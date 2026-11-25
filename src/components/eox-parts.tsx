"use client";

import { CheckCircle2, Mail, Phone, UserRound, XCircle } from "lucide-react";
import { EOX_LIST_BY_KEY } from "@/config/eox-lists";
import type { EoxLogRow } from "@/modules/eox/consult-daemon";
import { LeadLink, enrichIcon, iconTile, tint } from "./enrich-visual";

export const EOX_HEX = "#8b5cf6";
export const eoxVisual = (key: string) => { const m = EOX_LIST_BY_KEY.get(key); return { I: enrichIcon(m?.icon ?? "list"), hex: m?.hex ?? EOX_HEX, label: m?.label ?? key, hint: m?.hint ?? "" }; };

/** Carta de uma fila da Consulta EOX (mesmo estilo das filas do CNPJ). */
export function EoxChoice({ k, count, selected, onPick, compact }: { k: string; count: number; selected: boolean; onPick: () => void; compact?: boolean }) {
  const { I, hex, label } = eoxVisual(k);
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick}
      style={{ background: tint(hex, selected ? 30 : 16, selected ? 8 : 4), borderColor: `color-mix(in srgb, ${hex} ${selected ? 90 : 38}%, transparent)`, boxShadow: selected ? `0 8px 24px -12px ${hex}` : undefined }}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-0.5 ${compact ? "p-2.5" : "p-3.5"}`}>
      <I aria-hidden size={compact ? 56 : 76} strokeWidth={1.4} className="pointer-events-none absolute -bottom-3 -right-2 -rotate-12 opacity-[.13]" style={{ color: hex }} />
      <span className={`relative grid shrink-0 place-items-center rounded-xl text-white shadow ${compact ? "size-8" : "size-10"}`} style={{ background: iconTile(hex) }}><I size={compact ? 16 : 20} aria-hidden /></span>
      <span className={`relative min-w-0 flex-1 font-bold leading-tight ${compact ? "text-[13px]" : "text-sm"}`}>{label}</span>
      <span className={`figure relative shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${count ? "text-white" : "bg-sunk text-muted"}`} style={count ? { background: hex } : undefined}>{count.toLocaleString("pt-BR")}</span>
    </button>
  );
}

/** Resultado de uma consulta: o que a EOX trouxe de novo. */
export function EoxResult({ r }: { r: EoxLogRow }) {
  if (!r.ok) return <p className="mt-0.5 text-[11px] text-danger">{r.why ?? "Sem resposta"}</p>;
  const chip = "inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 font-medium";
  return (
    <p className="mt-1 flex flex-wrap gap-1 text-[11px]">
      <span className={chip}><Phone size={11} aria-hidden />{r.phones} novo{r.phones === 1 ? "" : "s"}</span>
      <span className={chip}><Mail size={11} aria-hidden />{r.emails} novo{r.emails === 1 ? "" : "s"}</span>
      <span className={chip}><UserRound size={11} aria-hidden />{r.people} pessoa{r.people === 1 ? "" : "s"}</span>
      {r.filled > 0 && <span className={chip}>{r.filled} campo{r.filled === 1 ? "" : "s"}</span>}
    </p>
  );
}
export const EoxIcon = ({ ok }: { ok: boolean }) => (ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />);
export { LeadLink };
