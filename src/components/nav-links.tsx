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
export function NavLinks({ hrefs, vertical = false }: { hrefs: string[]; vertical?: boolean }) {
  const pathname = usePathname();
  const items = hrefs.map((h) => NAV.find((n) => n.href === h)).filter((n): n is (typeof NAV)[number] => !!n);
  return (
    <nav aria-label="Principal" className={vertical ? "flex flex-col gap-1" : "-mx-1 flex gap-1 overflow-x-auto"}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors ${vertical ? "py-2.5" : "py-2"} ${active ? "bg-accent/15 text-accent" : "text-muted hover:bg-sunk/70 hover:text-ink"}`}>
            <Pending Icon={Icon} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
