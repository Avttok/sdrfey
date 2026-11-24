import { ListChecks, Plus } from "lucide-react";
import Link from "next/link";

type Item = { id: number; name: string; count: number; active: boolean };

/** Cartas no canto do Shuffler: sem lista, convida a criar uma; com listas, cada carta é uma lista (até 3). */
export function ListCards({ href, lists }: { href: string; lists: Item[] }) {
  const cards = lists.slice(0, 3);
  if (cards.length === 0) {
    return (
      <Link href={href} className="group sh-rise mx-auto flex w-full max-w-xs flex-col items-center gap-3 text-center" style={{ "--d": ".4s" } as React.CSSProperties}>
        <span className="relative block h-40 w-full">
          {[["-16deg", "-3.2rem", "0s"], ["14deg", "3.2rem", "-1.4s"]].map(([r, x, d]) => (
            <span key={r} aria-hidden className="sh-card absolute left-1/2 top-3 -ml-[3.1rem] h-32 w-[6.2rem] rounded-2xl border border-dashed border-accent/45 bg-panel/80 shadow-lg" style={{ "--r": r, "--x": x, "--d": d } as React.CSSProperties} />
          ))}
          <span className="sh-card hint-pulse absolute left-1/2 top-1 -ml-[3.4rem] grid h-36 w-[6.8rem] place-items-center rounded-2xl border-2 border-accent bg-grad text-on-accent shadow-2xl shadow-accent/40 transition group-hover:-translate-y-1" style={{ "--d": "-.7s" } as React.CSSProperties}><Plus size={40} aria-hidden /></span>
        </span>
        <span className="text-sm"><b className="block text-base">Quer mais precisão na sua consulta?</b><span className="text-muted">Crie uma lista shuffler agora!</span></span>
      </Link>
    );
  }
  const spread = cards.length === 1 ? [0] : cards.length === 2 ? [-1, 1] : [-1, 0, 1];
  return (
    <Link href={href} className="group sh-rise mx-auto flex w-full max-w-xs flex-col items-center gap-3 text-center" style={{ "--d": ".4s" } as React.CSSProperties}>
      <span className="relative block h-44 w-full">
        {cards.map((l, i) => (
          <span key={l.id} className="sh-card absolute left-1/2 top-2 -ml-[3.4rem] flex h-36 w-[6.8rem] flex-col items-center justify-between rounded-2xl border-2 bg-panel p-2.5 shadow-xl transition group-hover:-translate-y-1" style={{ "--r": `${spread[i] * 13}deg`, "--x": `${spread[i] * 4.2}rem`, "--d": `${-i * 0.7}s`, zIndex: l.active ? 3 : i, borderColor: l.active ? "var(--accent)" : "var(--line)" } as React.CSSProperties}>
            <span className={`grid size-10 place-items-center rounded-xl ${l.active ? "bg-grad text-on-accent" : "bg-accent/15 text-accent"}`}><ListChecks size={20} aria-hidden /></span>
            <span className="line-clamp-2 w-full break-words text-xs font-bold leading-tight">{l.name}</span>
            <span className="figure text-[11px] font-semibold text-muted">{l.count.toLocaleString("pt-BR")} leads</span>
          </span>
        ))}
      </span>
      <span className="text-sm"><b className="block text-base">Suas listas</b><span className="text-muted">{lists.length > 3 ? "Ver todas e escolher a ativa" : "Toque para escolher ou criar outra"}</span></span>
    </Link>
  );
}
