"use client";

import { Ban, ShoppingCart, UserRound } from "lucide-react";

const money = (v?: string) => { const n = v ? Number(v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) : NaN; return Number.isFinite(n) && n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null; };
const date = (v?: string) => (v && !/^0000/.test(v) ? v.slice(0, 10).split("-").reverse().join("/") : null);
const TYPE: Record<string, string> = { Customer: "Cliente", Prospect: "Prospect", Lead: "Lead" };

/** O que a EOX sabe deste cliente (vem da planilha de Empresas). Compacto = poucas linhas, para o telefone flutuante. */
export function EoxInfoCard({ info, syncedAt, compact }: { info: Record<string, string> | null; syncedAt?: string | null; compact?: boolean }) {
  if (!info || !Object.keys(info).length) return compact ? null : <p className="text-sm text-muted">Sem dados da EOX ainda. Importe a planilha de Empresas em Admin → Integração com a EOX.</p>;
  const last = date(info["Data Último Faturamento"]) ?? date(info["Data Último Pedido"]);
  const lastValue = money(info["Valor Último Faturamento"]) ?? money(info["Valor Último Pedido"]);
  const chips = [TYPE[info["Tipo"]] ?? info["Tipo"], info["Avaliação"], info["Classificação ABC"] ? `ABC ${info["Classificação ABC"]}` : null, info["Segmento"]].filter(Boolean) as string[];
  const seller = info["Descrição Vendedor"] || info["Responsável"] || (info["Código Vendedor"] ? `vendedor ${info["Código Vendedor"]}` : null);
  const rows: [string, string | null][] = [
    ["Última compra", last ? `${last}${lastValue ? ` · ${lastValue}` : ""}` : null],
    ["Ticket médio", money(info["Ticket Médio"])],
    ["Recompra média", info["Recompra Média"] && info["Recompra Média"] !== "0" ? `${info["Recompra Média"]} dias` : null],
    ["Dias sem venda", info["Dias Venda"] && info["Dias Venda"] !== "0" ? info["Dias Venda"] : null],
    ["Situação financeira", info["Situação Financeira"] || null],
    ["Saldo devedor", money(info["Saldo Devedor"])],
    ["Próximo contato", date(info["Próximo Contato"])],
  ];
  const shown = rows.filter((r): r is [string, string] => !!r[1]).slice(0, compact ? 3 : 20);
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => <span key={c} className="rounded-full border border-line px-2 py-0.5 text-xs font-medium">{c}</span>)}
        {seller && <span className="inline-flex items-center gap-1 text-xs text-muted"><UserRound className="size-3.5" aria-hidden />{seller}</span>}
      </div>
      {shown.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {shown.map(([k, v]) => <div key={k} className="contents"><dt className="flex items-center gap-1 text-muted">{k === "Última compra" && <ShoppingCart className="size-3.5" aria-hidden />}{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
      )}
      {!compact && syncedAt && <p className="text-xs text-muted">Atualizado da EOX em {new Date(syncedAt).toLocaleDateString("pt-BR")}.</p>}
    </div>
  );
}
