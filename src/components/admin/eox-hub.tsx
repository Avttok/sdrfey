"use client";

import { useState } from "react";
import { Ban, BadgeCheck, Building2, FileSpreadsheet, History, PlugZap, ScanSearch, ShoppingCart, Link2, LayoutDashboard } from "lucide-react";
import { EoxConnection } from "@/components/admin/eox-admin";
import { EoxImport } from "@/components/admin/eox-import";
import { EoxScan } from "@/components/admin/eox-scan";
import { ImportHistory } from "@/components/import-history";
import { panelCls } from "@/components/ui";
import type { EoxCoverage } from "@/modules/eox/actions";
import type { EoxConfig } from "@/modules/eox/config";
import type { BatchRow } from "@/modules/import/history";

const nf = new Intl.NumberFormat("pt-BR");
const TABS = [
  { key: "geral", label: "Visão geral", Icon: LayoutDashboard }, { key: "buscar", label: "Buscar Códigos", Icon: ScanSearch }, { key: "importar", label: "Importar planilhas", Icon: FileSpreadsheet },
  { key: "conexao", label: "Conexão", Icon: PlugZap }, { key: "historico", label: "Histórico", Icon: History },
] as const;
type Tab = (typeof TABS)[number]["key"];

function Meter({ label, n, total, Icon, hint }: { label: string; n: number; total: number; Icon: typeof Link2; hint: string }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className={`${panelCls} space-y-2 p-4`}>
      <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><Icon size={16} aria-hidden /></span>{label}</div>
      <div className="flex items-baseline gap-2"><span className="display text-2xl tabular-nums">{nf.format(n)}</span><span className="text-sm text-muted">de {nf.format(total)} · {pct}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunk"><div className="h-full bg-grad" style={{ width: `${pct}%` }} /></div>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/** Tela da integração com a EOX: visão geral, busca dos Códigos, importação das planilhas, conexão e histórico. */
export function EoxHub({ cfg, hasKey, coverage, history, ready }: { cfg: EoxConfig; hasKey: boolean; coverage: EoxCoverage; history: BatchRow[]; ready: boolean }) {
  const [tab, setTab] = useState<Tab>("geral");
  const remaining = coverage.total - coverage.withCode;
  return (
    <div className="space-y-4">
      <nav aria-label="Seções da integração" className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-panel p-1.5">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${tab === key ? "bg-grad text-on-accent shadow" : "text-muted hover:bg-sunk hover:text-ink"}`}><Icon size={16} aria-hidden />{label}</button>
        ))}
        <span className={`ml-auto inline-flex items-center gap-1.5 self-center rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}><span className={`size-2 rounded-full ${ready ? "bg-ok" : "bg-warn"}`} />{ready ? "Conectada" : "Desligada"}</span>
      </nav>

      {tab === "geral" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Meter label="Código EOX" n={coverage.withCode} total={coverage.total} Icon={Link2} hint="Abre o perfil da empresa, liga e qualifica pelo VocallPhone." />
            <Meter label="ID EOX" n={coverage.withId} total={coverage.total} Icon={BadgeCheck} hint="Acha o cadastro no site da EOX." />
            <Meter label="Retrato da EOX" n={coverage.withInfo} total={coverage.total} Icon={Building2} hint="Tipo, vendedor, compras e bloqueio, vindos das planilhas." />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`${panelCls} flex items-center gap-3 p-4`}><Ban className="text-danger" size={20} aria-hidden /><div><div className="display text-xl tabular-nums">{nf.format(coverage.blocked)}</div><div className="text-xs text-muted">com discagem bloqueada (fora do sorteio)</div></div></div>
            <div className={`${panelCls} flex items-center gap-3 p-4`}><ShoppingCart className="text-accent" size={20} aria-hidden /><div><div className="display text-xl tabular-nums">{nf.format(coverage.customers)}</div><div className="text-xs text-muted">clientes (Customer) na base</div></div></div>
            <div className={`${panelCls} p-4 text-sm`}><div className="text-xs text-muted">Última atualização do retrato</div><div className="font-semibold">{coverage.lastSyncAt ? new Date(coverage.lastSyncAt).toLocaleString("pt-BR") : "Nunca importado"}</div></div>
          </div>
          <div className={`${panelCls} space-y-2 p-5 text-sm`}>
            <h2 className="font-semibold">Como funciona</h2>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Exporte <b className="text-ink">Empresas</b> e <b className="text-ink">Contatos</b> da EOX e importe em <button type="button" className="font-semibold text-accent underline" onClick={() => setTab("importar")}>Importar planilhas</button>.</li>
              <li>O que a planilha não trouxe (Código EOX) é buscado pela API em <button type="button" className="font-semibold text-accent underline" onClick={() => setTab("buscar")}>Buscar Códigos</button>: {nf.format(remaining)} lead(s) ainda sem.</li>
              <li>Com o Código EOX, o Ligar manda a chamada ao VocallPhone e o botão Qualificar abre o Atendimento da EOX certo.</li>
            </ol>
          </div>
        </div>
      )}
      {tab === "buscar" && <EoxScan total={coverage.total} remaining={remaining} ready={ready} />}
      {tab === "importar" && <EoxImport />}
      {tab === "conexao" && <EoxConnection initial={{ ...cfg, accessKey: "" }} hasKey={hasKey} />}
      {tab === "historico" && <ImportHistory rows={history.filter((h) => h.kind === "eox")} />}
    </div>
  );
}
