"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RoleBadge } from "@/components/role-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@/config/roles";
import { logoutAction } from "@/modules/auth/actions";
import { SubmitButton } from "./submit-button";

/** Bolinha com as iniciais; ao clicar abre Minha conta, Tema e Sair. */
export function UserMenu({ name, hex, onHex, role, side = false }: { name: string; hex: string; onHex: string; role: Role; side?: boolean }) {
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
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Menu de ${name}`}
        className={side ? "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-sunk" : "flex size-10 items-center justify-center rounded-full text-sm font-bold ring-offset-2 ring-offset-panel transition hover:scale-105 aria-expanded:ring-2 aria-expanded:ring-ink"}
        style={side ? undefined : { background: hex, color: onHex }}>
        {side ? <><span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: hex, color: onHex }}>{initials}</span><span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium">{name}</span><span className="text-xs text-muted">Minha conta e tema</span></span></> : initials}
      </button>
      {open && (
        <div role="menu" className={`absolute z-30 w-64 space-y-3 rounded-xl border border-line bg-panel p-3 shadow-xl ${side ? "bottom-14 left-0" : "right-0 top-12"}`}>
          <div className="flex items-center gap-3 border-b border-line pb-3">
            <span className="flex size-9 items-center justify-center rounded-full text-xs font-bold" style={{ background: hex, color: onHex }}>{initials}</span>
            <div className="leading-tight"><p className="font-medium">{name}</p><div className="mt-1"><RoleBadge role={role} /></div></div>
          </div>
          <Link role="menuitem" href="/conta" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-sunk"><UserRound size={16} aria-hidden /> Minha conta</Link>
          <div><p className="mb-1.5 px-2 text-xs font-medium text-muted">Tema</p><ThemeToggle withLabels /></div>
          <form action={logoutAction} className="border-t border-line pt-3"><SubmitButton className="!w-full !bg-transparent !text-danger border border-line hover:!bg-sunk"><LogOut size={16} aria-hidden /> Sair</SubmitButton></form>
        </div>
      )}
    </div>
  );
}
