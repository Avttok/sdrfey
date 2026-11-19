"use client";

import { ChevronDown } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { GROUP_ICONS, NAV } from "@/config/nav";
import { EMPTY_CUSTOM, NAV_ICONS, type NavCustom } from "@/config/nav-icons";

function Pending({ Icon }: { Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner size={17} /> : <Icon size={17} aria-hidden />;
}

type Item = (typeof NAV)[number];
type Entry = { kind: "link"; item: Item } | { kind: "menu"; label: string; items: Item[] };

/** Monta o menu: itens do mesmo grupo viram um menu; grupo com um item só vira link solto. */
function build(all: Item[], grouped: boolean): Entry[] {
  const out: Entry[] = [];
  const done = new Set<string>();
  for (const it of all) {
    if (!grouped || !it.group) { out.push({ kind: "link", item: it }); continue; }
    if (done.has(it.group)) continue;
    done.add(it.group);
    const items = all.filter((x) => x.group === it.group);
    out.push(items.length > 1 ? { kind: "menu", label: it.group, items } : { kind: "link", item: it });
  }
  return out;
}

/** Itens do menu, na ordem recebida. `vertical` = barra lateral. */
export function NavLinks({ hrefs, vertical = false, collapsed = false, badges = {}, grouped = true, custom = EMPTY_CUSTOM }: { custom?: NavCustom; hrefs: string[]; vertical?: boolean; collapsed?: boolean; badges?: Record<string, number>; grouped?: boolean }) {
  const pathname = usePathname();
  const all = hrefs.map((h) => NAV.find((n) => n.href === h)).filter((n): n is Item => !!n);
  const entries = build(all, grouped);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const [open, setOpen] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEffect(() => { setOpen(null); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target instanceof Node) || !document.getElementById("nav-menu")?.contains(e.target)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key); window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", close); };
  }, [open]);
  const gLabel = (g: string) => custom.groups[g]?.label ?? g;
  const link = (n: Item, inMenu = false) => {
    const { href } = n;
    const label = custom.items[href]?.label ?? n.label;
    const Icon = NAV_ICONS[custom.items[href]?.icon ?? ""] ?? n.icon;
    const active = isActive(href);
    return (
      <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}
        className={`nav-item flex items-center whitespace-nowrap rounded-xl text-sm font-medium transition-all ${collapsed ? "justify-center px-0 py-3" : `gap-2.5 px-3 ${vertical || inMenu ? "py-2.5" : "py-2"}`} ${active ? "bg-grad-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "text-muted hover:bg-sunk hover:text-ink"}`}>
        <span className="nav-ico relative grid place-items-center" data-ico={href.slice(1)}>
          <Pending Icon={Icon} />
          {badges[href] ? <span aria-hidden className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full border-2 border-panel bg-danger" /> : null}
        </span>
        {!collapsed && label}
        {!collapsed && badges[href] ? <span className="figure ml-auto rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${badges[href]} avisos`}>{badges[href]}</span> : null}
      </Link>
    );
  };
  const menu = (label: string, list: Item[]) => {
    const active = list.some((n) => isActive(n.href));
    const isOpen = open === label;
    const hasBadge = list.some((n) => badges[n.href]);
    return (
      <div key={label} id={isOpen ? "nav-menu" : undefined} className="shrink-0">
        <button type="button" aria-haspopup="menu" aria-expanded={isOpen}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 232)), top: r.bottom + 6 }); setOpen(isOpen ? null : label); }}
          className={`nav-item relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all ${active ? "bg-grad-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "text-muted hover:bg-sunk hover:text-ink"}`}>
          {(() => { const I = NAV_ICONS[custom.groups[label]?.icon ?? ""] ?? GROUP_ICONS[label]; return I ? <span className="nav-ico grid place-items-center" data-ico={`g-${label.toLowerCase()}`}><I size={17} aria-hidden /></span> : null; })()}{gLabel(label)}<ChevronDown size={14} aria-hidden className={`transition ${isOpen ? "rotate-180" : ""}`} />
          {hasBadge && <span aria-hidden className="absolute right-1 top-1 size-2 rounded-full border-2 border-panel bg-danger" />}
        </button>
        {isOpen && (
          <div role="menu" style={{ left: pos.left, top: pos.top }} className="fixed z-50 w-56 space-y-0.5 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
            {list.map((n) => link(n, true))}
          </div>
        )}
      </div>
    );
  };
  return (
    <nav aria-label="Principal" className={vertical ? "flex flex-col gap-1" : "-mx-1 flex items-center gap-1 overflow-x-auto"}>
      {entries.map((e) => e.kind === "link" ? link(e.item) : vertical
        ? (
          <div key={e.label} role="group" aria-label={gLabel(e.label)} className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            {!collapsed && <p className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{gLabel(e.label)}</p>}
            {e.items.map((n) => link(n))}
          </div>
        )
        : menu(e.label, e.items))}
    </nav>
  );
}
