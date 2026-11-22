import { term } from "@/config/terms";
import { LayoutGrid, Gauge, Headset, Info, ShieldHalf, Contact, History, Play, CalendarCheck, ScrollText, ShieldCheck, Target, UserRound, Users, MapPin, Handshake, FileSpreadsheet, Filter, Mail, Truck, ScrollText as ScriptIcon, Settings2, Download, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string; adminOnly?: boolean; /** Menu a que pertence. Menu com um item só aparece como link solto; sem grupo = link solto. */ group?: string };

/**
 * Menu do sistema. Para criar uma página nova: crie a pasta em src/app/(app)/ e acrescente uma linha aqui.
 * `perm` liga o item a uma permissão (config/permissions.ts); sem `perm`, todos veem.
 */
/** Ícone de cada menu (grupo) da barra. */
export const GROUP_ICONS: Record<string, LucideIcon> = { Mais: LayoutGrid, Sistema: ShieldCheck, Pessoas: Contact, Info: Info, SDR: Headset, Vendas: Handshake, "Opções": Settings2, "Gestão": ShieldHalf };

export const NAV: NavItem[] = [
  { href: "/painel", label: term("dashboard"), icon: Gauge, perm: "tab.painel" },
  { href: "/atender", label: term("shuffler_sdr"), icon: Play, perm: "tab.comecar", group: term("sdr") },
  { href: "/lista-flow", label: term("lista_flow"), icon: Filter, perm: "tab.lista_flow", group: term("sdr") },
  { href: "/visitas", label: term("visitas"), icon: CalendarCheck, perm: "tab.visitas", group: term("sdr") },
  { href: "/metas", label: term("metas"), icon: Target, perm: "tab.metas", group: term("sdr") },
  { href: "/historico", label: term("historico"), icon: History, perm: "tab.historico", group: term("sdr") },
  { href: "/desempenho", label: term("desempenho"), icon: FileSpreadsheet, perm: "tab.desempenho", group: term("sdr") },
  { href: "/negociacoes", label: term("negociacoes"), icon: Handshake, perm: "tab.negociacoes", group: term("vendas") },
  { href: "/shuffler-vendas", label: term("shuffler_sales"), icon: Play, perm: "tab.shuffler_vendas", group: term("vendas") },
  { href: "/lista-flow-vendas", label: term("lista_flow"), icon: Filter, perm: "tab.lista_flow_vendas", group: term("vendas") },
  { href: "/metas-vendas", label: term("metas"), icon: Target, perm: "tab.metas_vendas", group: term("vendas") },
  { href: "/historico-vendas", label: term("historico"), icon: History, perm: "tab.historico_vendas", group: term("vendas") },
  { href: "/desempenho-vendas", label: term("desempenho"), icon: FileSpreadsheet, perm: "tab.desempenho_vendas", group: term("vendas") },
  { href: "/leads", label: term("leads"), icon: Users, perm: "tab.leads", group: term("pessoas") },
  { href: "/representantes", label: term("representantes"), icon: MapPin, perm: "tab.representantes", group: term("pessoas") },
  { href: "/transportadoras", label: term("transportadoras"), icon: Truck, perm: "tab.transportadoras", group: term("pessoas") },
  { href: "/email", label: term("modelos_email"), icon: Mail, perm: "tab.email", group: term("mais") },
  { href: "/scripts", label: term("modelos_script"), icon: ScriptIcon, perm: "tab.scripts", group: term("mais") },
  { href: "/exportar", label: term("exportar"), icon: Download, perm: "tab.exportar", group: term("sistema") },
  { href: "/registro", label: term("registro"), icon: ScrollText, perm: "tab.registro", group: term("sistema") },
  { href: "/admin", label: term("painel_adm"), icon: ShieldCheck, adminOnly: true, group: term("sistema") },
  { href: "/conta", label: term("minha_conta"), icon: UserRound },
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
