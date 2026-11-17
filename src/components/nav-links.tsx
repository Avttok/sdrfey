"use client";

import { ChevronDown, Ellipsis } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { NAV } from "@/config/nav";

function Pending({ Icon }: { Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner size={17} /> : <Icon size={17} aria-hidden />;
}

type Item = (typeof NAV)[number];

/** Itens do menu, na ordem recebida. `vertical` = barra lateral. Na barra de cima, itens “more” ficam no menu “Mais”. */
export function NavLinks({ hrefs, vertical = false, collapsed = false, badges = {} }: { hrefs: string[]; vertical?: boolean; collapsed?: boolean; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const all = hrefs.map((h) => NAV.find((n) => n.href === h)).filter((n): n is Item => !!n);
  const items = vertical ? all : all.filter((n) => !n.more);
  const more = vertical ? [] : all.filter((n) => n.more);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target instanceof Node) || !document.getElementById("nav-more")?.contains(e.target)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key); window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", close); };
  }, [open]);
  const link = (n: Item, inMenu = false) => {
    const { href, label, icon: Icon } = n;
    const active = isActive(href);
    return (
      <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}
        className={`flex items-center whitespace-nowrap rounded-xl text-sm font-medium transition-all ${collapsed ? "justify-center px-0 py-3" : `gap-2.5 px-3 ${vertical || inMenu ? "py-2.5" : "py-2"}`} ${active ? "bg-grad-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "text-muted hover:bg-sunk hover:text-ink"}`}>
        <span className="relative grid place-items-center">
          <Pending Icon={Icon} />
          {badges[href] ? <span aria-hidden className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full border-2 border-panel bg-danger" /> : null}
        </span>
        {!collapsed && label}
        {!collapsed && badges[href] ? <span className="figure ml-auto rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${badges[href]} avisos`}>{badges[href]}</span> : null}
      </Link>
    );
  };
  const moreActive = more.some((n) => isActive(n.href));
  return (
    <nav aria-label="Principal" className={vertical ? "flex flex-col gap-1" : "-mx-1 flex items-center gap-1 overflow-x-auto"}>
      {items.map((n) => link(n))}
      {more.length > 0 && (
        <div id="nav-more" className="shrink-0">
          <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open}
            onClick={() => { const r = btn.current?.getBoundingClientRect(); if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 232)), top: r.bottom + 6 }); setOpen(!open); }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all ${moreActive ? "bg-grad-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "text-muted hover:bg-sunk hover:text-ink"}`}>
            <Ellipsis size={17} aria-hidden />Mais<ChevronDown size={14} aria-hidden className={`transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div role="menu" style={{ left: pos.left, top: pos.top }} className="fixed z-50 w-56 space-y-0.5 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
              {more.map((n) => link(n, true))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
