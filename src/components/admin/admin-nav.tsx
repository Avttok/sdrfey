"use client";

import { Clock, Archive, Download, Eraser, FlaskConical, Handshake, KeyRound, Mail, Settings2, Tags, Upload, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { title: string; items: { href: string; label: string; hint: string; icon: LucideIcon }[] }[] = [
  { title: "Pessoas e acesso", items: [
    { href: "/admin/usuarios", label: "Usuários", hint: "Contas, cargos e bloqueios", icon: Users },
    { href: "/admin/permissoes", label: "Permissões", hint: "Quem vê e faz o quê", icon: KeyRound },
  ] },
  { title: "Vendas", items: [
    { href: "/admin/vendas", label: "Condições e produtos", hint: "Pagamento e catálogo", icon: Handshake },
    { href: "/admin/negociacoes-apagadas", label: "Apagadas", hint: "Negociações apagadas/resetadas", icon: Archive },
  ] },
  { title: "Conteúdo", items: [
    { href: "/admin/tags", label: "Tags", hint: "Nomes, cores e ordem", icon: Tags },
    { href: "/admin/modelos", label: "Modelos de e-mail", hint: "Textos prontos", icon: Mail },
    { href: "/admin/importar", label: "Importar CSV", hint: "Leads e representantes", icon: Upload },
    { href: "/admin/exportar", label: "Exportar / backup", hint: "Baixar o banco com segurança", icon: Download },
    { href: "/admin/apagar", label: "Apagar", hint: "Excluir dados com segurança", icon: Eraser },
  ] },
  { title: "Sistema", items: [
    { href: "/admin/parametros", label: "Parâmetros", hint: "Regras do sorteio", icon: Settings2 },
    { href: "/admin/ao-vivo", label: "Ao vivo", hint: "Quem está online", icon: Clock },
    { href: "/admin/modo-teste", label: "Modo teste", hint: "Treinar sem sujar dados", icon: FlaskConical },
  ] },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Administração" className="space-y-4 rounded-2xl border border-line bg-panel p-3 lg:sticky lg:top-20 lg:self-start">
      {SECTIONS.map((s) => (
        <div key={s.title}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{s.title}</p>
          <ul className="grid gap-1 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {s.items.map(({ href, label, hint, icon: Icon }) => {
              const on = path === href || path.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link href={href} aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${on ? "bg-grad text-on-accent shadow-sm" : "hover:bg-sunk"}`}>
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${on ? "bg-white/20" : "bg-sunk"}`}><Icon size={17} aria-hidden /></span>
                    <span className="min-w-0 leading-tight"><span className="block text-sm font-medium">{label}</span><span className={`block truncate text-xs ${on ? "opacity-80" : "text-muted"}`}>{hint}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
