"use client";

import { Flame, Gem, Map as MapIcon, Phone, Rocket, Star, Target, Truck, Wrench, Zap, type LucideIcon } from "lucide-react";

/** Ícones que a pessoa escolhe para a carta da lista. */
export const LIST_ICONS: Record<string, LucideIcon> = { target: Target, flame: Flame, phone: Phone, star: Star, rocket: Rocket, truck: Truck, wrench: Wrench, map: MapIcon, gem: Gem, zap: Zap };
export const listIcon = (key?: string): LucideIcon => LIST_ICONS[key ?? ""] ?? Target;
