"use client";

import { AlertTriangle, Ban, BadgeCheck, Clock, Crown, Database, ExternalLink, Globe, Handshake, History, ListChecks, Mail, MailX, Map as MapIcon, MapPin, Phone, PhoneMissed, PhoneOff, RotateCcw, Shield, Smartphone, Sparkles, Store, Target, UserX, type LucideIcon , Link2 } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { listMeta } from "@/config/enrich-lists";

const ICONS: Record<string, LucideIcon> = {
  list: ListChecks, sparkles: Sparkles, target: Target, badge: BadgeCheck, handshake: Handshake, phoneoff: PhoneOff, smartphone: Smartphone, phone: Phone, mailoff: MailX,
  ban: Ban, phonemissed: PhoneMissed, userx: UserX, store: Store, mappin: MapPin, map: MapIcon, shield: Shield, globe: Globe, rotate: RotateCcw, database: Database,
  crown: Crown, history: History, alert: AlertTriangle, clock: Clock, mail: Mail, link: Link2,
};
export const enrichIcon = (name: string): LucideIcon => ICONS[name] ?? ListChecks;
export const listVisual = (key: string) => { const m = listMeta(key); return { I: enrichIcon(m?.icon ?? "list"), hex: m?.hex ?? "#6366f1", label: m?.label ?? key, hint: m?.hint ?? "" }; };
export const tint = (hex: string, a = 20, b = 5) => `linear-gradient(145deg, color-mix(in srgb, ${hex} ${a}%, var(--panel)), color-mix(in srgb, ${hex} ${b}%, var(--panel)) 70%)`;
export const iconTile = (hex: string) => `linear-gradient(135deg, ${hex}, color-mix(in srgb, ${hex} 62%, #000))`;

/** Nome da empresa que leva direto ao lead (abre na mesma aba; Ctrl/⌘+clique abre em outra). */
export function LeadLink({ id, children, className = "", title }: { id: number; children: ReactNode; className?: string; title?: string }) {
  return (
    <Link href={`/leads/${id}`} title={title ?? "Abrir o lead"} className={`group/lead inline-flex min-w-0 items-center gap-1 font-semibold text-ink underline-offset-2 hover:text-accent hover:underline ${className}`}>
      <span className="min-w-0 break-words">{children}</span><ExternalLink size={12} aria-hidden className="shrink-0 opacity-0 transition group-hover/lead:opacity-100" />
    </Link>
  );
}

/** Carta de uma fila de consulta (mesmo estilo dos objetivos do roteiro). */
export function ListChoice({ k, count, selected, onPick, disabled, compact }: { k: string; count: number; selected: boolean; onPick: () => void; disabled?: boolean; compact?: boolean }) {
  const { I, hex, label } = listVisual(k);
  return (
    <button type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={onPick}
      style={{ background: tint(hex, selected ? 30 : 16, selected ? 8 : 4), borderColor: `color-mix(in srgb, ${hex} ${selected ? 90 : 38}%, transparent)`, boxShadow: selected ? `0 8px 24px -12px ${hex}` : undefined } as CSSProperties}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 text-left transition hover:-translate-y-0.5 disabled:opacity-60 ${compact ? "p-2.5" : "p-3.5"}`}>
      <I aria-hidden size={compact ? 56 : 76} strokeWidth={1.4} className="pointer-events-none absolute -bottom-3 -right-2 -rotate-12 opacity-[.13]" style={{ color: hex }} />
      <span className={`relative grid shrink-0 place-items-center rounded-xl text-white shadow ${compact ? "size-8" : "size-10"}`} style={{ background: iconTile(hex) }}><I size={compact ? 16 : 20} aria-hidden /></span>
      <span className="relative min-w-0 flex-1"><span className={`block font-bold leading-tight ${compact ? "text-[13px]" : "text-sm"}`}>{label}</span></span>
      <span className={`figure relative shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${count ? "text-white" : "bg-sunk text-muted"}`} style={count ? { background: hex } : undefined}>{count.toLocaleString("pt-BR")}</span>
    </button>
  );
}

export const StatusChip = ({ s }: { s: string | null }) => s ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.toUpperCase().startsWith("ATIV") ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{s}</span> : null;
