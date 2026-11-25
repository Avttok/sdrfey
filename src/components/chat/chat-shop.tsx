"use client";

import { HScroll } from "@/components/h-scroll";
import { Check, Coins, Gift, ShoppingBag, Loader2, Lock, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { chatStyle } from "@/components/chat/styled";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCached } from "@/lib/use-cached";
import { useToast } from "@/components/toast";
import { bannerStyle } from "@/config/banners";
import { CATEGORIES, SET_DISCOUNT, SETS, SHOP, SHOP_BY_KEY, TASK_COINS, setPrice, type ShopCategory, type ShopItem, type ShopSet } from "@/config/shop";
import { buyItemAction, buySetAction, equipItemAction, equipSetAction, shopStateAction } from "@/modules/coins/actions";
import type { ShopState } from "@/modules/coins/coins";

const nf = new Intl.NumberFormat("pt-BR");

/** Loja dentro do chat: pré-visualização ao vivo do seu nome e balão, e os itens por categoria. */
export function ChatShop({ myName, meId }: { myName: string; meId: number }) {
  const toast = useToast();
  const [cat, setCat] = useState<ShopCategory | "set">("set");
  const [trySet, setTrySet] = useState<ShopSet | null>(null);
  const [buyingSet, setBuyingSet] = useState<ShopSet | null>(null);
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const [pending, start] = useTransition();
  const [how, setHow] = useState(false);
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [st, setSt] = useCached<ShopState>(`shop:${meId}`, shopStateAction);
  if (!st) return <p className="flex flex-1 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> Abrindo a loja…</p>;

  const setEq = trySet ? Object.fromEntries(trySet.items.map((k) => [SHOP_BY_KEY.get(k)!.cat, k])) : {};
  const preview = { ...st.equipped, ...(trying ? { [trying.cat]: trying.key } : {}), ...setEq };
  const sty = chatStyle(preview);
  const first = (myName || "Você").split(" ")[0];
  const act = (fn: () => Promise<{ ok: boolean; message?: string; state?: ShopState }>) => start(async () => { const r = await fn(); if (r.state) setSt(r.state); toast(r.ok ? "ok" : "bad", r.message ?? ""); });
  const items = cat === "set" ? [] : SHOP.filter((i) => i.cat === cat && (!i.secret || st.owned.includes(i.key)));

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
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{trying ? `Experimentando: ${trying.name}` : trySet ? `Experimentando: conjunto ${trySet.name}` : "Como você aparece"}</p>
          {preview.banner && <div className="mb-2 h-10 rounded-lg" style={bannerStyle(preview.banner)} />}
          <p className="mb-1 px-1 text-[13px]"><span className={`font-medium ${sty.nameCls}`} style={sty.name}>{first}</span></p>
          <div style={sty.bubble ?? undefined} className={`inline-block max-w-full rounded-2xl rounded-tl-md px-3 py-2 text-sm ${sty.bubble ? "" : "bg-sunk"}`}>Bom dia, time! Bora bater a meta? 🚀</div>
        </div>
      </div>
      {(() => {
        const idle = CATEGORIES.filter((c) => !st.equipped[c.key] && SHOP.some((i) => i.cat === c.key && st.owned.includes(i.key)));
        if (!idle.length) return null;
        return (
          <div className="space-y-1.5 border-b border-line bg-accent/5 px-3 py-2 text-xs">
            <p className="flex items-center gap-1.5 font-semibold"><Sparkles size={13} className="text-accent" aria-hidden /> Você tem itens guardados — que tal usar?</p>
            <div className="flex flex-wrap gap-1.5">
              {idle.map((c) => { const mine = SHOP.find((i) => i.cat === c.key && st.owned.includes(i.key))!; return (
                <button key={c.key} type="button" disabled={pending} onClick={() => { setCat(c.key); act(() => equipItemAction(c.key, mine.key)); }} className="rounded-full border border-line bg-panel px-2.5 py-1 font-medium transition hover:border-accent">{c.label}: usar “{mine.name}”</button>
              ); })}
            </div>
          </div>
        );
      })()}
      <HScroll role="tablist" label="Categorias" className="flex gap-1 border-b border-line px-2 py-1.5">
        <button type="button" role="tab" aria-selected={cat === "set"} onClick={() => { setCat("set"); setTrying(null); }} className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${cat === "set" ? "bg-grad-soft text-accent" : "text-muted hover:bg-sunk"}`}><Gift size={12} aria-hidden /> Conjuntos</button>
        {CATEGORIES.map((c) => <button key={c.key} type="button" role="tab" aria-selected={cat === c.key} onClick={() => { setCat(c.key); setTrying(null); setTrySet(null); }} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${cat === c.key ? "bg-grad-soft text-accent" : "text-muted hover:bg-sunk"}`}>{c.label}</button>)}
      </HScroll>
      {cat === "set" ? (
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5" aria-label="Conjuntos">
          <li className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-muted"><Sparkles size={12} className="mr-1 inline text-accent" aria-hidden /> Cada conjunto traz banner, fonte, cor, efeito e balão no mesmo tema, com <b className="text-ink">{Math.round(SET_DISCOUNT * 100)}% de desconto</b> sobre as peças.</li>
          {SETS.map((set) => {
            const eq = Object.fromEntries(set.items.map((k) => [SHOP_BY_KEY.get(k)!.cat, k]));
            const sty = chatStyle(eq); const all = set.items.every((k) => st.owned.includes(k)); const worn = set.items.every((k) => st.equipped[SHOP_BY_KEY.get(k)!.cat] === k);
            const price = setPrice(set, st.owned); const sum = set.items.filter((k) => !st.owned.includes(k)).reduce((a, k) => a + SHOP_BY_KEY.get(k)!.price, 0); const afford = st.balance >= price;
            return (
              <li key={set.key} onMouseEnter={() => setTrySet(set)} onMouseLeave={() => setTrySet(null)} className={`overflow-hidden rounded-2xl border-2 bg-panel transition ${worn ? "border-accent" : "border-line hover:border-accent/50"}`} style={{ borderColor: worn ? undefined : `color-mix(in srgb, ${set.hex} 40%, transparent)` }}>
                <div className="relative h-16" style={bannerStyle(set.items[0])}><span className="absolute inset-x-3 bottom-1.5 flex items-center justify-between text-white drop-shadow"><b className="text-sm">{set.name}</b><span className="text-[11px]">{set.tagline}</span></span></div>
                <div className="space-y-2 p-3">
                  <div className="rounded-xl bg-sunk/60 p-2.5"><p className="mb-1 text-[13px]"><span className={`font-medium ${sty.nameCls}`} style={sty.name}>{first}</span></p><span style={sty.bubble ?? undefined} className="inline-block rounded-2xl rounded-tl-md px-3 py-1.5 text-xs">Bom dia, time! 🚀</span></div>
                  <ul className="flex flex-wrap gap-1 text-[10px]">{set.items.map((k) => { const it = SHOP_BY_KEY.get(k)!; const has = st.owned.includes(k); return <li key={k} className={`rounded-full border px-2 py-0.5 ${has ? "border-ok/50 bg-ok/10 text-ok" : "border-line text-muted"}`}>{has && <Check size={9} className="mr-0.5 inline" aria-hidden />}{it.name}</li>; })}</ul>
                  {all
                    ? <button type="button" disabled={pending || worn} onClick={() => act(() => equipSetAction(set.key))} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold ${worn ? "bg-ok/15 text-ok" : "bg-grad text-on-accent"}`}>{worn ? <><Check size={13} aria-hidden /> Conjunto em uso</> : "Vestir conjunto"}</button>
                    : <button type="button" disabled={pending || !afford} onClick={() => setBuyingSet(set)} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${afford ? "bg-grad text-on-accent hover:brightness-110" : "bg-sunk text-muted"}`}>{afford ? <Coins size={13} aria-hidden /> : <Lock size={13} aria-hidden />} Comprar conjunto · <s className="opacity-70">{nf.format(sum)}</s> <b className="figure">{nf.format(price)}</b></button>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
      <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-2.5">
        {st.equipped[cat] && <li className="col-span-2"><button type="button" disabled={pending} onClick={() => act(() => equipItemAction(cat, null))} className="w-full rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:bg-sunk">Tirar {CATEGORIES.find((c) => c.key === cat)!.label.toLowerCase()} (voltar ao padrão)</button></li>}
        {items.map((i) => {
          const owned = st.owned.includes(i.key), on = st.equipped[cat] === i.key, afford = st.balance >= i.price;
          const s = chatStyle({ [i.cat]: i.key });
          return (
            <li key={i.key} onMouseEnter={() => setTrying(i)} onMouseLeave={() => setTrying(null)} onFocus={() => setTrying(i)} onBlur={() => setTrying(null)} className={`flex flex-col gap-2 rounded-xl border p-2.5 transition ${on ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-accent/50"}`}>
              <div className="grid min-h-12 place-items-center overflow-hidden rounded-lg bg-sunk/60 px-1 py-2 text-center">
                {i.cat === "banner"
                  ? <span className="block h-12 w-full rounded-lg" style={bannerStyle(i.key)} />
                  : i.cat === "bubble"
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
      )}
      <ConfirmDialog open={!!buyingSet} icon={Gift} title={buyingSet ? `Comprar o conjunto “${buyingSet.name}”?` : ""} confirmLabel={buyingSet ? `Comprar por ${nf.format(setPrice(buyingSet, st.owned))} moedas` : "Comprar"} busy={pending}
        onCancel={() => setBuyingSet(null)} onConfirm={() => { const b = buyingSet; setBuyingSet(null); if (b) act(() => buySetAction(b.key)); }}>
        {buyingSet && <div className="space-y-2"><p>Você leva as {buyingSet.items.filter((k) => !st.owned.includes(k)).length} peças que ainda não tem e já veste tudo no perfil e no chat.</p><p>Saldo: <b className="figure text-ink">{nf.format(st.balance)}</b> → <b className="figure text-ink">{nf.format(st.balance - setPrice(buyingSet, st.owned))}</b> moedas</p></div>}
      </ConfirmDialog>
      <ConfirmDialog open={!!buying} icon={ShoppingBag} title={buying ? `Comprar “${buying.name}”?` : ""} confirmLabel={buying ? `Comprar por ${nf.format(buying.price)} moedas` : "Comprar"} busy={pending}
        onCancel={() => setBuying(null)} onConfirm={() => { const b = buying; setBuying(null); if (b) act(() => buyItemAction(b.key)); }}>
        {buying && (() => { const s = chatStyle({ [buying.cat]: buying.key }); return (
          <div className="space-y-3">
            <div className="grid min-h-14 place-items-center rounded-xl bg-sunk/60 px-3 py-3 text-center">
              {buying.cat === "banner" ? <span className="block h-16 w-full rounded-xl" style={bannerStyle(buying.key)} /> : buying.cat === "bubble" ? <span style={s.bubble ?? undefined} className="rounded-2xl px-3 py-1.5 text-sm text-ink">Bom dia, time!</span> : <span className={`text-lg font-semibold ${s.nameCls}`} style={s.name}>{first}</span>}
            </div>
            <p>Saldo: <b className="figure text-ink">{nf.format(st.balance)}</b> → <b className="figure text-ink">{nf.format(st.balance - buying.price)}</b> moedas</p>
          </div>); })()}
      </ConfirmDialog>
    </div>
  );
}
