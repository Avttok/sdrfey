import { Gauge, History, Play, CalendarCheck, ScrollText, ShieldCheck, Target, UserRound, Users, MapPin, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string; adminOnly?: boolean };

/**
 * Menu do sistema. Para criar uma página nova: crie a pasta em src/app/(app)/ e acrescente uma linha aqui.
 * `perm` liga o item a uma permissão (config/permissions.ts); sem `perm`, todos veem.
 */
export const NAV: NavItem[] = [
  { href: "/painel", label: "Dashboard", icon: Gauge, perm: "tab.painel" },
  { href: "/atender", label: "Shuffler", icon: Play, perm: "tab.comecar" },
  { href: "/leads", label: "Leads", icon: Users, perm: "tab.leads" },
  { href: "/historico", label: "Histórico", icon: History, perm: "tab.historico" },
  { href: "/visitas", label: "Visitas", icon: CalendarCheck, perm: "tab.visitas" },
  { href: "/metas", label: "Metas", icon: Target, perm: "tab.metas" },
  { href: "/registro", label: "Registro", icon: ScrollText, perm: "tab.registro" },
  { href: "/representantes", label: "Representantes", icon: MapPin, perm: "tab.representantes" },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { href: "/conta", label: "Minha conta", icon: UserRound },
];

/** Aplica a ordem escolhida pela pessoa; itens que ela não ordenou vão ao fim na ordem padrão. */
export function orderNav<T extends { href: string }>(items: T[], order: readonly string[]): T[] {
  const rank = (h: string) => { const i = order.indexOf(h); return i === -1 ? order.length + NAV.findIndex((n) => n.href === h) : i; };
  return [...items].sort((a, b) => rank(a.href) - rank(b.href));
}

export function visibleNav(permissions: Record<string, boolean>, isAdmin: boolean): NavItem[] {
  return NAV.filter((i) => (i.adminOnly ? isAdmin : !i.perm || permissions[i.perm]));
}
