"use client";

import { useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, ScanSearch, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { eoxStepAction } from "@/modules/eox/actions";

const nf = new Intl.NumberFormat("pt-BR");
type Phase = "direct" | "scan";
const MODES: { key: Phase; title: string; text: string; Icon: typeof Search }[] = [
  { key: "direct", title: "Lead por lead", text: "Pergunta à EOX por cada lead sem Código EOX (pelo ID EOX e depois pelo CNPJ). Mais certeiro; passa por toda a base em lotes.", Icon: Search },
  { key: "scan", title: "Ler os cadastros da EOX", text: "Lê as empresas da EOX de 100 em 100 e liga pelos CNPJs e IDs que o sistema já tem. Bom quando a EOX tem menos cadastros que o sistema.", Icon: ScanSearch },
];

/** Roda a base inteira, em lotes, até acabar. Pode pausar e continuar (o ponto onde parou fica guardado). */
export function EoxScan({ total, remaining: initial, ready }: { total: number; remaining: number; ready: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("direct");
  const [running, setRunning] = useState(false);
  const [restart, setRestart] = useState(false);
  const [remaining, setRemaining] = useState(initial);
  const [t, setT] = useState({ linked: 0, checked: 0, rounds: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);
  const done = Math.max(0, total - remaining);
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function go() {
    stop.current = false; setRunning(true); setMsg(null);
    let first = restart, fails = 0;
    const acc = { linked: 0, checked: 0, rounds: 0 };
    setT(acc);
    while (!stop.current) {
      try {
        const r = await eoxStepAction(phase, first); first = false;
        if (!r.ok) { setMsg(r.message); break; }
        fails = 0;
        acc.linked += r.linked; acc.checked += r.checked; acc.rounds++;
        setT({ ...acc }); setRemaining(r.remaining);
        if (r.done) { setMsg(r.remaining === 0 ? "Todos os leads já têm Código EOX." : `Terminou a base: ${nf.format(r.remaining)} lead(s) a EOX não conhece.`); break; }
      } catch {
        if (++fails >= 3) { setMsg("A conexão falhou 3 vezes seguidas. Clique em Continuar para retomar de onde parou."); break; }
      }
    }
    setRunning(false); setRestart(false);
    if (acc.linked) toast("ok", `${nf.format(acc.linked)} cadastro(s) ligados ao Código EOX.`);
    router.refresh();
  }

  return (
    <section className={`${panelCls} space-y-4 p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><ScanSearch size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">Buscar os Códigos EOX da base inteira</h2><p className="text-sm text-muted">Roda em lotes até passar por todos os leads. Pode pausar e continuar depois: o sistema lembra onde parou.</p></div>
      </div>
      {!ready && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Ligue e configure a conexão com a EOX (aba Conexão) para buscar.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {MODES.map((m) => (
          <button key={m.key} type="button" disabled={running} aria-pressed={phase === m.key} onClick={() => setPhase(m.key)} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60 ${phase === m.key ? "border-accent bg-accent/8" : "border-line hover:bg-sunk"}`}>
            <m.Icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden /><span><b className="block text-sm">{m.title}</b><span className="text-xs text-muted">{m.text}</span></span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-sm"><span><b className="display text-lg tabular-nums">{nf.format(done)}</b> <span className="text-muted">de {nf.format(total)} leads com Código EOX</span></span><span className="figure font-semibold">{pct}%</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-grad transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!running ? <button type="button" disabled={!ready || remaining === 0} onClick={go} className={btnPrimary}><Play size={16} aria-hidden /> {t.rounds ? "Continuar" : "Buscar agora"}</button>
          : <button type="button" onClick={() => { stop.current = true; }} className={btnGhost}><Pause size={16} aria-hidden /> Pausar</button>}
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={restart} disabled={running} onChange={(e) => setRestart(e.target.checked)} /><RotateCcw size={13} aria-hidden /> Recomeçar do início</label>
        {running && <span className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> {nf.format(t.checked)} verificados · {nf.format(t.linked)} ligados</span>}
      </div>
      {!running && t.rounds > 0 && <p className="text-sm text-muted">Esta rodada: {nf.format(t.checked)} verificados · <b className="text-ink">{nf.format(t.linked)}</b> ligados.</p>}
      {msg && <p role="status" className="rounded-lg bg-sunk px-3 py-2 text-sm">{msg}</p>}
    </section>
  );
}
