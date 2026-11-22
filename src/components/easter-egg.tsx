"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { EGG_COLORS } from "@/config/egg";
import { eggBeginAction, eggSolveAction, type EggStep } from "@/modules/easter/actions";

/* Sons sintetizados: nada de arquivos de áudio para baixar. */
let ctx: AudioContext | null = null;
function tone(freq: number, ms = 180, type: OscillatorType = "sine", gain = 0.07) {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch { /* sem áudio: segue mudo */ }
}
const NOTES = [392, 523, 659, 784];
const PADS = ["#f43f5e", "#38bdf8", "#facc15", "#34d399"];
const win = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 260, "triangle"), i * 110));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function EggGame({ done }: { done: boolean }) {
  const [cur, setCur] = useState<EggStep | null>(null);
  const [msg, setMsg] = useState("");
  const [won, setWon] = useState<number | null>(done ? 0 : null);
  const [busy, setBusy] = useState(false);

  const start = async () => { tone(330, 300); const r = await eggBeginAction(); if (r.ok && r.next) setCur(r.next); else setMsg("A porta se fechou. Bata de novo no rodapé."); };
  const solve = async (answer: unknown) => {
    if (!cur || busy) return;
    setBusy(true);
    const r = await eggSolveAction(cur.token, answer);
    setBusy(false);
    if (!r.ok) { tone(150, 300, "sawtooth"); setMsg(r.message ?? "Não era isso…"); return false; }
    setMsg("");
    if (r.done) { win(); setWon(r.done.coins); return true; }
    tone(880, 160, "triangle"); setTimeout(() => tone(1175, 220, "triangle"), 140);
    setCur(r.next ?? null);
    return true;
  };

  return (
    <div className="relative -mx-3 -my-7 flex min-h-[80vh] flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#1e1b4b,#020617)] px-4 py-10 text-white sm:-mx-5 lg:-mx-6">
      {Array.from({ length: 40 }, (_, i) => <span key={i} aria-hidden className="absolute h-1 w-1 rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animation: `egg-star ${2 + (i % 5) * 0.6}s ease-in-out ${(i % 7) * 0.3}s infinite` }} />)}
      <div className="egg-rise relative z-10 w-full max-w-md space-y-5 text-center">
        {won !== null ? (
          <>
            <p className="text-7xl">{won ? "🏆" : "🥚"}</p>
            <h1 className="text-2xl font-bold">{won ? `Você descobriu o segredo!` : "Você já abriu este ovo."}</h1>
            {won ? <p className="text-white/80">+{won} moedas e 4 itens exclusivos na sua loja — já equipados. 🎉</p> : <p className="text-white/70">Os prêmios continuam com você. Psiu: não conte onde fica a porta.</p>}
            <Link href="/" className="inline-block rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">Voltar ao trabalho</Link>
          </>
        ) : !cur ? (
          <>
            <p className="egg-crack text-7xl">🥚</p>
            <h1 className="text-2xl font-bold">Você achou a porta.</h1>
            <p className="text-white/70">Cinco provas separam você do tesouro, e elas mudam a cada vez. Ligue o som.</p>
            <button type="button" onClick={start} className="rounded-xl bg-amber-400 px-5 py-2.5 font-bold text-amber-950 transition hover:scale-105">Entrar</button>
            {msg && <p className="text-sm text-rose-300">{msg}</p>}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2" aria-label="Progresso">
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2.5 w-8 rounded-full transition ${n < cur.step ? "bg-emerald-400" : n === cur.step ? "bg-amber-300" : "bg-white/20"}`} />)}
            </div>
            <div key={cur.step} className="egg-rise">
              {cur.kind === "simon" && <Simon pattern={cur.data as number[]} n={cur.step} onDone={solve} />}
              {cur.kind === "cipher" && <Cipher {...(cur.data as { text: string; shift: number })} n={cur.step} onDone={solve} />}
              {cur.kind === "hold" && <Charge ms={(cur.data as { ms: number }).ms} n={cur.step} onDone={solve} />}
              {cur.kind === "order" && <Order {...(cur.data as { nums: number[]; dir: "asc" | "desc" })} n={cur.step} onDone={solve} />}
              {cur.kind === "seq" && <Seq {...(cur.data as { shown: (number | null)[]; options: number[] })} n={cur.step} onDone={solve} />}
              {cur.kind === "odd" && <Odd cells={(cur.data as { cells: string[] }).cells} n={cur.step} onDone={solve} />}
              {cur.kind === "count" && <Count total={(cur.data as { n: number }).n} options={(cur.data as { options: number[] }).options} n={cur.step} onDone={solve} />}
              {cur.kind === "color" && <Color {...(cur.data as { word: string; ink: string; options: string[] })} n={cur.step} onDone={solve} />}
            </div>
            {msg && <p className="text-sm text-rose-300" role="alert">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

type Done = (answer: unknown) => Promise<boolean | undefined>;
const Title = ({ n, children }: { n: number; children: string }) => <h2 className="text-lg font-semibold">{n} · {children}</h2>;
const tile = "rounded-2xl border-2 border-white/25 bg-white/10 font-bold transition hover:scale-110 disabled:opacity-30";

function Simon({ pattern, n, onDone }: { pattern: number[]; n: number; onDone: Done }) {
  const [lit, setLit] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "show" | "play">("idle");
  const got = useRef<number[]>([]);
  const flash = async (i: number) => { setLit(i); tone(NOTES[i], 260, "triangle"); await sleep(380); setLit(-1); await sleep(120); };
  const show = async () => { setPhase("show"); got.current = []; await sleep(400); for (const i of pattern) await flash(i); setPhase("play"); };
  const press = async (i: number) => {
    if (phase !== "play") return;
    setLit(i); tone(NOTES[i], 200, "triangle"); setTimeout(() => setLit(-1), 200);
    got.current = [...got.current, i];
    if (got.current.length === pattern.length) { setPhase("idle"); await onDone(got.current); }
  };
  return (
    <div className="space-y-4">
      <Title n={n}>Repita a melodia</Title>
      <div className="mx-auto grid w-56 grid-cols-2 gap-3">
        {PADS.map((c, i) => <button key={i} type="button" aria-label={`Botão ${i + 1}`} onClick={() => press(i)} className={`h-24 rounded-2xl border-2 border-white/20 transition ${lit === i ? "egg-pad-on" : "opacity-60"}`} style={{ background: c, filter: lit === i ? "brightness(1.6)" : undefined }} />)}
      </div>
      <button type="button" disabled={phase === "show"} onClick={show} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 disabled:opacity-40">{phase === "idle" ? "▶ Ouvir" : phase === "show" ? "Ouça…" : "Sua vez ↻"}</button>
    </div>
  );
}

function Cipher({ text, shift, n, onDone }: { text: string; shift: number; n: number; onDone: Done }) {
  const [v, setV] = useState("");
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onDone(v); }}>
      <Title n={n}>Decifre a palavra</Title>
      <p className="font-mono text-4xl tracking-[.4em] text-amber-300">{text}</p>
      <p className="text-sm text-white/70">Cada letra andou {shift} {shift === 1 ? "casa" : "casas"} para a frente no alfabeto. Volte {shift === 1 ? "uma" : shift}.</p>
      <p className="font-mono text-[11px] tracking-[.18em] text-white/40" aria-hidden>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
      <input value={v} onChange={(e) => setV(e.target.value)} maxLength={12} autoFocus className="w-40 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-center uppercase tracking-widest outline-none focus:border-amber-300" aria-label="Resposta" />
      <div><button className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-amber-950">Revelar</button></div>
    </form>
  );
}

function Charge({ ms, n, onDone }: { ms: number; n: number; onDone: Done }) {
  const [pct, setPct] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0 = useRef(0);
  const stop = async () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (Date.now() - t0.current >= ms + 100) { const ok = await onDone("held"); if (ok === false) setPct(0); } else setPct(0);
  };
  const go = () => {
    t0.current = Date.now();
    timer.current = setInterval(() => { const p = Math.min(100, ((Date.now() - t0.current) / ms) * 100); setPct(p); tone(200 + p * 5, 60, "square", 0.03); }, 100);
  };
  return (
    <div className="space-y-4">
      <Title n={n}>Carregue a energia</Title>
      <p className="text-sm text-white/70">Segure o botão até encher. Soltou cedo, recomeça.</p>
      <button type="button" onPointerDown={go} onPointerUp={stop} onPointerLeave={() => timer.current && stop()} className="relative mx-auto grid h-28 w-28 select-none place-items-center rounded-full border-4 border-amber-300 text-4xl" style={{ background: `conic-gradient(#fbbf24 ${pct}%, rgba(255,255,255,.1) 0)` }} aria-label="Segurar"><span className="grid h-20 w-20 place-items-center rounded-full bg-slate-900">⚡</span></button>
    </div>
  );
}

function Order({ nums, dir, n, onDone }: { nums: number[]; dir: "asc" | "desc"; n: number; onDone: Done }) {
  const [picked, setPicked] = useState<number[]>([]);
  const click = async (x: number) => {
    if (picked.includes(x)) return;
    const next = [...picked, x]; setPicked(next); tone(300 + next.length * 120, 140, "triangle");
    if (next.length === nums.length) { const ok = await onDone(next); if (ok === false) setPicked([]); }
  };
  return (
    <div className="space-y-4">
      <Title n={n}>{dir === "asc" ? "Do menor para o maior" : "Do maior para o menor"}</Title>
      <div className="flex flex-wrap justify-center gap-3">
        {nums.map((x) => <button key={x} type="button" onClick={() => click(x)} disabled={picked.includes(x)} className={`${tile} h-16 w-16 text-xl`}>{x}</button>)}
      </div>
      <button type="button" onClick={() => setPicked([])} className="text-xs text-white/60 underline">limpar</button>
    </div>
  );
}

function Seq({ shown, options, n, onDone }: { shown: (number | null)[]; options: number[]; n: number; onDone: Done }) {
  return (
    <div className="space-y-4">
      <Title n={n}>Qual número falta?</Title>
      <div className="flex flex-wrap justify-center gap-2 text-2xl font-bold tabular-nums">
        {shown.map((v, i) => <span key={i} className={`grid h-14 w-14 place-items-center rounded-xl border-2 ${v === null ? "border-dashed border-amber-300 text-amber-300" : "border-white/20 bg-white/5"}`}>{v ?? "?"}</span>)}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {options.map((o) => <button key={o} type="button" onClick={() => { tone(500 + o * 8, 120, "triangle"); void onDone(o); }} className={`${tile} h-14 w-14 text-xl`}>{o}</button>)}
      </div>
    </div>
  );
}

function Odd({ cells, n, onDone }: { cells: string[]; n: number; onDone: Done }) {
  return (
    <div className="space-y-4">
      <Title n={n}>Ache o diferente</Title>
      <div className="mx-auto grid w-64 grid-cols-4 gap-2">
        {cells.map((c, i) => <button key={i} type="button" aria-label={`Figura ${i + 1}`} onClick={() => { tone(440 + i * 15, 100, "triangle"); void onDone(i); }} className="grid h-14 w-14 place-items-center rounded-xl border border-white/20 bg-white/10 text-3xl transition hover:scale-110">{c}</button>)}
      </div>
    </div>
  );
}

function Count({ total, options, n, onDone }: { total: number; options: number[]; n: number; onDone: Done }) {
  const [phase, setPhase] = useState<"idle" | "show" | "ask">("idle");
  const spots = useRef(Array.from({ length: total }, (_, i) => ({ x: 8 + ((i * 37 + Math.random() * 30) % 76), y: 10 + ((i * 53 + Math.random() * 30) % 68) })));
  const play = async () => { setPhase("show"); for (let i = 0; i < total; i++) setTimeout(() => tone(520 + i * 60, 90, "triangle"), i * 220); await sleep(2600); setPhase("ask"); };
  return (
    <div className="space-y-4">
      <Title n={n}>Conte as estrelas</Title>
      <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-2xl border border-white/15 bg-white/5">
        {phase === "show" && spots.current.map((p, i) => <span key={i} className="egg-rise absolute text-2xl" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${i * 0.22}s` }} aria-hidden>⭐</span>)}
        {phase === "idle" && <button type="button" onClick={play} className="absolute inset-0 text-sm font-semibold hover:bg-white/10">▶ Mostrar</button>}
        {phase === "ask" && <p className="absolute inset-0 grid place-items-center text-sm text-white/70">Quantas apareceram?</p>}
      </div>
      {phase === "ask" && (
        <div className="flex flex-wrap justify-center gap-3">
          {options.map((o) => <button key={o} type="button" onClick={async () => { const ok = await onDone(o); if (ok === false) setPhase("idle"); }} className={`${tile} h-14 w-14 text-xl`}>{o}</button>)}
        </div>
      )}
    </div>
  );
}

function Color({ word, ink, options, n, onDone }: { word: string; ink: string; options: string[]; n: number; onDone: Done }) {
  return (
    <div className="space-y-4">
      <Title n={n}>Toque na cor da tinta</Title>
      <p className="text-5xl font-black tracking-wide" style={{ color: ink }}>{word}</p>
      <p className="text-sm text-white/70">Não vale ler a palavra: olhe a cor com que ela foi escrita.</p>
      <div className="flex justify-center gap-3">
        {options.map((k) => { const c = EGG_COLORS.find((x) => x.key === k)!; return <button key={k} type="button" aria-label={c.name} onClick={() => { tone(380 + options.indexOf(k) * 90, 140, "triangle"); void onDone(k); }} className="h-14 w-14 rounded-full border-2 border-white/30 transition hover:scale-110" style={{ background: c.hex }} />; })}
      </div>
    </div>
  );
}
