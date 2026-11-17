import { BellRing, Clock, UserPlus } from "lucide-react";
import { STAGE_META } from "@/config/deals";
import type { DealStage } from "@/db/schema";
import type { DealAlert } from "@/modules/deals/queries";

export function StageChip({ stage }: { stage: DealStage }) {
  const m = STAGE_META[stage];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: `color-mix(in srgb, ${m.color} 70%, var(--ink))` }}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: m.color }} />{m.label}
    </span>
  );
}

const TONE = { danger: "bg-danger/12 text-danger", warn: "bg-warn/15 text-warn", info: "bg-accent/12 text-accent" } as const;

export function AlertChip({ a }: { a: DealAlert }) {
  const Icon = a.kind === "pool" ? UserPlus : a.kind === "cobrar" || a.kind === "parado" ? Clock : BellRing;
  return <span className={`inline-flex items-start gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold leading-tight ${TONE[a.tone]}`}><Icon size={12} aria-hidden className="mt-px shrink-0" />{a.text}</span>;
}
