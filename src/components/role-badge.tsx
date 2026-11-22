import { Handshake, Headset, ShieldCheck, ShieldHalf } from "lucide-react";
import { Term } from "@/components/terms";
import { ROLE_META, type Role } from "@/config/roles";

const DOT: Record<Role, string> = { user: "#3b82f6", seller: "#22c55e", manager: "#eab308", admin: "#ef4444" };

const ICON = { user: Headset, seller: Handshake, manager: ShieldHalf, admin: ShieldCheck } as const;

export function RoleBadge({ role }: { role: Role }) {
  const Icon = ICON[role];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunk text-ink px-2.5 py-0.5 text-xs font-medium">
      <Icon size={13} style={{ color: DOT[role] }} aria-hidden />
      <Term>{ROLE_META[role].label}</Term>
    </span>
  );
}
