"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { outcomeLabel, outcomeOf, type TargetStat, type TouchChannel, type TouchRow } from "@/config/touches";
import { fmtDateTime, fmtPhone } from "@/lib/format";

const ICON: Record<TouchChannel, typeof Phone> = { call: Phone, whatsapp: MessageCircle, email: Mail };
const TONE = { ok: "bg-ok/15 text-ok", info: "bg-accent/12 text-accent", warn: "bg-warn/15 text-warn", bad: "bg-danger/15 text-danger" } as const;
export const showTarget = (channel: TouchChannel, target: string) => (channel === "email" ? target : fmtPhone(target));

/** Selo pequeno com o resultado de um contato. */
export function OutcomeChip({ channel, outcome }: { channel: TouchChannel; outcome: string | null }) {
  const o = outcomeOf(channel, outcome);
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o ? TONE[o.tone] : "bg-sunk text-muted"}`}>{outcomeLabel(channel, outcome)}</span>;
}

/** "3 tentativas · última: não atendeu" para um número ou e-mail. */
export function StatLine({ stat }: { stat: TargetStat | undefined }) {
  if (!stat) return null;
  return <span className="text-[11px] text-muted">{{ call: "Ligações", whatsapp: "WhatsApp", email: "E-mails" }[stat.channel]}: {stat.attempts}× · {outcomeLabel(stat.channel, stat.lastOutcome).toLowerCase()}{stat.reached ? ` · ${stat.reached} com resposta` : ""}</span>;
}

/** Linha do tempo de todos os contatos do lead, por número/e-mail. */
export function TouchTimeline({ rows }: { rows: TouchRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted">Nenhuma ligação, WhatsApp ou e-mail registrado ainda. Cada vez que alguém liga ou envia por aqui, o resultado fica guardado.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const Icon = ICON[r.channel];
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-sunk px-3 py-2 text-sm">
            <Icon size={15} className="shrink-0 text-muted" aria-hidden />
            <span className="figure font-medium">{showTarget(r.channel, r.target)}</span>
            <OutcomeChip channel={r.channel} outcome={r.outcome} />
            {r.personName && <span className="text-xs text-muted">com {r.personName}</span>}
            {r.durationSec ? <span className="text-xs text-muted">{Math.floor(r.durationSec / 60)}min{String(r.durationSec % 60).padStart(2, "0")}s</span> : null}
            <span className="ml-auto text-xs text-muted">{r.userName ? `${r.userName.split(" ")[0]} · ` : ""}{fmtDateTime(r.at)}</span>
            {r.note && <p className="basis-full text-xs text-muted">“{r.note}”</p>}
          </li>
        );
      })}
    </ul>
  );
}
