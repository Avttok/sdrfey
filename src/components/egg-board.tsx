"use client";

import { Check, Eraser, Loader2, MapPin, PenLine, Pin, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { NOTE_COLORS, NOTE_MAX, NOTE_STICKERS, noteColor, noteSticker } from "@/config/egg-board";
import { listBoardAction, removeNoteAction, saveNoteAction, type BoardNote } from "@/modules/easter/board";

const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const firstName = (n: string) => n.split(/\s+/)[0] ?? n;
const when = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "");

/** Um post-it: papel colorido com fita, alfinete, "Estive aqui", mensagem, adesivo e assinatura. */
export function Note({ n, i = 0, size = "md", fresh = false }: { n: Pick<BoardNote, "name" | "text" | "color" | "sticker"> & { at?: string; mine?: boolean }; i?: number; size?: "md" | "lg"; fresh?: boolean }) {
  const c = noteColor(n.color), S = noteSticker(n.sticker).icon;
  const rot = (rnd(i + 3, 1) - 0.5) * 9;
  const big = size === "lg";
  return (
    <div tabIndex={0} aria-label={`Post-it de ${n.name}: ${n.text}`} className={`note ${n.mine ? "note-mine" : ""} relative ${big ? "w-64 p-5 pt-7" : "w-full max-w-[13.5rem] p-4 pt-6"} aspect-square rounded-[3px] outline-none`}
      style={{ "--rot": `${rot}deg`, "--d": `${fresh ? 0.05 : Math.min(i, 18) * 0.07}s`, background: `linear-gradient(160deg, ${c.bg}, color-mix(in srgb, ${c.bg} 82%, ${c.edge}))`, color: c.ink, boxShadow: "0 14px 22px -12px rgb(0 0 0 / 0.55), 0 2px 3px rgb(0 0 0 / 0.18)" } as React.CSSProperties}>
      <span aria-hidden className="note-pin absolute left-1/2 top-1.5 grid size-5 place-items-center rounded-full shadow-md" style={{ "--d": `${fresh ? 0.05 : Math.min(i, 18) * 0.07}s`, background: `radial-gradient(circle at 35% 30%, #fff8, ${c.edge} 45%, color-mix(in srgb, ${c.edge} 60%, #000))` } as React.CSSProperties}><span className="size-1.5 rounded-full bg-black/25" /></span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-6 rounded-b-[3px]" style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.09), transparent)" }} />
      <span aria-hidden className="absolute bottom-0 right-0 size-6" style={{ background: `linear-gradient(135deg, transparent 50%, color-mix(in srgb, ${c.bg} 70%, #000) 50%)`, borderBottomRightRadius: 3 }} />
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-60">Estive aqui</p>
      <p className={`mt-1.5 break-words font-semibold leading-snug ${big ? "text-lg" : "text-[0.95rem]"}`} style={{ fontFamily: "var(--font-hand, 'Segoe Print','Bradley Hand','Comic Sans MS',cursive)" }}>{n.text}</p>
      <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-bold">— {firstName(n.name)}{n.at && <span className="block text-[10px] font-medium opacity-60">{when(n.at)}</span>}</span>
        <S size={big ? 26 : 20} aria-hidden className="shrink-0 opacity-80" />
      </div>
    </div>
  );
}

/** Estouro de brilhos quando o post-it gruda no quadro. */
function Burst() {
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2 + rnd(i, 4), d = 70 + rnd(i, 5) * 80; return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: ["#f5c542", "#fff1a8", "#fb923c", "#f472b6", "#60a5fa"][i % 5], s: 5 + rnd(i, 6) * 7 }; }), []);
  return <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">{bits.map((b, i) => <i key={i} className="spark absolute block rounded-full" style={{ width: b.s, height: b.s, background: b.c, "--dx": `${b.dx}px`, "--dy": `${b.dy}px`, animationDelay: `${i * 0.012}s` } as React.CSSProperties} />)}</div>;
}

/** Mural de post-its de quem encontrou o segredo: um por pessoa. */
export function EggBoard() {
  const [notes, setNotes] = useState<BoardNote[] | null>(null);
  const [err, setErr] = useState("");
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState({ text: "", color: "amarelo", sticker: "estrela" });
  const [burst, setBurst] = useState(0);
  const [fresh, setFresh] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const mine = notes?.find((n) => n.mine) ?? null;
  const me = notes?.find((n) => n.mine);

  useEffect(() => { let on = true; void listBoardAction().then((r) => { if (!on) return; if (r.ok) setNotes(r.notes ?? []); else setErr(r.message ?? "Não foi possível abrir o mural."); }); return () => { on = false; }; }, []);
  useEffect(() => { if (notes && !mine && !compose) setCompose(true); }, [notes, mine, compose]);
  const openEditor = () => { setDraft(mine ? { text: mine.text, color: mine.color, sticker: mine.sticker } : { text: "", color: "amarelo", sticker: "estrela" }); setCompose(true); };
  const save = () => start(async () => {
    const r = await saveNoteAction(draft);
    if (!r.ok) { setErr(r.message ?? "Não deu certo."); return; }
    setErr(""); setNotes(r.notes ?? []); setCompose(false); setBurst((b) => b + 1);
    const idx = (r.notes ?? []).findIndex((x) => x.mine); setFresh(idx); setTimeout(() => setFresh(null), 2500);
  });
  const remove = () => start(async () => { const r = await removeNoteAction(); if (r.ok) { setNotes(r.notes ?? []); setDraft({ text: "", color: "amarelo", sticker: "estrela" }); } });
  const draftNote = { name: "Você", text: draft.text.trim() || "Escreva aqui…", color: draft.color, sticker: draft.sticker };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad-soft text-accent ring-1 ring-line"><Pin size={22} aria-hidden /></span>
        <div className="min-w-0 flex-1"><h1 className="display text-3xl leading-tight">Estive aqui</h1><p className="text-sm text-muted">O mural de quem encontrou o Douradovo. Cada pessoa cola um post-it.</p></div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent"><Sparkles size={14} aria-hidden /> <span className="figure">{notes?.length ?? 0}</span> {(notes?.length ?? 0) === 1 ? "post-it" : "post-its"}</span>
        <Link href="/conquistas" className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium transition hover:bg-sunk">Conquistas</Link>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {!compose ? <button type="button" onClick={openEditor} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-grad px-4 py-2 font-semibold text-on-accent transition hover:brightness-110 active:scale-[0.98]"><PenLine size={16} aria-hidden /> {mine ? "Trocar meu post-it" : "Colar meu post-it"}</button> : (
          <>
            <button type="button" disabled={pending || !draft.text.trim()} onClick={save} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-grad px-4 py-2 font-semibold text-on-accent transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">{pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} {mine ? "Salvar e colar de novo" : "Colar no mural"}</button>
            {mine && <button type="button" onClick={() => setCompose(false)} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 py-2 font-medium transition hover:bg-sunk">Cancelar</button>}
          </>
        )}
        {err && <span role="alert" className="text-sm text-danger">{err}</span>}
        <span className="flex-1" />
        {mine && !compose && <button type="button" onClick={remove} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:bg-sunk hover:text-danger"><Eraser size={15} aria-hidden /> Tirar o meu</button>}
      </div>
      <div className="cork relative min-h-[28rem] overflow-hidden rounded-3xl border-8 border-[#8a5a2b] px-5 py-8 sm:px-8" style={{ boxShadow: "inset 0 0 80px rgb(0 0 0 / 0.4), 0 20px 40px -20px rgb(0 0 0 / 0.5)" }}>
        {burst > 0 && <Burst key={burst} />}
        {notes === null && !err && <p className="grid min-h-60 place-items-center text-sm font-medium text-white/90"><Loader2 className="animate-spin" aria-hidden /></p>}
        {err && notes === null && <p role="alert" className="rounded-xl bg-black/40 p-4 text-sm text-white">{err}</p>}
        {compose && (
          <div className="mb-8 grid items-center gap-6 rounded-2xl border border-white/30 bg-black/30 p-5 backdrop-blur-sm md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="mx-auto"><Note key={`${draft.color}${draft.sticker}`} n={draftNote} size="lg" fresh /></div>
            <div className="space-y-4 text-white">
              <label className="block text-sm font-semibold">Sua mensagem
                <textarea autoFocus maxLength={NOTE_MAX} rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Ex.: Achei o ovo e a gente bateu a meta!" className="mt-1.5 w-full resize-none rounded-xl border border-white/30 bg-white/95 px-3 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#f5c542]" />
                <span className="figure mt-1 block text-right text-xs font-normal opacity-80">{draft.text.length}/{NOTE_MAX}</span>
              </label>
              <div role="radiogroup" aria-label="Cor do post-it" className="flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold">Cor</span>
                {NOTE_COLORS.map((c) => <button key={c.key} type="button" role="radio" aria-checked={draft.color === c.key} aria-label={c.label} onClick={() => setDraft({ ...draft, color: c.key })} className={`size-8 rounded-full border-2 transition hover:scale-110 ${draft.color === c.key ? "scale-110 border-white ring-2 ring-white/60" : "border-white/30"}`} style={{ background: c.bg }} />)}
              </div>
              <div role="radiogroup" aria-label="Adesivo" className="flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold">Adesivo</span>
                {NOTE_STICKERS.map((s) => { const I = s.icon; return <button key={s.key} type="button" role="radio" aria-checked={draft.sticker === s.key} aria-label={s.label} title={s.label} onClick={() => setDraft({ ...draft, sticker: s.key })} className={`grid size-9 place-items-center rounded-xl border transition hover:scale-110 ${draft.sticker === s.key ? "border-[#f5c542] bg-[#f5c542] text-[#3b2a00]" : "border-white/30 bg-white/10"}`}><I size={17} aria-hidden /></button>; })}
              </div>
            </div>
          </div>
        )}
        {notes && notes.length === 0 && !compose && <p className="grid min-h-48 place-items-center text-center text-white/90"><span><MapPin className="mx-auto mb-2" aria-hidden />Ninguém colou nada ainda. Seja o primeiro!</span></p>}
        {notes && notes.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] justify-items-center gap-x-4 gap-y-7">
            {notes.map((n, i) => (n.mine && compose ? null : <li key={n.userId} className="w-full" style={{ marginTop: `${Math.round(rnd(i, 9) * 14)}px` }}><div className="grid place-items-center"><Note n={n} i={i} fresh={fresh === i} /></div></li>))}
          </ul>
        )}
      </div>
    </div>
  );
}
