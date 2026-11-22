"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
  const [digits, setDigits] = useState<number[]>([]);
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
    if (typeof r.digit === "number") setDigits((d) => [...d, r.digit!]);
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
            <p className="text-white/70">Cinco provas separam você do tesouro. Ligue o som.</p>
            <button type="button" onClick={start} className="rounded-xl bg-amber-400 px-5 py-2.5 font-bold text-amber-950 transition hover:scale-105">Entrar</button>
            {msg && <p className="text-sm text-rose-300">{msg}</p>}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2" aria-label="Progresso">
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2.5 w-8 rounded-full transition ${n < cur.step ? "bg-emerald-400" : n === cur.step ? "bg-amber-300" : "bg-white/20"}`} />)}
            </div>
            {digits.length > 0 && <p className="text-sm text-white/70">Anotado: <b className="tracking-[.3em] text-amber-300">{digits.join(" ")}</b></p>}
            <div key={cur.step} className="egg-rise">
              {cur.step === 1 && <Simon pattern={cur.data as number[]} onDone={solve} />}
              {cur.step === 2 && <Cipher text={cur.data as string} onDone={solve} />}
              {cur.step === 3 && <Charge onDone={solve} />}
              {cur.step === 4 && <Order nums={cur.data as number[]} onDone={solve} />}
              {cur.step === 5 && <Vault onDone={solve} />}
            </div>
            {msg && <p className="text-sm text-rose-300" role="alert">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

type Done = (answer: unknown) => Promise<boolean | undefined>;

function Simon({ pattern, onDone }: { pattern: number[]; onDone: Done }) {
  const [lit, setLit] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "show" | "play">("idle");
  const got = useRef<number[]>([]);
  const flash = async (i: number) => { setLit(i); tone(NOTES[i], 260, "triangle"); await sleep(380); setLit(-1); await sleep(120); };
  const show = async () => { setPhase("show"); got.current = []; await sleep(400); for (const i of pattern) await flash(i); setPhase("play"); };
  const press = async (i: number) => {
    if (phase !== "play") return;
    setLit(i); tone(NOTES[i], 200, "triangle"); setTimeout(() => setLit(-1), 200);
    got.current = [...got.current, i];
    if (got.current.length === pattern.length) { setPhase("idle"); const ok = await onDone(got.current); if (ok === false) setPhase("idle"); }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">1 · Repita a melodia</h2>
      <div className="mx-auto grid w-56 grid-cols-2 gap-3">
        {PADS.map((c, i) => <button key={i} type="button" aria-label={`Botão ${i + 1}`} onClick={() => press(i)} className={`h-24 rounded-2xl border-2 border-white/20 transition ${lit === i ? "egg-pad-on" : "opacity-60"}`} style={{ background: c, filter: lit === i ? "brightness(1.6)" : undefined }} />)}
      </div>
      <button type="button" disabled={phase === "show"} onClick={show} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 disabled:opacity-40">{phase === "idle" ? "▶ Ouvir" : phase === "show" ? "Ouça…" : "Sua vez ↻"}</button>
    </div>
  );
}

function Cipher({ text, onDone }: { text: string; onDone: Done }) {
  const [v, setV] = useState("");
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onDone(v); }}>
      <h2 className="text-lg font-semibold">2 · Decifre o nome</h2>
      <p className="font-mono text-4xl tracking-[.4em] text-amber-300">{text}</p>
      <p className="text-sm text-white/70">Quem assina o rodapé? As letras foram giradas 13 casas.</p>
      <input value={v} onChange={(e) => setV(e.target.value)} maxLength={12} autoFocus className="w-40 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-center uppercase tracking-widest outline-none focus:border-amber-300" aria-label="Resposta" />
      <div><button className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-amber-950">Revelar</button></div>
    </form>
  );
}

function Charge({ onDone }: { onDone: Done }) {
  const [pct, setPct] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0 = useRef(0);
  const stop = async () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (Date.now() - t0.current >= 3300) { const ok = await onDone("held"); if (ok === false) setPct(0); } else setPct(0);
  };
  const go = () => {
    t0.current = Date.now();
    timer.current = setInterval(() => { const p = Math.min(100, ((Date.now() - t0.current) / 3300) * 100); setPct(p); tone(200 + p * 5, 60, "square", 0.03); }, 100);
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">3 · Carregue a energia</h2>
      <p className="text-sm text-white/70">Segure o botão até encher. Soltou cedo, recomeça.</p>
      <button type="button" onPointerDown={go} onPointerUp={stop} onPointerLeave={() => timer.current && stop()} className="relative mx-auto grid h-28 w-28 select-none place-items-center rounded-full border-4 border-amber-300 text-4xl" style={{ background: `conic-gradient(#fbbf24 ${pct}%, rgba(255,255,255,.1) 0)` }} aria-label="Segurar"><span className="grid h-20 w-20 place-items-center rounded-full bg-slate-900">⚡</span></button>
    </div>
  );
}

function Order({ nums, onDone }: { nums: number[]; onDone: Done }) {
  const [picked, setPicked] = useState<number[]>([]);
  const click = async (n: number) => {
    if (picked.includes(n)) return;
    const next = [...picked, n]; setPicked(next); tone(300 + next.length * 120, 140, "triangle");
    if (next.length === nums.length) { const ok = await onDone(next); if (ok === false) setPicked([]); }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">4 · Do menor para o maior</h2>
      <div className="flex flex-wrap justify-center gap-3">
        {nums.map((n) => <button key={n} type="button" onClick={() => click(n)} disabled={picked.includes(n)} className="h-16 w-16 rounded-2xl border-2 border-white/25 bg-white/10 text-xl font-bold transition hover:scale-110 disabled:opacity-30">{n}</button>)}
      </div>
      <button type="button" onClick={() => setPicked([])} className="text-xs text-white/60 underline">limpar</button>
    </div>
  );
}

function Vault({ onDone }: { onDone: Done }) {
  const [d, setD] = useState([0, 0, 0, 0]);
  const bump = (i: number, by: number) => { tone(420 + i * 40, 70, "square", 0.04); setD((x) => x.map((v, k) => (k === i ? (v + by + 10) % 10 : v))); };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">5 · O cofre</h2>
      <p className="text-sm text-white/70">Digite os quatro números que você anotou, na ordem em que apareceram.</p>
      <div className="flex justify-center gap-2">
        {d.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <button type="button" aria-label="Aumentar" onClick={() => bump(i, 1)} className="rounded-md bg-white/10 px-3 hover:bg-white/20">▲</button>
            <span className="grid h-14 w-12 place-items-center rounded-lg border-2 border-amber-300 bg-slate-900 text-2xl font-bold tabular-nums">{v}</span>
            <button type="button" aria-label="Diminuir" onClick={() => bump(i, -1)} className="rounded-md bg-white/10 px-3 hover:bg-white/20">▼</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onDone(d)} className="rounded-xl bg-amber-400 px-5 py-2.5 font-bold text-amber-950">Abrir 🔓</button>
    </div>
  );
}
