"use client";

import { Check, Clock, Mail, MessageCircle, Phone, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { CHANNELS, outcomeOf, type Outcome, type TouchChannel } from "@/config/touches";
import { fmtPhone } from "@/lib/format";
import { announceDone, settleTouch, useVisibleTouches } from "@/lib/touch-bus";
import { resolveTouchAction, touchContextAction } from "@/modules/touches/actions";

type Ctx = { people: { id: number; name: string; role: string | null }[]; linkedId: number | null };
const ICON: Record<TouchChannel, typeof Phone> = { call: Phone, whatsapp: MessageCircle, email: Mail };
const TONE: Record<Outcome["tone"], string> = {
  ok: "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20", info: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
  warn: "border-warn/40 bg-warn/10 text-warn hover:bg-warn/20", bad: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const show = (channel: TouchChannel, target: string) => (channel === "email" ? target : fmtPhone(target));

/**
 * Popup "Como foi?" do atendimento. Só existe dentro das etapas do shuffler (E-mail, WhatsApp, Ligação): a etapa diz
 * de qual lead e canal ele pode perguntar (useTouchScope). Mostra um contato por vez; responder ou pular tira da fila de vez.
 */
export function TouchHost() {
  const toast = useToast();
  const list = useVisibleTouches();
  const cur = list[0] ?? null;
  const [ctx, setCtx] = useState<Record<number, Ctx>>({});
  const [picked, setPicked] = useState<Outcome | null>(null);
  const [who, setWho] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const curId = cur?.id ?? null;

  useEffect(() => { setPicked(null); setWho(null); setRetry(0); setNote(""); }, [curId]);
  useEffect(() => {
    if (!cur || ctx[cur.id]) return;
    let off = false;
    touchContextAction(cur.leadId, cur.channel, cur.target).then((c) => { if (!off) setCtx((m) => ({ ...m, [cur.id]: c })); }).catch(() => { if (!off) setCtx((m) => ({ ...m, [cur.id]: { people: [], linkedId: null } })); });
    return () => { off = true; };
  }, [cur, ctx]);

  if (!cur) return null;
  const c = ctx[cur.id] ?? { people: [], linkedId: null };
  const linked = cur.personId ?? c.linkedId;
  const cfg = CHANNELS[cur.channel], Icon = ICON[cur.channel];
  const suggest = cur.hint ? (cur.hint.answered ? "atendeu" : cur.channel === "call" ? "nao_atendeu" : null) : null;

  async function save(o: Outcome, personId: number | null) {
    if (!cur) return;
    setBusy(true);
    const r = await resolveTouchAction({ id: cur.id, outcome: o.key, personId, note: note || null, durationSec: cur.hint?.durationSec ?? null, retryDays: retry || null }).catch(() => ({ ok: false, message: "Não foi possível salvar." }));
    setBusy(false);
    if (!r.ok) { toast("bad", r.message ?? "Não foi possível salvar."); return; }
    toast("ok", o.wrong ? `Registrado. ${cur.channel === "email" ? "E-mail" : "Número"} marcado como inválido.` : `${cfg.label} registrada: ${o.label}.`);
    announceDone({ id: cur.id, leadId: cur.leadId, channel: cur.channel, target: cur.target, outcome: o.key });
    settleTouch(cur.id, false);
  }
  function choose(o: Outcome) {
    if (o.reached && c.people.length) { setPicked(o); setWho(linked); return; }
    void save(o, linked);
  }
  const sel = picked && outcomeOf(cur.channel, picked.key) ? picked : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[62] flex justify-center px-4 max-lg:bottom-28" aria-live="polite">
      <section key={cur.id} role="dialog" aria-label={cfg.question} className="card-in pointer-events-auto w-full max-w-[30rem] overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl ring-1 ring-black/5">
        <header className="flex items-center gap-3 bg-grad px-4 py-3 text-on-accent">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/20"><Icon size={19} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold leading-tight">{cfg.question}</p>
            <p className="truncate text-sm opacity-90">{show(cur.channel, cur.target)}{cur.label ? ` · ${cur.label}` : ""}</p>
          </div>
          {list.length > 1 && (
            <span className="flex shrink-0 items-center gap-1" aria-label={`Contato 1 de ${list.length}`} title={`${list.length} contatos para responder`}>
              {list.map((t, i) => <span key={t.id} className={`h-1.5 rounded-full bg-white ${i === 0 ? "w-5" : "w-1.5 opacity-50"}`} />)}
            </span>
          )}
        </header>
        {cur.hint && <p className="flex items-center gap-1.5 border-b border-line/70 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent"><Clock size={12} aria-hidden /> VocallPhone: {cur.hint.answered ? "foi atendida" : "não foi atendida"}{cur.hint.durationSec ? ` · ${mmss(cur.hint.durationSec)}` : ""}</p>}
        {!sel ? (
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cfg.outcomes.map((o) => (
                <button key={o.key} type="button" disabled={busy} title={o.hint} onClick={() => choose(o)} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-[13px] font-bold leading-tight transition active:scale-[0.97] disabled:opacity-60 ${TONE[o.tone]} ${suggest === o.key ? "ring-2 ring-accent" : ""}`}>{o.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-xs text-muted">
              <span className="flex items-center gap-1.5">Tentar de novo:{[[0, "não"], [1, "amanhã"], [3, "em 3 dias"]].map(([d, l]) => <button key={d} type="button" onClick={() => setRetry(d as number)} className={`rounded-full border px-2.5 py-1 font-semibold ${retry === d ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{l}</button>)}</span>
              <button type="button" onClick={() => settleTouch(cur.id, true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-semibold text-ink hover:bg-sunk"><SkipForward size={14} aria-hidden /> Pular</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <p className="text-sm font-semibold">{sel.label}. Com quem?</p>
            <div className="flex flex-wrap gap-1.5">
              {c.people.map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} onClick={() => setWho(p.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${who === p.id ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{p.name}{p.role ? <span className="font-normal text-muted"> · {p.role}</span> : null}</button>)}
              <button type="button" aria-pressed={who === null} onClick={() => setWho(null)} className={`rounded-full border px-3 py-1.5 text-sm ${who === null ? "border-accent bg-accent/12 font-semibold text-accent" : "border-line text-muted hover:bg-sunk"}`}>Outra pessoa</button>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Observação (opcional)" className="min-h-10 w-full rounded-lg border border-line bg-panel px-3 text-sm focus:border-accent focus:outline-none" />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => save(sel, who)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-grad px-4 text-sm font-bold text-on-accent disabled:opacity-60"><Check size={16} aria-hidden /> Salvar</button>
              <button type="button" onClick={() => setPicked(null)} className="min-h-11 rounded-xl border border-line px-4 text-sm hover:bg-sunk">Voltar</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
