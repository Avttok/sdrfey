"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Play, Search } from "lucide-react";
import { decodeCsv, parseCsv } from "@/modules/import/csv";
import { importEoxBatchAction, type EoxBatchResult } from "@/modules/eox/import";
import { parseEoxSheets, type Parsed } from "@/modules/eox/planilha";
import { useToast } from "@/components/toast";

type Totals = { found: number; missing: number; created: number; ids: number; codes: number; filled: number; info: number; phones: number; emails: number; people: number };
const ZERO: Totals = { found: 0, missing: 0, created: 0, ids: 0, codes: 0, filled: 0, info: 0, phones: 0, emails: 0, people: 0 };
const BATCH = 300;

/** Importa as planilhas de Empresas e Contatos exportadas da EOX. Lê no navegador e envia em lotes pequenos. */
export function EoxImport() {
  const toast = useToast();
  const emp = useRef<HTMLInputElement>(null), con = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [label, setLabel] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState<null | "prev" | "apply">(null);
  const [progress, setProgress] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [applied, setApplied] = useState(false);

  async function read() {
    const f = emp.current?.files?.[0];
    if (!f) { toast("bad", "Escolha a planilha de Empresas."); return; }
    setBusy("prev"); setTotals(null); setApplied(false);
    try {
      const e = parseCsv(decodeCsv(await f.arrayBuffer()));
      const cf = con.current?.files?.[0];
      const c = cf ? parseCsv(decodeCsv(await cf.arrayBuffer())) : null;
      const p = parseEoxSheets(e, c);
      setParsed(p); setLabel(f.name);
      await run(p, false);
    } catch (err) { toast("bad", (err as Error).message); }
    finally { setBusy(null); }
  }

  async function run(p: Parsed, apply: boolean) {
    const sum = { ...ZERO };
    setProgress(0);
    for (let i = 0; i < p.companies.length; i += BATCH) {
      const r: EoxBatchResult = await importEoxBatchAction(p.companies.slice(i, i + BATCH), apply, create, label || "planilha");
      if (!r.ok) throw new Error(r.message);
      for (const k of Object.keys(sum) as (keyof Totals)[]) sum[k] += r[k];
      setProgress(Math.min(100, Math.round(((i + BATCH) / p.companies.length) * 100)));
    }
    setTotals(sum);
  }

  async function save() {
    if (!parsed) return;
    setBusy("apply");
    try { await run(parsed, true); setApplied(true); toast("ok", "Planilha da EOX importada."); }
    catch (err) { toast("bad", (err as Error).message); }
    finally { setBusy(null); }
  }

  const stat = (n: number, label: string) => <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2"><div className="text-lg font-semibold tabular-nums">{n.toLocaleString("pt-BR")}</div><div className="text-xs text-muted">{label}</div></div>;
  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-brand" /><h2 className="font-semibold">Importar planilhas da EOX</h2></div>
      <p className="text-sm text-muted">Exporte <b>Empresas</b> e <b>Contatos</b> da EOX e escolha os dois arquivos. Só completa o que está vazio (Código, Registro, endereço, telefones, e-mails, contatos) e atualiza o <b>retrato da EOX</b> de cada lead (tipo, vendedor, discagem bloqueada, últimas compras…). O Registro vem dos Contatos, ligado pelo nome da empresa.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Empresas (obrigatório)<input ref={emp} type="file" accept=".csv,text/csv" className="block w-full text-sm" /></label>
        <label className="space-y-1 text-sm">Contatos (opcional)<input ref={con} type="file" accept=".csv,text/csv" className="block w-full text-sm" /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} />Criar como lead as empresas que ainda não existem (Customer vai para Vendas, o resto para Prospecção)</label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy} onClick={read} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-line/40 disabled:opacity-50">{busy === "prev" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Conferir antes de gravar</button>
        <button type="button" disabled={!!busy || !parsed || !totals || applied} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "apply" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}Gravar</button>
        {busy && <span className="text-sm text-muted">{progress}%</span>}
      </div>
      {parsed && <p className="text-xs text-muted">{parsed.companies.length.toLocaleString("pt-BR")} empresas com CNPJ válido · {parsed.withoutCnpj} com CNPJ inválido · {parsed.linkedRecords.toLocaleString("pt-BR")} com Registro achado nos Contatos · {parsed.ambiguous} nomes repetidos (Registro ignorado) · {parsed.people.toLocaleString("pt-BR")} contatos</p>}
      {totals && (
        <div className="space-y-2">
          <div className="text-sm font-medium">{applied ? "Gravado:" : "Prévia (nada foi gravado):"}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stat(totals.found, "já são leads")}{stat(create ? totals.created : totals.missing, create ? "leads criados" : "não existem (ignoradas)")}
            {stat(totals.codes, "Códigos EOX novos")}{stat(totals.ids, "Registros EOX novos")}
            {stat(totals.info, "retratos da EOX")}{stat(totals.filled, "leads com dados completados")}
            {stat(totals.phones, "telefones novos")}{stat(totals.people, "contatos")}
          </div>
        </div>
      )}
    </section>
  );
}
