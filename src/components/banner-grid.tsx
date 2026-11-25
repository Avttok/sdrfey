"use client";

import { Check, Lock, ShoppingBag } from "lucide-react";
import { RarityTag, unlockHint } from "@/components/rarity-tag";
import { BANNERS, bannerOpen, bannerStyle } from "@/config/banners";
import { SHOP } from "@/config/shop";

/** Amostras dos padrões de banner (usam a cor do sistema da pessoa). */
export function BannerGrid({ value, onPick, disabled, earned = [], ownedShop }: { value: string | null; onPick: (k: string | null) => void; disabled?: boolean; /** Conquistas da pessoa: liberam os banners especiais. */ earned?: readonly string[]; /** Itens que a pessoa comprou na loja do chat. Sem isto (primeiro acesso), os banners da loja nem aparecem. */ ownedShop?: readonly string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Banner do perfil">
      {BANNERS.map((b) => {
        const on = (value ?? "aurora") === b.key;
        const open = bannerOpen(b, earned);
        return (
          <button key={b.key} type="button" role="radio" aria-checked={on} aria-disabled={!open} disabled={disabled || !open} title={open ? undefined : unlockHint(b.unlock!)} onClick={() => onPick(b.key === "aurora" ? null : b.key)} className={`group relative overflow-hidden rounded-xl border-2 text-left transition ${open ? "hover:-translate-y-0.5" : "cursor-not-allowed"} ${on ? "border-accent shadow-md" : "border-line"}`}>
            <span className={`block h-14 ${open ? "" : "opacity-45 saturate-50"}`} style={bannerStyle(b.key)} />
            {!open && <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white"><Lock size={12} aria-hidden /></span>}
            <span className="flex items-center justify-between gap-1 bg-panel px-2.5 py-1.5 text-xs font-medium"><span className="min-w-0 truncate">{b.label}</span>{b.unlock && <RarityTag unlock={b.unlock} />}{on && <Check size={13} className="text-accent" aria-hidden />}</span>
            {!open && <span className="block truncate bg-panel px-2.5 pb-1.5 text-[10px] leading-tight text-muted">{unlockHint(b.unlock!)}</span>}
          </button>
        );
      })}
      {ownedShop && SHOP.filter((i) => i.cat === "banner").map((b) => {
        const on = value === b.key; const open = ownedShop.includes(b.key);
        return (
          <button key={b.key} type="button" role="radio" aria-checked={on} aria-disabled={!open} disabled={disabled || !open} title={open ? undefined : "Compre na loja do chat"} onClick={() => onPick(b.key)} className={`group relative overflow-hidden rounded-xl border-2 text-left transition ${open ? "hover:-translate-y-0.5" : "cursor-not-allowed"} ${on ? "border-accent shadow-md" : "border-line"}`}>
            <span className={`block h-14 ${open ? "" : "opacity-45 saturate-50"}`} style={bannerStyle(b.key)} />
            {!open && <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white"><Lock size={12} aria-hidden /></span>}
            <span className="flex items-center justify-between gap-1 bg-panel px-2.5 py-1.5 text-xs font-medium"><span className="min-w-0 truncate">{b.name}</span><span className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent"><ShoppingBag size={10} aria-hidden /> Loja</span>{on && <Check size={13} className="text-accent" aria-hidden />}</span>
            {!open && <span className="block truncate bg-panel px-2.5 pb-1.5 text-[10px] leading-tight text-muted">Compre na loja do chat</span>}
          </button>
        );
      })}
    </div>
  );
}
