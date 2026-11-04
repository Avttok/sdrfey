"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/config/nav";

export function NavLinks({ hrefs }: { hrefs: string[] }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => hrefs.includes(item.href));

  return (
    <nav aria-label="Principal" className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-sunk text-ink" : "text-muted hover:bg-sunk/60 hover:text-ink"
            }`}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
