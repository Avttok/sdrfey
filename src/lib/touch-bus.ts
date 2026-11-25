"use client";

import { useEffect, useState } from "react";
import { dropTouchAction, myOpenTouchesAction, startTouchAction } from "@/modules/touches/actions";
import type { TouchChannel } from "@/config/touches";

/**
 * Registro dos contatos (ligação, WhatsApp, e-mail) que esperam a pessoa dizer como foi.
 * Qualquer botão chama trackTouch(). Quem mostra a pergunta é o TouchPrompt, e só dentro da etapa do shuffler
 * que corresponde ao canal (e-mail na etapa E-mail, WhatsApp na etapa WhatsApp, ligação na etapa Ligação).
 *
 * Com `defer`, o registro nasce na hora, mas a pergunta só é liberada ao apertar Avançar, ao ligar/desligar a tag
 * do canal (flushTouches) ou, na ligação pelo VocallPhone, quando a chamada termina.
 */
export type TouchHint = { id: number; answered: boolean; durationSec: number | null };
export type TouchItem = { id: number; leadId: number; channel: TouchChannel; target: string; label: string | null; personId: number | null; hint: TouchHint | null; released: boolean; waitEnd: boolean };
/** Avisado quando a pessoa responde uma pergunta: a tela do atendimento acende a tag do canal só quando todos os contatos foram feitos. */
export type TouchDone = { id: number; leadId: number; channel: TouchChannel; target: string; outcome: string };
export type TouchScope = { leadId: number; channels: TouchChannel[] };

const items = new Map<number, TouchItem>();
let scope: TouchScope | null = null;
let lastCall: TouchItem | null = null;
const listeners = new Set<() => void>();
const changed = () => { listeners.forEach((f) => f()); window.dispatchEvent(new Event("fey:touch-change")); };

export async function trackTouch(input: { leadId: number; channel: TouchChannel; target: string; label?: string | null; personId?: number | null; runId?: string | null; /** Segura a pergunta (veja acima). */ defer?: boolean; /** Ligação pelo VocallPhone: a pergunta só sai quando a chamada acaba. */ waitEnd?: boolean }): Promise<number | null> {
  try {
    const r = await startTouchAction({ leadId: input.leadId, channel: input.channel, target: input.target, personId: input.personId ?? null, runId: input.runId ?? null });
    if (!r.ok) return null;
    const t: TouchItem = { id: r.id, leadId: input.leadId, channel: input.channel, target: input.target, label: input.label ?? null, personId: input.personId ?? null, hint: null, released: !input.defer, waitEnd: !!input.waitEnd };
    replaceOlder(t);
    items.set(t.id, t);
    if (input.channel === "call") lastCall = t;
    changed();
    return r.id;
  } catch { return null; }
}

/** Um contato novo para o mesmo número/e-mail substitui os antigos sem resposta (não acumula). */
function replaceOlder(t: TouchItem): void {
  const norm = (x: TouchItem) => (x.channel === "email" ? x.target.trim().toLowerCase() : x.target.replace(/\D/g, ""));
  for (const o of [...items.values()]) if (o.id !== t.id && o.leadId === t.leadId && o.channel === t.channel && norm(o) === norm(t)) { void dropTouchAction(o.id); items.delete(o.id); }
}

/** Libera as perguntas que estavam na fila daquele lead (e canal). Ligação em andamento só sai com `force`. */
export function flushTouches(leadId: number, channel?: TouchChannel, force = false): number {
  let n = 0;
  for (const t of items.values()) {
    if (t.leadId !== leadId || (channel && t.channel !== channel) || t.released || (t.waitEnd && !force)) continue;
    t.released = true; n++;
  }
  if (n) changed();
  return n;
}

/** Quantos contatos do lead (e canal) ainda esperam resposta, liberados ou não. */
export const pendingTouches = (leadId: number, channel?: TouchChannel): number => [...items.values()].filter((t) => t.leadId === leadId && (!channel || t.channel === channel)).length;

/** O VocallPhone avisa como a ligação terminou: a pergunta da ligação é liberada, já sugerindo o resultado. */
export function hintLastCall(answered: boolean, durationSec: number | null): void {
  const t = lastCall && items.get(lastCall.id);
  if (!t) return;
  t.hint = { id: t.id, answered, durationSec }; t.released = true; t.waitEnd = false;
  changed();
}
export const lastCallTouch = (): number | null => lastCall?.id ?? null;

/** Tira o contato da fila (respondido ou pulado). Pular apaga o registro. */
export function settleTouch(id: number, skipped: boolean): void {
  if (skipped) void dropTouchAction(id);
  if (items.delete(id)) changed();
}
export function announceDone(d: TouchDone): void {
  window.dispatchEvent(new CustomEvent<TouchDone>("fey:touch-done", { detail: d }));
}

/** Perguntas que podem aparecer agora: liberadas e dentro da etapa atual do shuffler. */
export function visibleTouches(): TouchItem[] {
  if (!scope) return [];
  return [...items.values()].filter((t) => t.released && t.leadId === scope!.leadId && scope!.channels.includes(t.channel)).sort((a, b) => a.id - b.id);
}

/** Carrega os contatos que ficaram sem resposta deste lead (de antes de recarregar a tela). Repetidos viram um só. */
async function loadOpen(leadId: number): Promise<void> {
  const rows = await myOpenTouchesAction().catch(() => []);
  for (const r of rows.filter((x) => x.leadId === leadId).sort((a, b) => a.id - b.id)) {
    if (items.has(r.id)) continue;
    const t: TouchItem = { id: r.id, leadId, channel: r.channel, target: r.target, label: r.company, personId: r.personId, hint: null, released: true, waitEnd: false };
    replaceOlder(t);
    items.set(r.id, t);
  }
  changed();
}

/**
 * A etapa do shuffler diz ao painel de resultado de qual lead e de quais canais ele pode perguntar.
 * Fora dos shufflers (scope vazio) nenhuma pergunta aparece.
 */
export function useTouchScope(leadId: number | null, channels: TouchChannel[]): void {
  const key = channels.join(",");
  useEffect(() => { if (leadId != null) void loadOpen(leadId); }, [leadId]);
  useEffect(() => {
    scope = leadId == null ? null : { leadId, channels: key ? (key.split(",") as TouchChannel[]) : [] };
    changed();
    return () => { scope = null; changed(); };
  }, [leadId, key]);
}

/** Lista as perguntas visíveis e atualiza quando algo muda. */
export function useVisibleTouches(): TouchItem[] {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return visibleTouches();
}

/** O contato ainda sem resposta (o mais novo) para este e-mail/número, se houver. */
export function touchFor(leadId: number, channel: TouchChannel, target: string): TouchItem | null {
  const key = (x: string) => (channel === "email" ? x.trim().toLowerCase() : x.replace(/\D/g, "").slice(-8));
  return [...items.values()].filter((t) => t.leadId === leadId && t.channel === channel && key(t.target) === key(target)).sort((a, b) => b.id - a.id)[0] ?? null;
}
/** Faz a tela redesenhar quando a fila de contatos muda (ex.: o VocallPhone sugeriu o resultado da ligação). */
export function useTouchVersion(): number {
  const [n, setN] = useState(0);
  useEffect(() => { const f = () => setN((v) => v + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return n;
}
