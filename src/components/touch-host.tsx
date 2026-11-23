"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Mail, MessageCircle, Phone, X } from "lucide-react";
import { useToast } from "@/components/toast";
import { CHANNELS, outcomeOf, type Outcome, type TouchChannel } from "@/config/touches";
import { fmtPhone } from "@/lib/format";
import { announceDone, type TouchHint, type TouchOpen } from "@/lib/touch-bus";
import { dropTouchAction, myOpenTouchesAction, resolveTouchAction, touchContextAction } from "@/modules/touches/actions";

type Item = TouchOpen & { company: string | null; people: { id: number; name: string; role: string | null }[]; linkedId: number | null; hint: TouchHint | null };
const ICON: Record<TouchChannel, typeof Phone> = { call: Phone, whatsapp: MessageCircle, email: Mail };
const TONE: Record<Outcome["tone"], string> = {
  ok: "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20", info: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
  warn: "border-warn/40 bg-warn/10 text-warn hover:bg-warn/20", bad: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const show = (channel: TouchChannel, target: string) => (channel === "email" ? target : fmtPhone(target));

/**
 * Pergunta como foi cada ligação, WhatsApp e e-mail: aparece sozinho depois do clique e fica guardado
 * (se a pessoa fechar, volta na próxima visita). Cada resposta vira um registro daquele número/e-mail.
 */
export function TouchHost() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<{ id: number; outcome: Outcome } | null>(null);
  const [who, setWho] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const add = useCallback(async (t: TouchOpen & { company?: string | null }) => {
    const ctx = await touchContextAction(t.leadId, t.channel, t.target).catch(() => ({ people: [], linkedId: null }));
    setItems((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, { ...t, company: t.company ?? t.label, people: ctx.people, linkedId: t.personId ?? ctx.linkedId, hint: t.hint ?? null }]));
  }, []);

  useEffect(() => {
    let off = false;
    myOpenTouchesAction().then((rows) => { if (!off) rows.forEach((r) => void add({ id: r.id, leadId: r.leadId, channel: r.channel, target: r.target, label: r.company, company: r.company, personId: r.personId })); }).catch(() => {});
    const open = (e: Event) => void add((e as CustomEvent<TouchOpen>).detail);
    const hint = (e: Event) => { const h = (e as CustomEvent<TouchHint>).detail; setItems((cur) => cur.map((x) => (x.id === h.id ? { ...x, hint: h } : x))); };
    window.addEventListener("fey:touch-open", open); window.addEventListener("fey:touch-hint", hint);
    return () => { off = true; window.removeEventListener("fey:touch-open", open); window.removeEventListener("fey:touch-hint", hint); };
  }, [add]);

  const close = (id: number) => { setItems((c) => c.filter((x) => x.id !== id)); if (picked?.id === id) setPicked(null); };
  async function save(it: Item, o: Outcome, personId: number | null) {
    setBusy(true);
    const r = await resolveTouchAction({ id: it.id, outcome: o.key, personId, note: note || null, durationSec: it.hint?.durationSec ?? null, retryDays: retry || null }).catch(() => ({ ok: false, message: "Não foi possível salvar." }));
    setBusy(false);
    if (!r.ok) { toast("bad", r.message ?? "Não foi possível salvar."); return; }
    toast("ok", o.wrong ? `${CHANNELS[it.channel].label} registrada. ${it.channel === "email" ? "E-mail" : "Número"} marcado como inválido.` : `${CHANNELS[it.channel].label} registrada: ${o.label}.`);
    announceDone({ id: it.id, leadId: it.leadId, channel: it.channel, target: it.target, outcome: o.key });
    setNote(""); setRetry(0); setWho(null); close(it.id);
  }
  function choose(it: Item, o: Outcome) {
    if (o.reached && it.people.length) { setPicked({ id: it.id, outcome: o }); setWho(it.linkedId); return; }
    void save(it, o, it.linkedId);
  }

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[62] flex w-[min(23rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite">
      {items.slice(0, 3).map((it) => {
        const Icon = ICON[it.channel], cfg = CHANNELS[it.channel];
        const sel = picked?.id === it.id ? picked.outcome : null;
        const suggest = it.hint ? (it.hint.answered ? "atendeu" : it.channel === "call" ? "nao_atendeu" : null) : null;
        return (
          <section key={it.id} className="card-in pointer-events-auto overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" role="dialog" aria-label={cfg.question}>
            <header className="flex items-start gap-3 border-b border-line/70 bg-sunk/50 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-grad text-on-accent"><Icon size={17} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{cfg.question}</p>
                <p className="truncate text-xs text-muted">{cfg.label} para <b className="text-ink">{show(it.channel, it.target)}</b>{it.company ? <> · <Link href={`/leads/${it.leadId}`} className="hover:text-accent">{it.company}</Link></> : null}</p>
                {it.hint && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-accent"><Clock size={11} aria-hidden /> VocallPhone: {it.hint.answered ? "foi atendida" : "não foi atendida"}{it.hint.durationSec ? ` · ${mmss(it.hint.durationSec)}` : ""}</p>}
              </div>
              <button type="button" aria-label="Responder depois" title="Responder depois" onClick={() => setItems((c) => c.filter((x) => x.id !== it.id))} className="rounded-lg p-1.5 text-muted hover:bg-sunk hover:text-ink"><X size={16} aria-hidden /></button>
            </header>
            {!sel ? (
              <div className="space-y-2.5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  {cfg.outcomes.map((o) => (
                    <button key={o.key} type="button" disabled={busy} title={o.hint} onClick={() => choose(it, o)} className={`min-h-11 rounded-xl border px-2.5 py-2 text-left text-[13px] font-semibold leading-tight transition disabled:opacity-60 ${TONE[o.tone]} ${suggest === o.key ? "ring-2 ring-accent" : ""}`}>{o.label}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5">Tentar de novo:{[[0, "não"], [1, "amanhã"], [3, "em 3 dias"]].map(([d, l]) => <button key={d} type="button" onClick={() => setRetry(d as number)} className={`rounded-full border px-2 py-0.5 font-semibold ${retry === d ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{l}</button>)}</span>
                  <button type="button" onClick={() => { void dropTouchAction(it.id); close(it.id); }} className="underline hover:text-ink">Não fiz</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 p-3">
                <p className="text-sm font-semibold">{sel.label}. Com quem?</p>
                <div className="flex flex-wrap gap-1.5">
                  {it.people.map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} onClick={() => setWho(p.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${who === p.id ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{p.name}{p.role ? <span className="font-normal text-muted"> · {p.role}</span> : null}</button>)}
                  <button type="button" aria-pressed={who === null} onClick={() => setWho(null)} className={`rounded-full border px-3 py-1.5 text-sm ${who === null ? "border-accent bg-accent/12 font-semibold text-accent" : "border-line text-muted hover:bg-sunk"}`}>Outra pessoa</button>
                </div>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Observação (opcional)" className="min-h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm focus:border-accent focus:outline-none" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => save(it, sel, who)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-grad px-4 text-sm font-semibold text-on-accent disabled:opacity-60"><Check size={15} aria-hidden /> Salvar</button>
                  <button type="button" onClick={() => setPicked(null)} className="min-h-10 rounded-lg border border-line px-3 text-sm hover:bg-sunk">Voltar</button>
                </div>
              </div>
            )}
          </section>
        );
      })}
      {items.length > 3 && <p className="pointer-events-auto rounded-full bg-panel px-3 py-1 text-center text-xs text-muted shadow">+{items.length - 3} aguardando resultado</p>}
    </div>
  );
}
