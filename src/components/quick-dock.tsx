"use client";

import { BadgeDollarSign, ChevronDown, Loader2, Plus, Shuffle, ShieldCheck, CalendarCheck, Users, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { term } from "@/config/terms";
import { useT } from "@/components/terms";
import { startAction } from "@/modules/leads/actions";
import { startSalesShuffleAction } from "@/modules/sales/actions";

export const NEW_DEAL_EVENT = "fey:new-deal";
export const QUICK_SLOT_ID = "quick-slot";

/** Quais atalhos a pessoa tem (o servidor decide pelos cargos e permissões). */
export type QuickKey = "new-deal" | "shuffle" | "shuffle-sales" | "leads" | "visits" | "admin";
const META: Record<QuickKey, { label: string; icon: LucideIcon; tone?: "main" }> = {
  "new-deal": { label: "Nova negociação", icon: Plus, tone: "main" },
  shuffle: { label: term("shuffler_sdr"), icon: Shuffle, tone: "main" },
  "shuffle-sales": { label: term("shuffler_sales"), icon: BadgeDollarSign, tone: "main" },
  leads: { label: "Buscar lead", icon: Users },
  visits: { label: "Visitas", icon: CalendarCheck },
  admin: { label: "Painel Adm", icon: ShieldCheck },
};

const btn = "relative grid size-11 place-items-center rounded-full border shadow-lg transition hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const toneCls = (main?: boolean) => (main ? "border-transparent bg-grad text-on-accent" : "border-line bg-panel text-accent hover:border-accent");

function Tip({ children }: { children: string }) {
  return <span role="presentation" className="pointer-events-none absolute right-full top-1/2 mr-2.5 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-bg opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 max-sm:hidden">{children}</span>;
}

function SubmitBtn({ k }: { k: QuickKey }) {
  const { pending } = useFormStatus();
  const t = useT();
  const m = META[k];
  return (
    <button type="submit" disabled={pending} aria-label={t(m.label)} className={`${btn} ${toneCls(m.tone === "main")} disabled:opacity-70`}>
      {pending ? <Loader2 size={19} className="animate-spin" aria-hidden /> : <m.icon size={19} aria-hidden />}
    </button>
  );
}

/**
 * Barra de atalhos flutuante, empilhada acima do botão do chat. Cada cargo vê o que faz no dia a dia.
 * O botão "Centralizar" do roteiro entra no espaço `#quick-slot`, no topo da pilha (só aparece na etapa dos shufflers).
 */
export function QuickDock({ items, hasChat }: { items: QuickKey[]; hasChat: boolean }) {
  const t = useT();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("quick-dock") === "0") setOpen(false); } catch { /* sem armazenamento: fica aberta */ } }, []);
  const toggle = () => { setOpen((o) => { try { localStorage.setItem("quick-dock", o ? "0" : "1"); } catch { /* ok */ } return !o; }); };
  const visible = items.filter((k) => !(k === "shuffle" && path === "/atender") && !(k === "shuffle-sales" && path === "/shuffler-vendas") && !(k === "visits" && path === "/visitas") && !(k === "leads" && path === "/leads") && !(k === "admin" && path.startsWith("/admin")));
  const newDeal = () => { if (path === "/negociacoes") window.dispatchEvent(new Event(NEW_DEAL_EVENT)); else router.push("/negociacoes?novo=1"); };
  return (
    <div className={`pointer-events-none fixed right-5 z-30 flex flex-col-reverse items-end gap-2.5 ${hasChat ? "bottom-[5.25rem]" : "bottom-5"}`} role="toolbar" aria-label="Atalhos rápidos" aria-orientation="vertical">
      {open && visible.map((k) => {
        const m = META[k];
        const wrap = "group pointer-events-auto relative quick-pop";
        if (k === "shuffle") return <form key={k} action={startAction} className={wrap}><SubmitBtn k={k} /><Tip>{t(m.label)}</Tip></form>;
        if (k === "shuffle-sales") return <form key={k} action={startSalesShuffleAction} className={wrap}><SubmitBtn k={k} /><Tip>{t(m.label)}</Tip></form>;
        if (k === "new-deal") return <div key={k} className={wrap}><button type="button" onClick={newDeal} aria-label={t(m.label)} className={`${btn} ${toneCls(true)}`}><m.icon size={20} aria-hidden /></button><Tip>{t(m.label)}</Tip></div>;
        const href = k === "leads" ? "/leads" : k === "visits" ? "/visitas" : "/admin";
        return <div key={k} className={wrap}><Link href={href} aria-label={t(m.label)} className={`${btn} ${toneCls()}`}><m.icon size={19} aria-hidden /></Link><Tip>{t(m.label)}</Tip></div>;
      })}
      {/* espaço do "Centralizar" (portal do roteiro): fica colado no botão do chat */}
      <div id={QUICK_SLOT_ID} className="pointer-events-auto order-first flex flex-col items-end gap-2.5 empty:hidden" />
      {visible.length > 0 && (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? "Recolher atalhos" : "Mostrar atalhos"} title={open ? "Recolher atalhos" : "Atalhos rápidos"} className={`${btn} pointer-events-auto size-12 border-transparent bg-grad text-on-accent ${open ? "" : "ring-4 ring-accent/25"}`}>
          {open ? <ChevronDown size={20} aria-hidden /> : <Zap size={22} className="fill-current" aria-hidden />}
        </button>
      )}
    </div>
  );
}
