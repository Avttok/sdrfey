import { Gauge, Headset, Info, ShieldHalf, Contact, History, Play, CalendarCheck, ScrollText, ShieldCheck, Target, UserRound, Users, MapPin, Handshake, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string; adminOnly?: boolean; /** Menu a que pertence. Menu com um item só aparece como link solto; sem grupo = link solto. */ group?: string };

/**
 * Menu do sistema. Para criar uma página nova: crie a pasta em src/app/(app)/ e acrescente uma linha aqui.
 * `perm` liga o item a uma permissão (config/permissions.ts); sem `perm`, todos veem.
 */
/** Ícone de cada menu (grupo) da barra. */
export const GROUP_ICONS: Record<string, LucideIcon> = { Pessoas: Contact, Info: Info, SDR: Headset, Vendas: Handshake, "Gestão": ShieldHalf };

export const NAV: NavItem[] = [
  { href: "/painel", label: "Dashboard", icon: Gauge, perm: "tab.painel" },
  { href: "/leads", label: "Leads", icon: Users, perm: "tab.leads", group: "Pessoas" },
  { href: "/representantes", label: "Representantes", icon: MapPin, perm: "tab.representantes", group: "Pessoas" },
  { href: "/metas", label: "Metas", icon: Target, perm: "tab.metas", group: "Info" },
  { href: "/historico", label: "Histórico", icon: History, perm: "tab.historico", group: "Info" },
  { href: "/atender", label: "Shuffler", icon: Play, perm: "tab.comecar", group: "SDR" },
  { href: "/visitas", label: "Visitas", icon: CalendarCheck, perm: "tab.visitas", group: "SDR" },
  { href: "/negociacoes", label: "Negociações", icon: Handshake, perm: "tab.negociacoes", group: "Vendas" },
  { href: "/shuffler-vendas", label: "Shuffler", icon: Play, perm: "tab.shuffler_vendas", group: "Vendas" },
  { href: "/registro", label: "Registro", icon: ScrollText, perm: "tab.registro", group: "Gestão" },
  { href: "/admin", label: "Adm", icon: ShieldCheck, adminOnly: true, group: "Gestão" },
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
