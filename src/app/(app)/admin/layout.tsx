import { Clock, FlaskConical, KeyRound, Settings2, Tags, Mail, Users } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/modules/auth/guard";

const TABS = [
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/permissoes", label: "Permissões por cargo", icon: KeyRound },
  { href: "/admin/tags", label: "Tags", icon: Tags },
  { href: "/admin/parametros", label: "Parâmetros", icon: Settings2 },
  { href: "/admin/modelos", label: "Modelos de e-mail", icon: Mail },
  { href: "/admin/ao-vivo", label: "Ao vivo", icon: Clock },
  { href: "/admin/modo-teste", label: "Modo teste", icon: FlaskConical },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <h1 className="display text-3xl">Administração</h1>
      <nav aria-label="Administração" className="flex flex-wrap gap-1.5">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-sunk">
            <Icon size={16} aria-hidden /> {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
