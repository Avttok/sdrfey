"use client";

import { startTouchAction } from "@/modules/touches/actions";
import type { TouchChannel } from "@/config/touches";

/**
 * Ponte entre qualquer botão (Ligar, WhatsApp, e-mail) e o painel que pergunta o resultado.
 * O botão só chama trackTouch(); o painel (TouchHost, no layout) escuta o evento e aparece.
 *
 * Com `defer`, o registro nasce na hora, mas a pergunta fica na fila: sai quando a ligação termina,
 * quando a pessoa aperta Avançar ou liga/desliga a tag do canal (flushTouches).
 */
export type TouchOpen = { id: number; leadId: number; channel: TouchChannel; target: string; label: string | null; personId: number | null; hint?: TouchHint | null };
export type TouchHint = { id: number; answered: boolean; durationSec: number | null };
/** Avisado quando a pessoa responde uma pergunta: a tela do atendimento acende a tag do canal só quando todos os contatos foram feitos. */
export type TouchDone = { id: number; leadId: number; channel: TouchChannel; target: string; outcome: string };

type Queued = TouchOpen & { waitEnd: boolean };
const queue: Queued[] = [];
let lastCall: Queued | null = null;
let lastCallShown = true;

const open = (t: TouchOpen) => window.dispatchEvent(new CustomEvent<TouchOpen>("fey:touch-open", { detail: t }));

export async function trackTouch(input: { leadId: number; channel: TouchChannel; target: string; label?: string | null; personId?: number | null; runId?: string | null; /** Segura a pergunta (veja acima). */ defer?: boolean; /** Ligação pelo VocallPhone: a pergunta só sai quando a chamada acaba. */ waitEnd?: boolean }): Promise<number | null> {
  try {
    const r = await startTouchAction({ leadId: input.leadId, channel: input.channel, target: input.target, personId: input.personId ?? null, runId: input.runId ?? null });
    if (!r.ok) return null;
    const t: Queued = { id: r.id, leadId: input.leadId, channel: input.channel, target: input.target, label: input.label ?? null, personId: input.personId ?? null, waitEnd: !!input.waitEnd };
    if (input.channel === "call") { lastCall = t; lastCallShown = !input.defer; }
    if (input.defer) queue.push(t); else open(t);
    return r.id;
  } catch { return null; }
}

/**
 * Mostra as perguntas que estavam na fila daquele lead (e canal, se informado).
 * Ligação em andamento só sai com `force` (quando a pessoa pede de propósito, pela tag).
 */
export function flushTouches(leadId: number, channel?: TouchChannel, force = false): number {
  let n = 0;
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (q.leadId !== leadId || (channel && q.channel !== channel) || (q.waitEnd && !force)) continue;
    queue.splice(i, 1); n++;
    open(q);
  }
  return n;
}

/** Quantas perguntas esperam na fila (do lead e canal). */
export const queuedTouches = (leadId: number, channel?: TouchChannel): number => queue.filter((q) => q.leadId === leadId && (!channel || q.channel === channel)).length;

/** O VocallPhone avisa como a ligação terminou: a pergunta da ligação sai agora, já sugerindo o resultado. */
export function hintLastCall(answered: boolean, durationSec: number | null): void {
  const t = lastCall;
  if (!t) return;
  const hint: TouchHint = { id: t.id, answered, durationSec };
  const i = queue.findIndex((q) => q.id === t.id);
  if (i >= 0) { queue.splice(i, 1); open({ ...t, hint }); lastCallShown = true; return; }
  window.dispatchEvent(new CustomEvent<TouchHint>("fey:touch-hint", { detail: hint }));
}
export const lastCallTouch = (): number | null => lastCall?.id ?? null;
export const lastCallPending = (): boolean => !lastCallShown;

export function announceDone(d: TouchDone): void {
  window.dispatchEvent(new CustomEvent<TouchDone>("fey:touch-done", { detail: d }));
}
