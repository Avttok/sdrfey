import { Activity, CalendarCheck, Contact, EyeOff, FlaskConical, Gauge, Handshake, History, Play, ScrollText, ShieldCheck, Target, Trash2, Upload, UserRound, Users, MapPin, Download, type LucideIcon } from "lucide-react";
import { kindOfText, type ActKind } from "@/config/activity";

const ICON: Record<ActKind, LucideIcon> = { attend: Play, deal: Handshake, lead: Users, visit: CalendarCheck, goal: Target, history: History, dash: Gauge, import: Upload, export: Download, admin: ShieldCheck, users: Contact, log: ScrollText, trash: Trash2, test: FlaskConical, account: UserRound, rep: MapPin, away: EyeOff, online: Activity };

/** Ícone que combina com a frase de atividade. */
export function ActivityIcon({ text, kind, size = 14, className }: { text?: string | null; kind?: ActKind; size?: number; className?: string }) {
  const I = ICON[kind ?? kindOfText(text)];
  return <I size={size} aria-hidden className={className} />;
}
