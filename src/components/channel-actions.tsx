"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { callNumber } from "@/components/call-number";
import { useToast } from "@/components/toast";
import { useVocall } from "@/components/vocall-provider";
import { trackTouch } from "@/lib/touch-bus";
import { chatproUrl, fmtPhone } from "@/lib/format";

type LeadRef = { id: number; eoxUrl: string | null; eoxInfo?: Record<string, string> | null };

/** Um telefone com os dois jeitos de falar: ligar (VocallPhone) e WhatsApp. Cada clique vira um registro e o resultado é perguntado depois. */
export function PhoneActions({ lead, value, label, personId }: { lead: LeadRef; value: string; label: string; personId?: number | null }) {
  const toast = useToast();
  const vocall = useVocall();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="figure font-medium">{fmtPhone(value)}</span>
      <button type="button" disabled={vocall.configured && vocall.ready === false} onClick={() => void callNumber(value.replace(/\D/g, ""), label, toast, vocall, lead, personId ?? null)} className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-xs font-semibold text-accent hover:brightness-110"><Phone size={12} aria-hidden /> Ligar</button>
      <a href={chatproUrl(value)} target="_blank" rel="noreferrer" onClick={() => void trackTouch({ leadId: lead.id, channel: "whatsapp", target: value, label, personId: personId ?? null })} className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok hover:brightness-110"><MessageCircle size={12} aria-hidden /> WhatsApp</a>
    </span>
  );
}

export function MailAction({ leadId, email, label }: { leadId: number; email: string; label: string }) {
  return (
    <a href={`mailto:${email}`} onClick={() => void trackTouch({ leadId, channel: "email", target: email, label })} className="inline-flex min-w-0 items-center gap-2 hover:text-accent"><Mail size={14} className="shrink-0 text-muted" aria-hidden /><span className="truncate">{email}</span></a>
  );
}
