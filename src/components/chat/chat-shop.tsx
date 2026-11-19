"use client";

import { Check, Coins, ShoppingBag, Loader2, Lock, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { chatStyle } from "@/components/chat/styled";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCached } from "@/lib/use-cached";
import { useToast } from "@/components/toast";
import { CATEGORIES, SHOP, SHOP_BY_KEY, TASK_COINS, type ShopCategory, type ShopItem } from "@/config/shop";
import { buyItemAction, equipItemAction, shopStateAction } from "@/modules/coins/actions";
import type { ShopState } from "@/modules/coins/coins";

const nf = new Intl.NumberFormat("pt-BR");

/** Loja dentro do chat: pré-visualização ao vivo do seu nome e balão, e os itens por categoria. */
export function ChatShop({ myName, meId }: { myName: string; meId: number }) {
  const toast = useToast();
  const [cat, setCat] = useState<ShopCategory>("font");
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const [pending, start] = useTransition();
  const [how, setHow] = useState(false);
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [st, setSt] = useCached<ShopState>(`shop:${meId}`, shopStateAction);
  if (!st) return <p className="flex flex-1 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Abrindo a loja…</p>;

  const preview = { ...st.equipped, ...(trying ? { [trying.cat]: trying.key } : {}) };
  const sty = chatStyle(preview);
  const first = (myName || "Você").split(" ")[0];
  const act = (fn: () => Promise<{ ok: boolean; message?: string; state?: ShopState }>) => start(async () => { const r = await fn(); if (r.state) setSt(r.state); toast(r.ok ? "ok" : "bad", r.message ?? ""); });
  const items = SHOP.filter((i) => i.cat === cat);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-line bg-sunk/40 p-3">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 rounded-full bg-grad px-3 py-1 text-sm font-bold text-on-accent shadow"><Coins size={16} aria-hidden /><span className="figure">{nf.format(st.balance)}</span> moedas</p>
          <button type="button" onClick={() => setHow((v) => !v)} className="text-xs font-medium text-accent hover:underline">{how ? "Fechar" : "Como ganhar?"}</button>
        </div>
        {how && (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-panel px-3 py-2 text-xs text-muted">
            <li>Lead atendido: <b className="figure text-ink">+{(st?.rewards ?? TASK_COINS).attended}</b></li><li>Visita agendada: <b className="figure text-ink">+{(st?.rewards ?? TASK_COINS).visit}</b></li>
            <li>Negociação aberta: <b className="figure text-ink">+{(st?.rewards ?? TASK_COINS).deal}</b></li><li>Cotação enviada: <b className="figure text-ink">+{(st?.rewards ?? TASK_COINS).quote}</b></li>
            <li>Venda faturada: <b className="figure text-ink">+{(st?.rewards ?? TASK_COINS).billed}</b></li><li>Inativo trabalhado: <b className="figure text-ink">+{(st?.rewards ?? TASK_COINS).shuffled}</b></li>
            <li className="col-span-2 flex items-center gap-1"><Sparkles size={12} className="text-accent" aria-hidden /> Cada conquista também paga de 20 a 150 moedas.</li>
          </ul>
        )}
        <div className="rounded-xl border border-dashed border-line bg-panel p-3" aria-label="Pré-visualização">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{trying ? `Experimentando: ${trying.name}` : "Como você aparece"}</p>
          <p className="mb-1 px-1 text-[13px]"><span className={`font-medium ${sty.nameCls}`} style={sty.name}>{first}</span></p>
          <div style={sty.bubble ?? undefined} className={`inline-block max-w-full rounded-2xl rounded-tl-md px-3 py-2 text-sm ${sty.bubble ? "" : "bg-sunk"}`}>Bom dia, time! Bora bater a meta? 🚀</div>
        </div>
      </div>
      <div role="tablist" aria-label="Categorias" className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
        {CATEGORIES.map((c) => <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} onClick={() => { setCat(c.key); setTrying(null); }} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${cat === c.key ? "bg-grad-soft text-accent" : "text-muted hover:bg-sunk"}`}>{c.label}</button>)}
      </div>
      <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-2.5">
        {st.equipped[cat] && <li className="col-span-2"><button type="button" disabled={pending} onClick={() => act(() => equipItemAction(cat, null))} className="w-full rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:bg-sunk">Tirar {CATEGORIES.find((c) => c.key === cat)!.label.toLowerCase()} (voltar ao padrão)</button></li>}
        {items.map((i) => {
          const owned = st.owned.includes(i.key), on = st.equipped[cat] === i.key, afford = st.balance >= i.price;
          const s = chatStyle({ [i.cat]: i.key });
          return (
            <li key={i.key} onMouseEnter={() => setTrying(i)} onMouseLeave={() => setTrying(null)} onFocus={() => setTrying(i)} onBlur={() => setTrying(null)} className={`flex flex-col gap-2 rounded-xl border p-2.5 transition ${on ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-accent/50"}`}>
              <div className="grid min-h-12 place-items-center overflow-hidden rounded-lg bg-sunk/60 px-1 py-2 text-center">
                {i.cat === "bubble"
                  ? <span style={s.bubble ?? undefined} className="rounded-xl px-2.5 py-1 text-xs">Olá!</span>
                  : <span className={`text-base font-semibold ${s.nameCls}`} style={s.name}>{(myName || "Você").split(" ")[0]}</span>}
              </div>
              <p className="text-xs font-semibold">{i.name}</p>
              {owned
                ? <button type="button" disabled={pending || on} onClick={() => act(() => equipItemAction(i.cat, i.key))} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold ${on ? "bg-ok/15 text-ok" : "bg-grad text-on-accent"}`}>{on ? <><Check size={13} aria-hidden /> Em uso</> : "Usar"}</button>
                : <button type="button" disabled={pending || !afford} onClick={() => setBuying(i)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${afford ? "bg-grad text-on-accent hover:brightness-110" : "bg-sunk text-muted"}`}>{afford ? <Coins size={13} aria-hidden /> : <Lock size={13} aria-hidden />}<span className="figure">{nf.format(i.price)}</span></button>}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={!!buying} icon={ShoppingBag} title={buying ? `Comprar “${buying.name}”?` : ""} confirmLabel={buying ? `Comprar por ${nf.format(buying.price)} moedas` : "Comprar"} busy={pending}
        onCancel={() => setBuying(null)} onConfirm={() => { const b = buying; setBuying(null); if (b) act(() => buyItemAction(b.key)); }}>
        {buying && (() => { const s = chatStyle({ [buying.cat]: buying.key }); return (
          <div className="space-y-3">
            <div className="grid min-h-14 place-items-center rounded-xl bg-sunk/60 px-3 py-3 text-center">
              {buying.cat === "bubble" ? <span style={s.bubble ?? undefined} className="rounded-2xl px-3 py-1.5 text-sm text-ink">Bom dia, time!</span> : <span className={`text-lg font-semibold ${s.nameCls}`} style={s.name}>{first}</span>}
            </div>
            <p>Saldo: <b className="figure text-ink">{nf.format(st.balance)}</b> → <b className="figure text-ink">{nf.format(st.balance - buying.price)}</b> moedas</p>
          </div>); })()}
      </ConfirmDialog>
    </div>
  );
}
