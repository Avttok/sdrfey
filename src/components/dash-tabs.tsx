"use client";

import { Handshake, Headset } from "lucide-react";
import { useState } from "react";

/** Alterna entre o painel de SDR e o de Vendas. Só aparece quando a pessoa tem os dois; com um só, mostra direto. */
export function DashTabs({ sdr, sales, salesLabel = "Vendas" }: { sdr: React.ReactNode; sales: React.ReactNode | null; salesLabel?: string }) {
  const [tab, setTab] = useState<"sdr" | "vendas">("sdr");
  if (!sales) return <>{sdr}</>;
  const opts = [["sdr", "SDR", Headset], ["vendas", salesLabel, Handshake]] as const;
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Painel" className="relative inline-grid grid-cols-2 rounded-full border border-line bg-panel p-1 shadow-sm">
        <span aria-hidden className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-grad shadow-md shadow-accent/30 transition-transform duration-300" style={{ transform: tab === "vendas" ? "translateX(100%)" : "none" }} />
        {opts.map(([k, l, I]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-full px-8 py-2 text-sm font-semibold transition-colors ${tab === k ? "text-on-accent" : "text-muted hover:text-ink"}`}><I size={16} aria-hidden />{l}</button>
        ))}
      </div>
      <div key={tab} className="pop-in space-y-5">{tab === "sdr" ? sdr : sales}</div>
    </div>
  );
}
