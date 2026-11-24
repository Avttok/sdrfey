"use client";

import type { NavTree } from "@/config/nav-tree";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Role } from "@/config/roles";
import { setNavCollapsedAction } from "@/modules/users/actions";
import type { NavCustom } from "@/config/nav-icons";
import { Logo } from "./logo";
import { MorphMark } from "./logo-morph";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { GlobalSearch } from "./global-search";

/** Barra vertical à esquerda (só em telas largas). Pode ser recolhida para mostrar só os ícones e a foto. */
export function SideBar({ hrefs, name, username, hex, onHex, accentKey, roles, isAdmin, avatar, banner, initialCollapsed, badges = {}, grouped = true, custom, tree }: { isAdmin?: boolean; tree?: NavTree | null; banner?: string | null; avatar?: string | null; custom?: NavCustom; accentKey?: string;  grouped?: boolean; badges?: Record<string, number>; hrefs: string[]; name: string; username: string; hex: string; onHex: string; roles: Role[]; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => { const next = !collapsed; setCollapsed(next); void setNavCollapsedAction(next); };
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-5 border-r border-line bg-panel px-3 py-5 transition-[width] duration-200 lg:flex ${collapsed ? "w-[4.75rem]" : "w-64"}`}>
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-3"}`}>
        {collapsed ? <Link href="/painel" aria-label="SDR FEY, ir para o início" className="grid size-10 place-items-center rounded-xl"><MorphMark size={30} /></Link> : <Link href="/painel" aria-label="SDR FEY, ir para o início" className="flex items-center"><Logo /></Link>}
        <button type="button" onClick={toggle} aria-label={collapsed ? "Expandir barra" : "Minimizar barra"} title={collapsed ? "Expandir barra" : "Minimizar barra"} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-sunk hover:text-ink"><Icon size={18} aria-hidden /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><NavLinks hrefs={hrefs} vertical collapsed={collapsed} badges={badges} grouped={grouped} custom={custom} tree={tree} /></div>
      <div className="flex items-center gap-2 border-t border-line pt-4"><GlobalSearch side /><NotificationBell side /><div className="min-w-0 flex-1"><UserMenu side collapsed={collapsed} name={name} username={username} hex={hex} onHex={onHex} accentKey={accentKey} roles={roles} isAdmin={isAdmin} avatar={avatar} banner={banner} /></div></div>
    </aside>
  );
}
