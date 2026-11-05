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

/**
 * Aplica a ordem escolhida pela pessoa. Itens que ela nunca ordenou (abas novas) entram logo depois
 * do item que vem antes deles no menu padrão, e não no fim.
 */
export function orderNav<T extends { href: string }>(items: T[], order: readonly string[]): T[] {
  const result = items.filter((i) => order.includes(i.href)).sort((a, b) => order.indexOf(a.href) - order.indexOf(b.href));
  const defaults = NAV.map((n) => n.href);
  for (const item of items.filter((i) => !order.includes(i.href))) {
    const pos = defaults.indexOf(item.href);
    let at = -1;
    for (let k = pos - 1; k >= 0 && at === -1; k--) at = result.findIndex((r) => r.href === defaults[k]);
    result.splice(at + 1, 0, item);
  }
  return result;
}

export function visibleNav(permissions: Record<string, boolean>, isAdmin: boolean): NavItem[] {
  return NAV.filter((i) => (i.adminOnly ? isAdmin : !i.perm || permissions[i.perm]));
}
