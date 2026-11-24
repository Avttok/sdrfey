"use client";

import { Check, Clock, Loader2, Mail, MessageCircle, Phone, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { CHANNELS, type Outcome, type TouchChannel } from "@/config/touches";
import { fmtPhone } from "@/lib/format";
import { announceDone, settleTouch, useVisibleTouches, type TouchItem } from "@/lib/touch-bus";
import { resolveTouchAction, touchContextAction } from "@/modules/touches/actions";

type Ctx = { people: { id: number; name: string; role: string | null }[]; linkedId: number | null };
type Pick = { outcome: string; personId: number | null };
const ICON: Record<TouchChannel, typeof Phone> = { call: Phone, whatsapp: MessageCircle, email: Mail };
const TONE: Record<Outcome["tone"], string> = {
  ok: "border-ok/40 text-ok hover:bg-ok/15", info: "border-accent/40 text-accent hover:bg-accent/15",
  warn: "border-warn/40 text-warn hover:bg-warn/15", bad: "border-danger/40 text-danger hover:bg-danger/15",
};
const ON: Record<Outcome["tone"], string> = { ok: "bg-ok text-white border-ok", info: "bg-accent text-on-accent border-accent", warn: "bg-warn text-white border-warn", bad: "bg-danger text-white border-danger" };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const show = (channel: TouchChannel, target: string) => (channel === "email" ? target : fmtPhone(target));
const PLURAL: Record<TouchChannel, string> = { call: "ligações", whatsapp: "WhatsApps", email: "e-mails" };

/**
 * Popup "Como foi?" do atendimento. Só existe dentro das etapas do shuffler (E-mail, WhatsApp, Ligação): a etapa diz
 * de qual lead e canal ele pode perguntar (useTouchScope). Junta todos os contatos do canal numa lista só: a pessoa marca o resultado
 * de cada um e envia tudo de uma vez. Responder ou pular tira da fila de vez.
 */
export function TouchHost() {
  const toast = useToast();
  const list = useVisibleTouches();
  const [ctx, setCtx] = useState<Record<number, Ctx>>({});
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);

  const key = list.map((t) => t.id).join(",");
  useEffect(() => {
    for (const t of list) {
      if (ctx[t.id]) continue;
      touchContextAction(t.leadId, t.channel, t.target)
        .then((c) => setCtx((m) => ({ ...m, [t.id]: c })))
        .catch(() => setCtx((m) => ({ ...m, [t.id]: { people: [], linkedId: null } })));
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!list.length) { setPicks({}); setRetry(0); } }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = list.some((t) => !ctx[t.id]);
  const mixed = useMemo(() => new Set(list.map((t) => t.channel)).size > 1, [list]);
  if (!list.length) return null;
  const first = list[0];
  const title = mixed ? "Como foram os contatos?" : list.length > 1 ? `Como foram os ${PLURAL[first.channel]}?` : CHANNELS[first.channel].question;
  const ready = list.every((t) => picks[t.id]?.outcome);
  const pending = list.filter((t) => !picks[t.id]?.outcome).length;

  const choose = (t: TouchItem, o: Outcome) => {
    const c = ctx[t.id] ?? { people: [], linkedId: null };
    setPicks((p) => ({ ...p, [t.id]: { outcome: o.key, personId: p[t.id]?.personId ?? t.personId ?? c.linkedId } }));
  };

  async function sendAll() {
    setBusy(true);
    const results = await Promise.all(list.map(async (t) => {
      const p = picks[t.id];
      if (!p) return false;
      const r = await resolveTouchAction({ id: t.id, outcome: p.outcome, personId: p.personId, note: null, durationSec: t.hint?.durationSec ?? null, retryDays: retry || null }).catch(() => ({ ok: false }));
      if (r.ok) { announceDone({ id: t.id, leadId: t.leadId, channel: t.channel, target: t.target, outcome: p.outcome }); settleTouch(t.id, false); }
      return r.ok;
    }));
    setBusy(false);
    const ok = results.filter(Boolean).length;
    if (ok === results.length) toast("ok", ok > 1 ? `${ok} contatos registrados.` : "Contato registrado.");
    else toast("bad", `${ok} de ${results.length} registrados. Tente enviar de novo os que faltam.`);
  }

  return (
    <>
      <div className="fixed inset-0 z-[61] bg-black/25" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 top-0 z-[62] flex items-end justify-center px-4 pb-24 max-lg:pb-28" aria-live="polite">
        <section role="dialog" aria-modal="true" aria-label={title} className="card-in pointer-events-auto relative flex max-h-[min(36rem,calc(100dvh-8rem))] w-full max-w-[34rem] flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl ring-1 ring-black/5">
          <header className="flex items-center gap-3 bg-grad px-4 py-3 text-on-accent">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/20">{(() => { const I = mixed ? Check : ICON[first.channel]; return <I size={19} aria-hidden />; })()}</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold leading-tight">{title}</p>
              <p className="truncate text-sm opacity-90">{first.label ?? ""}{list.length > 1 ? `${first.label ? " · " : ""}${list.length} contatos` : ""}</p>
            </div>
          </header>

          <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
            {list.map((t) => {
              const cfg = CHANNELS[t.channel], Icon = ICON[t.channel];
              const pk = picks[t.id];
              const sel = pk ? cfg.outcomes.find((o) => o.key === pk.outcome) : null;
              const people = ctx[t.id]?.people ?? [];
              const suggest = t.hint ? (t.hint.answered ? "atendeu" : t.channel === "call" ? "nao_atendeu" : null) : null;
              return (
                <li key={t.id} className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className="shrink-0 text-muted" aria-hidden />
                    <span className="figure min-w-0 flex-1 truncate font-bold">{show(t.channel, t.target)}</span>
                    {t.hint && <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent"><Clock size={11} aria-hidden /> {t.hint.answered ? "atendida" : "não atendida"}{t.hint.durationSec ? ` · ${mmss(t.hint.durationSec)}` : ""}</span>}
                    <button type="button" disabled={busy} onClick={() => settleTouch(t.id, true)} title="Pular este contato (não registra)" className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-sunk hover:text-ink"><SkipForward size={13} aria-hidden /> Pular</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Resultado de ${show(t.channel, t.target)}`}>
                    {cfg.outcomes.map((o) => (
                      <button key={o.key} type="button" role="radio" aria-checked={pk?.outcome === o.key} disabled={busy} title={o.hint} onClick={() => choose(t, o)}
                        className={`min-h-10 rounded-xl border px-3 text-[13px] font-bold leading-tight transition active:scale-[0.97] ${pk?.outcome === o.key ? ON[o.tone] : `bg-transparent ${TONE[o.tone]}`} ${suggest === o.key && pk?.outcome !== o.key ? "ring-2 ring-accent" : ""}`}>{o.label}</button>
                    ))}
                  </div>
                  {sel?.reached && people.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold text-muted">Com quem?</span>
                      {people.map((p) => <button key={p.id} type="button" aria-pressed={pk?.personId === p.id} onClick={() => setPicks((m) => ({ ...m, [t.id]: { ...m[t.id], personId: p.id } }))} className={`rounded-full border px-2.5 py-1 font-semibold ${pk?.personId === p.id ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{p.name}{p.role ? <span className="font-normal text-muted"> · {p.role}</span> : null}</button>)}
                      <button type="button" aria-pressed={pk?.personId == null} onClick={() => setPicks((m) => ({ ...m, [t.id]: { ...m[t.id], personId: null } }))} className={`rounded-full border px-2.5 py-1 ${pk?.personId == null ? "border-accent bg-accent/12 font-semibold text-accent" : "border-line text-muted hover:bg-sunk"}`}>Outra pessoa</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-panel p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted">Tentar de novo:{[[0, "não"], [1, "amanhã"], [3, "em 3 dias"]].map(([d, l]) => <button key={d} type="button" onClick={() => setRetry(d as number)} className={`rounded-full border px-2.5 py-1 font-semibold ${retry === d ? "border-accent bg-accent/12 text-accent" : "border-line hover:bg-sunk"}`}>{l}</button>)}</span>
            <span className="flex items-center gap-2">
              {list.length > 1 && <button type="button" disabled={busy} onClick={() => list.forEach((t) => settleTouch(t.id, true))} className="min-h-10 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-sunk">Pular todos</button>}
              <button type="button" disabled={busy || !ready} onClick={() => void sendAll()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-grad px-4 text-sm font-bold text-on-accent transition active:scale-[0.98] disabled:opacity-50"><Check size={16} aria-hidden /> {ready ? (list.length > 1 ? `Enviar tudo (${list.length})` : "Salvar") : `Faltam ${pending}`}</button>
            </span>
          </footer>

          {(busy || loading) && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-panel/70 backdrop-blur-sm" role="status" aria-live="polite">
              <span className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-2 text-sm font-bold shadow-lg ring-1 ring-line"><Loader2 size={16} className="animate-spin text-accent" aria-hidden /> Carregando…</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
