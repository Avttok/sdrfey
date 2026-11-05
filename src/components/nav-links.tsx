"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { NAV } from "@/config/nav";

function Pending({ Icon }: { Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner size={17} /> : <Icon size={17} aria-hidden />;
}

/** Itens do menu, na ordem recebida. `vertical` = barra lateral. */
export function NavLinks({ hrefs, vertical = false, collapsed = false }: { hrefs: string[]; vertical?: boolean; collapsed?: boolean }) {
  const pathname = usePathname();
  const items = hrefs.map((h) => NAV.find((n) => n.href === h)).filter((n): n is (typeof NAV)[number] => !!n);
  return (
    <nav aria-label="Principal" className={vertical ? "flex flex-col gap-1" : "-mx-1 flex gap-1 overflow-x-auto"}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined}
            className={`flex items-center whitespace-nowrap rounded-xl text-sm font-medium transition-all ${collapsed ? "justify-center px-0 py-3" : `gap-2.5 px-3 ${vertical ? "py-2.5" : "py-2"}`} ${active ? "bg-grad-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]" : "text-muted hover:bg-sunk/70 hover:text-ink"}`}>
            <Pending Icon={Icon} />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}
