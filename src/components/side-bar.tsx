"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/config/roles";
import { setNavCollapsedAction } from "@/modules/users/actions";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";

/** Barra vertical à esquerda (só em telas largas). Pode ser recolhida para mostrar só os ícones e a foto. */
export function SideBar({ hrefs, name, username, hex, onHex, roles, initialCollapsed, badges = {}, grouped = true }: { grouped?: boolean; badges?: Record<string, number>; hrefs: string[]; name: string; username: string; hex: string; onHex: string; roles: Role[]; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => { const next = !collapsed; setCollapsed(next); void setNavCollapsedAction(next); };
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 border-r border-line bg-panel px-3 py-5 transition-[width] duration-200 lg:flex ${collapsed ? "w-[4.75rem]" : "w-64"}`}>
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-3"}`}>
        {collapsed ? <Link href="/painel" aria-label="SDR FEY, ir para o início" className="grid size-10 place-items-center rounded-xl text-sm font-black text-white shadow-md" style={{ backgroundImage: "linear-gradient(135deg, #ef4444, #D7191F 45%, #9f1239)" }}>SF</Link> : <Link href="/painel" aria-label="SDR FEY, ir para o início"><Logo /></Link>}
        <button type="button" onClick={toggle} aria-label={collapsed ? "Expandir barra" : "Minimizar barra"} title={collapsed ? "Expandir barra" : "Minimizar barra"} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-sunk hover:text-ink"><Icon size={18} aria-hidden /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><NavLinks hrefs={hrefs} vertical collapsed={collapsed} badges={badges} grouped={grouped} /></div>
      <div className="border-t border-line pt-4"><UserMenu side collapsed={collapsed} name={name} username={username} hex={hex} onHex={onHex} roles={roles} /></div>
    </aside>
  );
}
