import { ROLE_META, type Role } from "@/config/roles";

const DOT: Record<Role, string> = { user: "#3b82f6", seller: "#22c55e", manager: "#eab308", admin: "#ef4444" };

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunk text-ink px-2.5 py-0.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ background: DOT[role] }} aria-hidden />
      {ROLE_META[role].label}
    </span>
  );
}
