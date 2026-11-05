import { Gauge, History, Play, ScrollText, ShieldCheck, Target, UserRound, Users, MapPin, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string; adminOnly?: boolean };

/**
 * Menu do sistema. Para criar uma página nova: crie a pasta em src/app/(app)/ e acrescente uma linha aqui.
 * `perm` liga o item a uma permissão (config/permissions.ts); sem `perm`, todos veem.
 */
export const NAV: NavItem[] = [
  { href: "/painel", label: "Dashboard", icon: Gauge, perm: "tab.painel" },
  { href: "/atender", label: "Shufflar", icon: Play, perm: "tab.comecar" },
  { href: "/leads", label: "Leads", icon: Users, perm: "tab.leads" },
  { href: "/historico", label: "Histórico", icon: History, perm: "tab.historico" },
  { href: "/metas", label: "Metas", icon: Target, perm: "tab.metas" },
  { href: "/registro", label: "Registro", icon: ScrollText, perm: "tab.registro" },
  { href: "/representantes", label: "Representantes", icon: MapPin, perm: "tab.representantes" },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { href: "/conta", label: "Minha conta", icon: UserRound },
];

export function visibleNav(permissions: Record<string, boolean>, isAdmin: boolean): NavItem[] {
  return NAV.filter((i) => (i.adminOnly ? isAdmin : !i.perm || permissions[i.perm]));
}
