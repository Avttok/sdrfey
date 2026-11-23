import { Crown, Medal, Trophy } from "lucide-react";
import type { ReactNode } from "react";

/** Anel de progresso. Verde ao bater a meta. */
export function Ring({ pct, size = 64, children }: { pct: number; size?: number; children?: ReactNode }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, done = pct >= 100;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} stroke="var(--sunk)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} strokeLinecap="round" stroke={done ? "var(--ok)" : "var(--accent)"} strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} style={{ transition: "stroke-dashoffset .7s" }} />
      </svg>
      <span className="figure absolute text-sm font-bold">{children ?? `${Math.round(pct)}%`}</span>
    </span>
  );
}

/** Anel claro, para ficar sobre o fundo colorido do destaque. */
function HeroRing({ pct, size = 128 }: { pct: number; size?: number }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(pct)}% das metas`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={11} stroke="rgb(255 255 255 / .28)" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={11} strokeLinecap="round" stroke="#fff" strokeDasharray={c} strokeDashoffset={c - (Math.min(100, pct) / 100) * c} style={{ transition: "stroke-dashoffset .9s", filter: "drop-shadow(0 0 6px rgb(255 255 255 / .55))" }} />
      </svg>
      <span className="figure absolute text-3xl font-extrabold">{Math.round(pct)}%</span>
    </span>
  );
}

/** Destaque do topo: o resumo da equipe em uma olhada (mesma linguagem do Lista Flow e do menu do perfil). */
export function GoalsHero({ eyebrow, title, text, pct, chips }: { eyebrow: string; title: string; text: string; pct: number; chips: { icon: ReactNode; label: string }[] }) {
  return (
    <section className="aurora relative overflow-hidden rounded-3xl bg-grad p-5 text-on-accent shadow-lg sm:p-7">
      <span aria-hidden className="aurora-blob a" /><span aria-hidden className="aurora-blob b" />
      <div className="relative flex flex-wrap items-center gap-5 sm:gap-7">
        <HeroRing pct={pct} />
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">{eyebrow}</p>
          <h2 className="display mt-0.5 text-2xl sm:text-3xl">{title}</h2>
          <p className="mt-1 max-w-xl text-sm opacity-90">{text}</p>
          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {chips.map((c, i) => <li key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{c.icon}{c.label}</li>)}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Barra de progresso com marcas em 50% e 100%. Dourada ao bater a meta. */
export function Meter({ pct, done, label }: { pct: number; done?: boolean; label: string }) {
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? "gold-bar" : "bg-grad"}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-ink/10" />
    </div>
  );
}

/** Bolinha com a inicial, na cor da pessoa. */
export function Avatar({ name, hex, size = 44 }: { name: string; hex?: string; size?: number }) {
  return <span aria-hidden className="grid shrink-0 place-items-center rounded-2xl font-bold text-white shadow-sm" style={{ width: size, height: size, background: hex ?? "var(--accent)", fontSize: size * 0.42 }}>{name.trim().charAt(0).toUpperCase()}</span>;
}

/** Posição no ranking: coroa, prata e bronze; some quando ninguém pontuou ainda. */
export function Rank({ pos }: { pos: number }) {
  if (pos > 3) return null;
  const tone = pos === 1 ? "text-[#c99700]" : pos === 2 ? "text-slate-400" : "text-[#b4713b]";
  const Icon = pos === 1 ? Crown : Medal;
  return <span title={`${pos}º lugar`} className={`inline-flex items-center gap-0.5 text-xs font-bold ${tone}`}><Icon size={15} aria-hidden /> {pos}º</span>;
}

/** Cabeçalho do cartão de uma pessoa. */
export function PersonHead({ name, hex, pct, pos, sub }: { name: string; hex?: string; pct: number; pos?: number; sub?: string }) {
  const done = pct >= 100;
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} hex={hex} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-lg font-bold leading-tight"><span className="truncate">{name}</span>{pos ? <Rank pos={pos} /> : null}</p>
        {sub && <p className="text-xs text-muted first-letter:uppercase">{sub}</p>}
      </div>
      {done && <Trophy size={18} className="shrink-0 text-[#c99700]" aria-hidden />}
      <Ring pct={pct} size={58} />
    </div>
  );
}

/** Quadro de uma meta (ícone, valor grande, barra). `children` entra embaixo (ritmo, previsão). */
export function GoalCard({ icon, label, tag, pct, done, value, of, children }: { icon: ReactNode; label: string; tag?: string; pct: number; done: boolean; value: ReactNode; of: ReactNode; children?: ReactNode }) {
  return (
    <li className={`relative overflow-hidden rounded-2xl border p-4 ${done ? "gold-card border-transparent" : "border-line/70 bg-sunk/40"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${done ? "trophy-medal text-[#5b3a00]" : "bg-grad text-on-accent"} shadow-sm`}>{done ? <Trophy size={17} aria-hidden /> : icon}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold leading-tight">{label}</span>{tag && <span className="text-[11px] text-muted">{tag}</span>}</span>
        <b className={`figure text-lg ${done ? "text-[#8a6100] dark:text-[#f5c542]" : ""}`}>{Math.round(pct)}%</b>
      </div>
      <p className="figure mt-3 flex flex-wrap items-baseline gap-x-1.5"><b className="text-3xl leading-none">{value}</b><span className="text-sm text-muted">{of}</span></p>
      <div className="mt-2.5"><Meter pct={pct} done={done} label={label} /></div>
      {children}
    </li>
  );
}

/** Quadro do total da equipe, no topo. */
export function TeamTile({ icon, label, sub, pct, value, of }: { icon: ReactNode; label: string; sub?: string; pct: number; value: ReactNode; of: ReactNode }) {
  const done = pct >= 100;
  return (
    <section className={`lift flex min-w-0 items-center gap-4 rounded-3xl border bg-panel p-4 shadow-sm ${done ? "gold-card border-transparent" : "border-line"}`}>
      <Ring pct={pct} size={72} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-muted"><span className="text-accent">{icon}</span> {label}</p>
        <p className="figure mt-1 break-words text-2xl font-extrabold leading-tight">{value}</p>
        <p className="figure break-words text-xs font-medium text-muted">{of}</p>
        {sub && <p className="mt-1 text-xs text-muted first-letter:uppercase">{sub}</p>}
      </div>
    </section>
  );
}
