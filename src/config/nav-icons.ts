import { Activity, BarChart3, Bell, BookOpen, Briefcase, Building2, CalendarCheck, Compass, Contact, Crown, Flame, Gauge, Gift, Handshake, Headset, History, Info, LayoutGrid, Lightbulb, ListChecks, MapPin, MessageCircle, Phone, Play, Rocket, ScrollText, Settings2, Mail, ShieldCheck, ShieldHalf, Shuffle, Sparkles, Star, Target, Trophy, UserRound, Users, Wallet, Zap, type LucideIcon } from "lucide-react";
import { NAV } from "@/config/nav";

/** Ícones que o Adm pode escolher para abas e pastas do menu. A chave é o que fica guardado. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  gauge: Gauge, users: Users, contact: Contact, map: MapPin, target: Target, history: History, play: Play, shuffle: Shuffle, calendar: CalendarCheck,
  layoutgrid: LayoutGrid, handshake: Handshake, settings: Settings2, mail: Mail, scroll: ScrollText, shield: ShieldCheck, shieldhalf: ShieldHalf, info: Info, headset: Headset, user: UserRound, phone: Phone,
  chart: BarChart3, bell: Bell, book: BookOpen, briefcase: Briefcase, building: Building2, compass: Compass, crown: Crown, flame: Flame, gift: Gift,
  grid: LayoutGrid, idea: Lightbulb, list: ListChecks, chat: MessageCircle, rocket: Rocket, sparkles: Sparkles, star: Star, trophy: Trophy, wallet: Wallet, zap: Zap, activity: Activity,
};

export type NavCustom = { items: Record<string, { label?: string; icon?: string }>; groups: Record<string, { label?: string; icon?: string }> };
export const EMPTY_CUSTOM: NavCustom = { items: {}, groups: {} };

/** Mescla personalização global com a individual (a individual vence). */
export function mergeCustom(a?: Partial<NavCustom> | null, b?: Partial<NavCustom> | null): NavCustom {
  const m = (x?: NavCustom["items"], y?: NavCustom["items"]) => { const o: NavCustom["items"] = { ...(x ?? {}) }; for (const [k, v] of Object.entries(y ?? {})) o[k] = { ...o[k], ...v }; return o; };
  return { items: m(a?.items, b?.items), groups: m(a?.groups, b?.groups) };
}

/** Limpa o que veio de fora: só abas/pastas conhecidas, ícones do catálogo, nomes curtos. */
export function cleanCustom(input: unknown): NavCustom {
  const src = (input ?? {}) as Partial<NavCustom>;
  const knownGroups = new Set(NAV.map((n) => n.group).filter(Boolean) as string[]);
  const knownItems = new Set(NAV.map((n) => n.href));
  const clean = (rec: NavCustom["items"] | undefined, known: Set<string>) => {
    const out: NavCustom["items"] = {};
    for (const [k, v] of Object.entries(rec ?? {})) {
      if (!known.has(k) || !v || typeof v !== "object") continue;
      const label = typeof v.label === "string" ? v.label.trim().slice(0, 24) : "";
      const icon = typeof v.icon === "string" && v.icon in NAV_ICONS ? v.icon : "";
      if (label || icon) out[k] = { ...(label ? { label } : {}), ...(icon ? { icon } : {}) };
    }
    return out;
  };
  return { items: clean(src.items, knownItems), groups: clean(src.groups, knownGroups) };
}
