"use client";

import { ListChecks, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { btnGhost, btnPrimary } from "@/components/ui";
import { describeFilters, type ListFilters } from "@/config/lists";
import { startListByIdAction } from "@/modules/lists/actions";

type Item = { id: number; name: string; count: number; active: boolean; total?: number; filters?: ListFilters };

/** Cartas no canto do Shuffler: sem lista, convida a criar uma; com listas, cada carta é uma lista (até 3). */
export function ListCards({ href, lists, kind }: { href: string; lists: Item[]; kind: "sdr" | "vendas" }) {
  const cards = lists.slice(0, 3);
  const [open, setOpen] = useState<Item | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  if (cards.length === 0) {
    return (
      <Link href={href} className="group sh-rise flex w-full max-w-xs flex-col items-center gap-3 text-center" style={{ "--d": ".4s" } as React.CSSProperties}>
        <span className="relative block h-44 w-full">
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
  const go = (l: Item) => start(async () => { setErr(""); const r = await startListByIdAction(kind, l.id); if (r && !r.ok) setErr(r.message); });
  return (
    <div className="sh-rise flex w-full max-w-xs flex-col items-center gap-3 text-center" style={{ "--d": ".4s" } as React.CSSProperties}>
      <span className="relative block h-44 w-full">
        {cards.map((l, i) => (
          <button key={l.id} type="button" onClick={() => { setErr(""); setOpen(l); }} aria-label={`Abrir a lista ${l.name}`} className="sh-card absolute left-1/2 top-2 -ml-[3.4rem] flex h-36 w-[6.8rem] cursor-pointer flex-col items-center justify-between rounded-2xl border-2 bg-panel p-2.5 shadow-xl transition hover:-translate-y-1" style={{ "--r": `${spread[i] * 13}deg`, "--x": `${spread[i] * 4.2}rem`, "--d": `${-i * 0.7}s`, zIndex: l.active ? 3 : i, borderColor: l.active ? "var(--accent)" : "var(--line)" } as React.CSSProperties}>
            <span className={`grid size-10 place-items-center rounded-xl ${l.active ? "bg-grad text-on-accent" : "bg-accent/15 text-accent"}`}><ListChecks size={20} aria-hidden /></span>
            <span className="line-clamp-2 w-full break-words text-xs font-bold leading-tight">{l.name}</span>
            <span className="figure text-[11px] font-semibold text-muted">{l.count.toLocaleString("pt-BR")} leads</span>
          </button>
        ))}
      </span>
      <Link href={href} className="text-sm"><b className="block text-base">Suas listas</b><span className="text-muted underline-offset-2 hover:underline">Toque numa carta para começar · gerenciar listas</span></Link>
      {open && (
        <Modal onClose={() => !pending && setOpen(null)} icon={ListChecks} title={open.name} subtitle="Começar a sortear desta lista?" size="sm"
          footer={<><button type="button" className={btnPrimary} disabled={pending || open.count === 0} onClick={() => go(open)}><Play size={16} aria-hidden /> {pending ? "Abrindo…" : "Começar"}</button><button type="button" className={btnGhost} disabled={pending} onClick={() => setOpen(null)}>Agora não</button><Link href={href} className="ml-auto text-sm text-muted underline">Editar listas</Link></>}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <p className="rounded-xl bg-sunk p-3"><b className="figure block text-2xl">{open.count.toLocaleString("pt-BR")}</b><span className="text-xs text-muted">leads para sortear</span></p>
            <p className="rounded-xl bg-sunk p-3"><b className="figure block text-2xl">{(open.total ?? open.count).toLocaleString("pt-BR")}</b><span className="text-xs text-muted">leads na lista</span></p>
          </div>
          <p className="mt-3 text-sm text-muted">{(open.filters ? describeFilters(open.filters).join(" · ") : "") || "Sem filtros"}</p>
          {open.count === 0 && <p className="mt-3 text-sm font-medium text-warn">Esta lista não tem mais leads livres.</p>}
          {err && <p role="alert" className="mt-3 text-sm font-medium text-danger">{err}</p>}
        </Modal>
      )}
    </div>
  );
}
