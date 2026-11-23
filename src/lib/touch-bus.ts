"use client";

import { startTouchAction } from "@/modules/touches/actions";
import type { TouchChannel } from "@/config/touches";

/**
 * Ponte entre qualquer botão (Ligar, WhatsApp, e-mail) e o painel que pergunta o resultado.
 * O botão só chama trackTouch(); o painel (TouchHost, no layout) escuta o evento e aparece.
 */
export type TouchOpen = { id: number; leadId: number; channel: TouchChannel; target: string; label: string | null; personId: number | null };
export type TouchHint = { id: number; answered: boolean; durationSec: number | null };

let lastCall: number | null = null;

export async function trackTouch(input: { leadId: number; channel: TouchChannel; target: string; label?: string | null; personId?: number | null; runId?: string | null }): Promise<number | null> {
  try {
    const r = await startTouchAction({ leadId: input.leadId, channel: input.channel, target: input.target, personId: input.personId ?? null, runId: input.runId ?? null });
    if (!r.ok) return null;
    if (input.channel === "call") lastCall = r.id;
    window.dispatchEvent(new CustomEvent<TouchOpen>("fey:touch-open", { detail: { id: r.id, leadId: input.leadId, channel: input.channel, target: input.target, label: input.label ?? null, personId: input.personId ?? null } }));
    return r.id;
  } catch { return null; }
}

/** O VocallPhone avisa como a ligação terminou, para o painel já sugerir o resultado. */
export function hintLastCall(answered: boolean, durationSec: number | null): void {
  if (lastCall == null) return;
  window.dispatchEvent(new CustomEvent<TouchHint>("fey:touch-hint", { detail: { id: lastCall, answered, durationSec } }));
}
export const lastCallTouch = (): number | null => lastCall;
