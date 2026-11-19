"use client";

import { Home, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ADMIN_SECTIONS } from "@/config/admin-sections";

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Menu da área do Adm: busca rápida, grupos coloridos e a Central como início. */
export function AdminNav() {
  const path = usePathname();
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const sections = ADMIN_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !needle || norm(`${i.label} ${i.hint}`).includes(needle)) })).filter((s) => s.items.length);
  return (
    <nav aria-label="Administração" className="space-y-4 rounded-3xl border border-line bg-panel p-3 shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
      <label className="relative block"><Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na área Adm" aria-label="Buscar na área Adm" className="w-full rounded-xl border border-line bg-sunk py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent" /></label>
      {!needle && <Link href="/admin" aria-current={path === "/admin" ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${path === "/admin" ? "bg-grad text-on-accent shadow" : "hover:bg-sunk"}`}><span className={`grid size-8 place-items-center rounded-lg ${path === "/admin" ? "bg-white/20" : "bg-sunk"}`}><Home size={17} aria-hidden /></span><span className="text-sm font-semibold">Central do Adm</span></Link>}
      {sections.map((s) => (
        <div key={s.id}>
          <p className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted"><span aria-hidden className="size-1.5 rounded-full" style={{ background: s.hue }} />{s.title}</p>
          <ul className="grid gap-1 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {s.items.map(({ href, label, hint, icon: Icon }) => {
              const on = path === href || path.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link href={href} aria-current={on ? "page" : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2 transition ${on ? "bg-grad text-on-accent shadow-sm" : "hover:bg-sunk"}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg transition group-hover:scale-105 ${on ? "bg-white/20" : ""}`} style={on ? undefined : { background: `color-mix(in srgb, ${s.hue} 16%, transparent)`, color: s.hue }}><Icon size={17} aria-hidden /></span>
                    <span className="min-w-0 leading-tight"><span className="block text-sm font-medium">{label}</span><span className={`block truncate text-xs ${on ? "opacity-80" : "text-muted"}`}>{hint}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {!sections.length && <p className="px-2 py-4 text-center text-sm text-muted">Nada encontrado.</p>}
    </nav>
  );
}
