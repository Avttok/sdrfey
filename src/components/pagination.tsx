import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";

/** Lista de páginas com reticências: 1 … 4 5 [6] 7 8 … 76. */
export function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  if (page <= 3) { set.add(3); set.add(4); }
  if (page >= pages - 2) { set.add(pages - 2); set.add(pages - 3); }
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}

const base = "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-medium transition";
const idle = `${base} border-line/70 bg-panel/70 text-ink hover:border-accent/60 hover:text-accent`;
const off = `${base} cursor-not-allowed border-line/40 bg-panel/40 text-muted/50`;

/** Paginação padrão do sistema: « ‹ 1 … 4 [5] 6 … 76 › ». */
export function Pagination({ page, pages, href, total, label = "resultados" }: { page: number; pages: number; href: (n: number) => string; total?: number; label?: string }) {
  if (pages <= 1) return null;
  const Nav = ({ to, off: dis, children, name }: { to: number; off: boolean; children: React.ReactNode; name: string }) =>
    dis ? <span aria-hidden className={off}>{children}</span> : <Link prefetch={false} href={href(to)} aria-label={name} className={idle}>{children}</Link>;
  return (
    <nav aria-label="Páginas" className="flex flex-col items-center gap-2 pt-2">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li><Nav to={1} off={page <= 1} name="Primeira página"><ChevronsLeft size={16} /></Nav></li>
        <li><Nav to={page - 1} off={page <= 1} name="Página anterior"><ChevronLeft size={16} /></Nav></li>
        {pageList(page, pages).map((n, i) => (
          <li key={`${n}-${i}`}>
            {n === "…" ? <span className="grid h-9 min-w-6 place-items-center text-muted">…</span>
              : n === page ? <span aria-current="page" className={`${base} figure border-transparent bg-grad text-on-accent shadow-md shadow-accent/25`}>{n}</span>
              : <Link prefetch={false} href={href(n)} className={`${idle} figure`}>{n}</Link>}
          </li>
        ))}
        <li><Nav to={page + 1} off={page >= pages} name="Próxima página"><ChevronRight size={16} /></Nav></li>
        <li><Nav to={pages} off={page >= pages} name="Última página"><ChevronsRight size={16} /></Nav></li>
      </ul>
      <p className="text-xs text-muted">Página {page} de {pages}{total != null ? ` · ${new Intl.NumberFormat("pt-BR").format(total)} ${label}` : ""}</p>
    </nav>
  );
}
