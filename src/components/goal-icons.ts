import { CalendarCheck, Handshake, Phone, PhoneCall, type LucideIcon } from "lucide-react";
import type { GoalKind } from "@/modules/settings/goals";

/** Ícone de cada meta do SDR (fora dos componentes de cliente, para servidor e cliente poderem usar). */
export const KIND_ICON: Record<GoalKind, LucideIcon> = { attended: PhoneCall, scheduled: CalendarCheck, calls: Phone, converted: Handshake };
