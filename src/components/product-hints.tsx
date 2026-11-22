import { Lightbulb, PackageCheck, Trophy } from "lucide-react";
import type { Reco } from "@/modules/recommendations/data";

/** O que costuma ser oferecido a este tipo de cliente: sugestões do Adm e o que mais vendeu para empresas parecidas. */
export function ProductHints({ recos }: { recos: Reco[] }) {
  if (!recos.length) return null;
  return (
    <section aria-label="Produtos para oferecer" className="card-in space-y-2.5 rounded-2xl border border-accent/30 bg-accent/5 p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} aria-hidden className="text-accent" /> O que oferecer a este lead</p>
      {recos.map((r) => (
        <div key={r.segment} className="space-y-1.5">
          <p className="text-xs text-muted"><b className="text-ink">{r.label}</b> costumam comprar:</p>
          <div className="flex flex-wrap gap-1.5">
            {r.curated.map((c) => <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-panel px-2.5 py-1 text-xs font-semibold"><PackageCheck size={12} aria-hidden className="text-accent" />{c}</span>)}
            {r.learned.map((l) => <span key={l.name} title={`${l.deals} negociações com este item, ${l.won} faturadas`} className="inline-flex items-center gap-1.5 rounded-full bg-sunk px-2.5 py-1 text-xs capitalize"><Trophy size={12} aria-hidden className={l.won ? "text-[#e0a800]" : "text-muted"} />{l.name}<span className="figure text-muted">{l.won ? `${l.won} vendidas` : `${l.deals} cotadas`}</span></span>)}
          </div>
        </div>
      ))}
    </section>
  );
}
