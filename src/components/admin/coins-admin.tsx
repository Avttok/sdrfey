"use client";

import { ChevronDown, Coins, Egg, Lock, LockOpen, Minus, Plus, ShoppingBag, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useRun } from "@/components/use-run";
import { revokeEggAction } from "@/modules/easter/admin";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { adjustCoinsAction, coinHistoryAction, setCoinsBlockAction, setCoinRewardsAction, setCoinsGlobalAction } from "@/modules/coins/admin";

export type CoinRow = { id: number; name: string; username: string; accent: string | null; roles: string[]; egg: boolean; earnBlocked: boolean; spendBlocked: boolean; balance: number; earned: number; spent: number };
type Hist = { id: number; amount: number; reason: string; at: string }[];

function Switch({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-grad" : "border border-line bg-sunk"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.45rem]" : "left-0.5"}`} /></button>;
}

function Row({ r }: { r: CoinRow }) {
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(10);
  const [why, setWhy] = useState("");
  const [hist, setHist] = useState<Hist | null>(null);
  const toggleOpen = () => { const n = !open; setOpen(n); if (n) void coinHistoryAction(r.id).then(setHist); };
  const adj = (mode: "add" | "set", value: number) => run(() => adjustCoinsAction(r.id, { mode, value, reason: why }), undefined, () => { setWhy(""); void coinHistoryAction(r.id).then(setHist); });
  return (
    <li className="px-4 py-3">
      {dialog}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.name}</p><p className="text-xs text-muted">@{r.username}</p></div>
        <div className="figure text-right"><p className="inline-flex items-center gap-1.5 text-xl font-bold"><Coins size={17} className="text-accent" aria-hidden />{r.balance.toLocaleString("pt-BR")}</p><p className="text-[11px] text-muted">+{r.earned.toLocaleString("pt-BR")} · −{r.spent.toLocaleString("pt-BR")}</p></div>
        <label className="flex items-center gap-2 text-xs"><span className={r.earnBlocked ? "font-semibold text-danger" : "text-muted"}>{r.earnBlocked ? "Ganho bloqueado" : "Pode ganhar"}</span><Switch on={!r.earnBlocked} label={`Ganho de moedas de ${r.name}`} disabled={pending} onClick={() => run(() => setCoinsBlockAction(r.id, "earn", !r.earnBlocked))} /></label>
        <label className="flex items-center gap-2 text-xs"><span className={r.spendBlocked ? "font-semibold text-danger" : "text-muted"}>{r.spendBlocked ? "Gasto bloqueado" : "Pode gastar"}</span><Switch on={!r.spendBlocked} label={`Gasto de moedas de ${r.name}`} disabled={pending} onClick={() => run(() => setCoinsBlockAction(r.id, "spend", !r.spendBlocked))} /></label>
        <button type="button" onClick={toggleOpen} aria-expanded={open} className={btnGhost}>Ajustar <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} aria-hidden /></button>
      </div>
      {open && (
        <div className="fx-rise mt-3 grid gap-4 rounded-2xl border border-line bg-sunk/60 p-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="block w-32 text-sm"><span className="mb-1 block text-muted">Quantidade</span><input type="number" className={inputCls} value={val} onChange={(e) => setVal(Number(e.target.value))} /></label>
              <label className="block min-w-40 flex-1 text-sm"><span className="mb-1 block text-muted">Motivo (opcional)</span><input className={inputCls} value={why} maxLength={120} onChange={(e) => setWhy(e.target.value)} placeholder="Ex.: bônus da reunião" /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={pending} onClick={() => adj("add", Math.abs(val))}><Plus size={15} aria-hidden /> Dar</button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => adj("add", -Math.abs(val))}><Minus size={15} aria-hidden /> Tirar</button>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => adj("set", val)}>Definir saldo = {val}</button>
              <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => adj("set", 0)}>Zerar</button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">Extrato recente</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {hist?.map((h) => <li key={h.id} className="flex justify-between gap-3"><span className="min-w-0 truncate text-muted">{h.reason}</span><span className={`figure shrink-0 font-semibold ${h.amount < 0 ? "text-danger" : "text-accent"}`}>{h.amount > 0 ? "+" : ""}{h.amount}</span></li>)}
              {hist && !hist.length && <li className="text-muted">Sem movimentos.</li>}{!hist && <li className="text-muted">Carregando…</li>}
            </ul>
          </div>
          {r.egg && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 lg:col-span-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f5c542] text-[#3b2a00]"><Egg size={17} aria-hidden /></span>
              <p className="min-w-48 flex-1 text-sm"><b className="font-semibold">Douradovo concluído</b><span className="block text-xs text-muted">A pessoa achou o segredo. Remover o status faz ela perder o acesso ao mural “Estive aqui” e poder refazer a jornada.</span></p>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => ask({ title: `Remover o Douradovo de ${r.name}?`, body: "Só o status: ela mantém as moedas e os itens que já ganhou, perde o post-it do mural e pode refazer a jornada.", label: "Remover só o status", tone: "warn", onConfirm: () => run(() => revokeEggAction(r.id, false)) })}>Remover só o status</button>
              <button type="button" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: `Remover tudo do Douradovo de ${r.name}?`, body: "Tira o status, as 1.000 moedas, os 4 itens exclusivos da loja (desequipando-os) e o post-it do mural. Não dá para desfazer.", label: "Sim, remover tudo", tone: "danger", onConfirm: () => run(() => revokeEggAction(r.id, true)) })}>Remover tudo</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const REWARD_FIELDS = [["coin_attended", "Lead atendido"], ["coin_visit", "Visita agendada"], ["coin_deal", "Negociação aberta"], ["coin_quote", "Cotação enviada"], ["coin_billed", "Venda faturada"], ["coin_shuffled", "Inativo trabalhado"]] as const;
type RewardVals = Record<(typeof REWARD_FIELDS)[number][0], number>;

function Rewards({ initial }: { initial: RewardVals }) {
  const { run, pending } = useRun();
  const [v, setV] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  return (
    <section className={`${panelCls} p-4`}>
      <h2 className="font-semibold">Quanto cada feito paga</h2>
      <p className="mb-3 text-xs text-muted">Vale para os próximos feitos; o que já foi pago não muda. As conquistas têm valor fixo pela dificuldade.</p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {REWARD_FIELDS.map(([k, label]) => <label key={k} className="block text-sm"><span className="mb-1 block text-muted">{label}</span><input type="number" min={0} max={1000} className={inputCls} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /></label>)}
      </div>
      <div className="mt-3 flex gap-2"><button type="button" className={btnPrimary} disabled={!dirty || pending} onClick={() => run(() => setCoinRewardsAction(v))}>Salvar valores</button>{dirty && <button type="button" className={btnGhost} onClick={() => setV(initial)}>Descartar</button>}</div>
    </section>
  );
}

export function CoinsAdmin({ rows, earnOn, spendOn, rewards }: { rows: CoinRow[]; earnOn: boolean; spendOn: boolean; rewards: RewardVals }) {
  const { run, pending } = useRun();
  const total = rows.reduce((a, r) => a + r.balance, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${panelCls} stat-glow lift card-in p-4`}><p className="text-xs text-muted">Moedas com a equipe</p><p className="figure mt-1 flex items-center gap-2 text-3xl font-bold"><Coins size={24} className="text-accent" aria-hidden />{total.toLocaleString("pt-BR")}</p></div>
        <div className={`${panelCls} lift card-in flex items-center gap-3 p-4`} style={{ "--i": 1 } as React.CSSProperties}><span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><TrendingUp size={18} aria-hidden /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Ganho de moedas (todos)</p><p className="text-xs text-muted">{earnOn ? "Ligado" : "Desligado: feitos novos valem 0"}</p></div><Switch on={earnOn} label="Ganho de moedas para todos" disabled={pending} onClick={() => run(() => setCoinsGlobalAction("earn", !earnOn))} /></div>
        <div className={`${panelCls} lift card-in flex items-center gap-3 p-4`} style={{ "--i": 2 } as React.CSSProperties}><span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><ShoppingBag size={18} aria-hidden /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Gasto na loja (todos)</p><p className="text-xs text-muted">{spendOn ? "Ligado" : "Desligado: ninguém compra"}</p></div><Switch on={spendOn} label="Gasto de moedas para todos" disabled={pending} onClick={() => run(() => setCoinsGlobalAction("spend", !spendOn))} /></div>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted"><Lock size={13} aria-hidden /> Com o ganho bloqueado, os feitos do período ficam registrados com 0 moedas: ao liberar de novo, o passado não é pago.<LockOpen size={13} className="ml-2" aria-hidden /> Os ajustes aparecem no extrato e no registro do sistema.</p>
      <Rewards initial={rewards} />
      <section className={`${panelCls} overflow-hidden`}><ul className="divide-y divide-line/70">{rows.map((r) => <Row key={r.id} r={r} />)}</ul></section>
    </div>
  );
}
