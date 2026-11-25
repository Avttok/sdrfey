import type { Metadata } from "next";
import { ArrowRight, Upload } from "lucide-react";
import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { PageHead } from "@/components/page-head";
import { ImportHistory } from "@/components/import-history";
import { importHistory } from "@/modules/import/history";
import { requireAdmin } from "@/modules/auth/guard";

export const metadata: Metadata = { title: "Importar" };

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  const history = await importHistory();
  return (
    <div className="space-y-5">
      <PageHead icon={Upload} hex="#10b981" title="Importar planilhas" />
      <nav aria-label="Outras importações" className="grid gap-3 sm:grid-cols-3">
        {[["/negociacoes/importar", "Negociações", "Pedidos e cotações dos vendedores, com PDFs"], ["/transportadoras/importar", "Transportadoras", "Tabela de fretes por estado e tipo"], ["/admin/importar/contatos", "Contatos", "Pessoas de cada empresa, ligadas pelo CNPJ"]].map(([href, t, d]) => (
          <Link key={href} href={href} className="lift flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4"><span><b className="block">Importar {t}</b><span className="text-sm text-muted">{d}</span></span><ArrowRight size={18} aria-hidden className="text-accent" /></Link>
        ))}
      </nav>
      <ImportForm />
      <ImportHistory rows={history} />
    </div>
  );
}
