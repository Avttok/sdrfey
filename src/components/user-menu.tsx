"use client";

import { LogOut, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RoleBadge } from "@/components/role-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROLES, type Role } from "@/config/roles";
import { logoutAction } from "@/modules/auth/actions";
import { SubmitButton } from "./submit-button";

/** Foto (iniciais) da pessoa e as tags de cargo. Ao clicar abre o menu da conta. */
export function UserMenu({ name, username, hex, onHex, roles, side = false, collapsed = false }: { name: string; username: string; hex: string; onHex: string; roles: Role[]; side?: boolean; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const sorted = ROLES.filter((r) => roles.includes(r));
  const avatar = (size: string) => (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold shadow-sm ring-2 ring-white/40 ${size}`} style={{ backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${hex} 78%, white), ${hex} 50%, color-mix(in oklab, ${hex} 78%, black))`, color: onHex }}>{initials}</span>
  );
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Menu de ${name}`} title={collapsed ? name : undefined}
        className={side ? `flex w-full items-center rounded-xl py-2 text-left transition hover:bg-sunk ${collapsed ? "justify-center px-0" : "gap-3 px-2"}` : "rounded-full transition hover:scale-105 aria-expanded:ring-2 aria-expanded:ring-accent aria-expanded:ring-offset-2 aria-expanded:ring-offset-panel"}>
        {avatar(side ? "size-10 text-sm" : "size-10 text-sm")}
        {side && !collapsed && <span className="flex min-w-0 flex-1 flex-wrap gap-1">{sorted.map((r) => <RoleBadge key={r} role={r} />)}</span>}
      </button>
      {open && (
        <div role="menu" className={`pop-in absolute z-30 w-72 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl ${side ? (collapsed ? "bottom-0 left-14" : "bottom-14 left-0") : "right-0 top-13"}`}>
          <div className="relative overflow-hidden bg-grad px-4 pb-4 pt-5 text-on-accent">
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/15 blur-xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/25 text-lg font-bold ring-2 ring-white/60 backdrop-blur">{initials}</span>
              <div className="min-w-0"><p className="truncate text-base font-semibold leading-tight">{name}</p><p className="truncate text-xs opacity-80">@{username}</p></div>
            </div>
            <div className="relative mt-3 flex flex-wrap gap-1.5">{sorted.map((r) => <RoleBadge key={r} role={r} />)}</div>
          </div>
          <div className="space-y-1 p-2">
            <Link role="menuitem" href="/conta" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-sunk"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><Settings2 size={16} aria-hidden /></span> Minha conta</Link>
            <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"><span className="text-sm font-medium">Tema</span><ThemeToggle withLabels /></div>
          </div>
          <form action={logoutAction} className="border-t border-line p-2"><SubmitButton className="!w-full !bg-none !bg-transparent !text-danger hover:!bg-danger/10"><LogOut size={16} aria-hidden /> Sair</SubmitButton></form>
        </div>
      )}
    </div>
  );
}
