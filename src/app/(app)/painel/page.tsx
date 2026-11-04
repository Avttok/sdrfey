import type { Metadata } from "next";
import { Play } from "lucide-react";
import { panelCls } from "@/components/ui";
import { requireUser } from "@/modules/auth/guard";
import { getLeadStats } from "@/modules/leads/stats";

export const metadata: Metadata = { title: "Painel" };

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

const nf = new Intl.NumberFormat("pt-BR");

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getLeadStats();

  const items = [
    { label: "Leads na base", value: stats.total, hint: "todos os CNPJs cadastrados" },
    { label: "Nunca abordados", value: stats.fresh, hint: "primeiros do sorteio" },
    { label: "Já trabalhados", value: stats.worked, hint: "com algum contato registrado" },
    { label: "Fora do sorteio", value: stats.blocked, hint: "clientes, baixadas e inaptas" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="display text-4xl">
        {greeting()}, {user.name}
      </h1>

      <section aria-label="Resumo da base" className={`${panelCls} grid grid-cols-2 divide-line max-md:divide-y md:grid-cols-4 md:divide-x`}>
        {items.map((it) => (
          <div key={it.label} className="p-5 max-md:odd:border-r max-md:odd:border-line">
            <p className="text-sm text-muted">{it.label}</p>
            <p className="figure mt-1 text-4xl">{nf.format(it.value)}</p>
            <p className="mt-1 text-xs text-muted">{it.hint}</p>
          </div>
        ))}
      </section>

      <section className={`${panelCls} flex flex-wrap items-center justify-between gap-4 p-6`}>
        <div className="max-w-lg">
          <h2 className="display text-2xl">Próximo lead</h2>
          <p className="mt-2 text-muted">
            O sorteio chega na próxima etapa: um lead livre, os dados da empresa e o passo a passo de e-mail, WhatsApp e
            ligação.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-on-accent opacity-50"
        >
          <Play size={18} aria-hidden /> Começar
        </button>
      </section>
    </div>
  );
}
