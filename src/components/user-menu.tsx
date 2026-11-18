"use client";

import { Check, LogOut, Palette, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RoleBadge } from "@/components/role-badge";
import { ThemeTile } from "@/components/theme-toggle";
import { ROLES, type Role } from "@/config/roles";
import { CHOOSABLE_ACCENTS, swatchBg } from "@/config/theme";
import { logoutAction } from "@/modules/auth/actions";
import { setAccentAction } from "@/modules/users/actions";
import { SubmitButton } from "./submit-button";

/** Foto (iniciais) da pessoa e as tags de cargo. Ao clicar abre o menu da conta. */
export function UserMenu({ name, username, hex, onHex, accentKey, roles, activity, side = false, collapsed = false }: { accentKey?: string; name: string; username: string; hex: string; onHex: string; roles: Role[]; activity?: string | null; side?: boolean; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect(); if (!r) return;
      const W = 320, m = 8;
      if (side) {
        const left = collapsed ? r.right + m : Math.min(Math.max(m, r.left), window.innerWidth - W - m);
        setPos(collapsed ? { left, bottom: Math.max(m, window.innerHeight - r.bottom) } : { left, bottom: window.innerHeight - r.top + m });
      } else setPos({ right: Math.max(m, window.innerWidth - r.right), top: r.bottom + m });
    };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, side, collapsed]);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !menu.current?.contains(t)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const sorted = ROLES.filter((r) => roles.includes(r));
  const h = new Date().getHours();
  const greeting = h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
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
      {open && mounted && createPortal(
        <div ref={menu} role="menu" style={pos} className="pop-in menu-stagger fixed z-[80] w-80 overflow-hidden rounded-3xl border border-line bg-panel shadow-[0_30px_80px_-20px_rgb(0_0_0/0.5)]">
          <div className="aurora relative overflow-hidden bg-grad px-5 pb-5 pt-6 text-on-accent">
            <span aria-hidden className="aurora-blob a" /><span aria-hidden className="aurora-blob b" /><span aria-hidden className="aurora-blob c" />
            <div className="relative flex items-center gap-4">
              <span className="avatar-ring relative grid size-[4.75rem] shrink-0 place-items-center rounded-full p-[3px]">
                <span className="grid size-full place-items-center rounded-full bg-black/30 text-2xl font-bold backdrop-blur-sm">{initials}</span>
                <span aria-hidden title="Online" className="absolute bottom-0.5 right-0.5 size-4 rounded-full border-2 border-white bg-ok shadow"><span className="absolute inset-0 animate-ping rounded-full bg-ok/70" /></span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium opacity-80">{greeting}</p>
                <p className="display truncate text-xl leading-tight">{name.split(" ")[0]}</p>
                <p className="truncate text-xs opacity-75">@{username}</p>
              </div>
            </div>
            <p className="relative mt-4 flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs font-medium backdrop-blur-sm" title={activity ? `Atendendo ${activity}` : "Disponível"}>
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${activity ? "animate-pulse bg-amber-300" : "bg-ok"}`} />
              <span className="min-w-0 truncate">{activity ? <>Atendendo <b>{activity}</b></> : "Disponível · sem atendimento aberto"}</span>
            </p>
            <div className="relative mt-3 flex flex-wrap gap-1.5">{sorted.map((r) => <RoleBadge key={r} role={r} />)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <Link role="menuitem" href="/conta" onClick={() => setOpen(false)} className="menu-tile group flex flex-col gap-2 rounded-2xl bg-sunk p-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-9 place-items-center rounded-xl bg-grad text-on-accent shadow-sm"><Settings2 size={17} aria-hidden className="transition-transform duration-500 group-hover:rotate-180" /></span>
              <span>Minha conta<span className="block text-xs font-normal text-muted">Senha, barra e fonte</span></span>
            </Link>
            <ThemeTile />
          </div>
          <form action={setAccentAction} className="px-4 pb-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Palette size={14} aria-hidden /> Cor do tema<span className="ml-auto text-xs font-normal text-muted">{CHOOSABLE_ACCENTS.find((a) => a.key === accentKey)?.label ?? "Padrão"}</span></p>
            <div className="grid grid-cols-7 gap-2">
              {CHOOSABLE_ACCENTS.map((a) => { const on = a.key === accentKey; return (
                <button key={a.key} type="submit" name="accent" value={a.key} title={a.label} aria-label={a.label} aria-pressed={on} className="swatch grid aspect-square place-items-center rounded-full text-white shadow-sm ring-offset-2 ring-offset-panel transition duration-200 hover:z-10 hover:scale-125 aria-pressed:ring-2 aria-pressed:ring-ink" style={{ background: swatchBg(a) }}>{on && <Check size={13} aria-hidden />}</button>
              ); })}
            </div>
          </form>
          <form action={logoutAction} className="border-t border-line p-2"><SubmitButton className="logout-btn group !w-full !bg-none !bg-transparent !text-danger hover:!bg-danger/10"><LogOut size={16} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" /> Sair da conta</SubmitButton></form>
        </div>,
        document.body,
      )}
    </div>
  );
}
