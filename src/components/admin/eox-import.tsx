"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Play, Search, Undo2, Upload, Users, X } from "lucide-react";
import { ImportGuide } from "@/components/import-guide";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { EOX_CONTATOS_GUIDE, EOX_EMPRESAS_GUIDE } from "@/config/import-guide";
import { syncEoxNowAction } from "@/modules/eox/actions";
import { beginEoxImportAction, finishEoxImportAction, importEoxBatchAction, undoEoxImportAction, type EoxBatchResult } from "@/modules/eox/import";
import { parseEoxSheets, type Parsed } from "@/modules/eox/planilha";
import { decodeCsv, parseCsv, type ParsedCsv } from "@/modules/import/csv";
import { useRouter } from "next/navigation";

type Totals = { found: number; missing: number; created: number; ids: number; codes: number; filled: number; info: number; phones: number; emails: number; people: number };
const ZERO: Totals = { found: 0, missing: 0, created: 0, ids: 0, codes: 0, filled: 0, info: 0, phones: 0, emails: 0, people: 0 };
const BATCH = 300;
const nf = new Intl.NumberFormat("pt-BR");
type Sheet = { name: string; size: number; csv: ParsedCsv };

function Drop({ title, hint, required, sheet, busy, onFile, onClear }: { title: string; hint: string; required?: boolean; sheet: Sheet | null; busy: boolean; onFile: (f: File) => void; onClear: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${drag ? "border-accent bg-sunk" : sheet ? "border-ok/50 bg-ok/5" : "border-line"}`}>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {busy ? <><Loader2 className="size-6 animate-spin text-accent" aria-hidden /><p className="text-sm text-muted">Lendo a planilha…</p></> : sheet ? (
        <>
          <CheckCircle2 className="size-6 text-ok" aria-hidden />
          <p className="max-w-full truncate text-sm font-semibold">{sheet.name}</p>
          <p className="text-xs text-muted">{nf.format(sheet.csv.rows.length)} linhas · {(sheet.size / 1_000_000).toFixed(1)} MB · {sheet.csv.headers.length} colunas</p>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-muted underline hover:text-ink"><X size={12} aria-hidden /> Trocar arquivo</button>
        </>
      ) : (
        <>
          <span className="grid size-11 place-items-center rounded-xl bg-grad-soft text-accent">{required ? <FileSpreadsheet size={22} aria-hidden /> : <Users size={22} aria-hidden />}</span>
          <p className="font-semibold">{title} {required ? <span className="rounded bg-accent/15 px-1.5 py-px text-[10px] font-semibold text-accent">obrigatória</span> : <span className="text-xs font-normal text-muted">(opcional)</span>}</p>
          <p className="max-w-xs text-xs text-muted">{hint}</p>
          <button type="button" onClick={() => input.current?.click()} className={`${btnGhost} !min-h-9`}><Upload size={15} aria-hidden /> Escolher CSV ou arrastar</button>
        </>
      )}
    </div>
  );
}

const Stat = ({ n, label, tone = "" }: { n: number; label: string; tone?: string }) => <div className="rounded-xl border border-line bg-panel px-3 py-2.5"><div className={`display text-xl tabular-nums ${tone}`}>{nf.format(n)}</div><div className="text-xs text-muted">{label}</div></div>;
const Toggle = ({ on, set, title, text }: { on: boolean; set: (v: boolean) => void; title: string; text: string }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${on ? "border-accent bg-accent/8" : "border-line hover:bg-sunk"}`}>
    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{on && <CheckCircle2 size={14} aria-hidden />}</span>
    <span><b className="block text-sm">{title}</b><span className="text-xs text-muted">{text}</span></span>
  </button>
);

/** Importa as planilhas de Empresas e Contatos da EOX: lê no navegador, confere, mostra o que vai mudar e grava em lotes (com Desfazer). */
export function EoxImport() {
  const toast = useToast();
  const router = useRouter();
  const [emp, setEmp] = useState<Sheet | null>(null);
  const [con, setCon] = useState<Sheet | null>(null);
  const [reading, setReading] = useState<"emp" | "con" | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [create, setCreate] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [phase, setPhase] = useState<null | "check" | "apply">(null);
  const [progress, setProgress] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [missing, setMissing] = useState<{ cnpj: string; company: string; code: string | null }[]>([]);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const [undone, setUndone] = useState<string | null>(null);

  const reset = () => { setParsed(null); setTotals(null); setApplied(false); setBatchId(null); setUndone(null); setMissing([]); };
  async function load(kind: "emp" | "con", f: File) {
    setReading(kind); reset();
    try {
      const csv = parseCsv(decodeCsv(await f.arrayBuffer()));
      const sheet = { name: f.name, size: f.size, csv };
      kind === "emp" ? setEmp(sheet) : setCon(sheet);
      const e = kind === "emp" ? sheet : emp, c = kind === "con" ? sheet : con;
      if (e) setParsed(parseEoxSheets(e.csv, c?.csv ?? null));
    } catch (err) { toast("bad", (err as Error).message); kind === "emp" ? setEmp(null) : setCon(null); }
    finally { setReading(null); }
  }
  const clear = (kind: "emp" | "con") => { reset(); if (kind === "emp") { setEmp(null); } else { setCon(null); if (emp) { try { setParsed(parseEoxSheets(emp.csv, null)); } catch { /* sem mudança */ } } } };

  async function run(p: Parsed, apply: boolean) {
    const sum = { ...ZERO }; const miss: typeof missing = [];
    setProgress(0);
    let id: number | null = null;
    if (apply) { const b = await beginEoxImportAction(emp?.name ?? "planilha EOX", p.companies.length); if (!b.ok) throw new Error(b.message); id = b.batchId; setBatchId(id); }
    for (let i = 0; i < p.companies.length; i += BATCH) {
      const r: EoxBatchResult = await importEoxBatchAction(p.companies.slice(i, i + BATCH), apply, create, emp?.name ?? "planilha", id, overwrite);
      if (!r.ok) throw new Error(r.message);
      for (const k of Object.keys(sum) as (keyof Totals)[]) sum[k] += r[k];
      if (miss.length < 5000) miss.push(...r.missingRows);
      setProgress(Math.min(100, Math.round(((i + BATCH) / p.companies.length) * 100)));
    }
    if (id) await finishEoxImportAction(id, sum.found + sum.created, sum.missing);
    setTotals(sum); setMissing(miss);
  }
  async function check() { if (!parsed) return; setPhase("check"); setApplied(false); try { await run(parsed, false); } catch (e) { toast("bad", (e as Error).message); } finally { setPhase(null); } }
  async function save() {
    if (!parsed) return; setPhase("apply");
    try {
      await run(parsed, true); setApplied(true); toast("ok", "Planilha importada. Dá para desfazer logo abaixo ou no histórico.");
      router.refresh();
      const s = await syncEoxNowAction(); toast(s.ok ? "info" : "warn", s.message ?? "");
      router.refresh();
    } catch (e) { toast("bad", (e as Error).message); } finally { setPhase(null); }
  }
  async function undo() { if (!batchId) return; setPhase("apply"); const r = await undoEoxImportAction(batchId); setPhase(null); toast(r.ok ? "ok" : "bad", r.message); if (r.ok) { setUndone(r.message); setApplied(false); setTotals(null); router.refresh(); } }
  function downloadMissing() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = ["CNPJ;EMPRESA;IdEOX", ...missing.map((m) => [m.cnpj, esc(m.company), m.code ?? ""].join(";"))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); a.download = "empresas-da-eox-fora-do-sistema.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  const warns: { text: string; level: "warn" | "info" }[] = [];
  if (parsed) {
    if (parsed.withoutCnpj) warns.push({ level: "warn", text: `${nf.format(parsed.withoutCnpj)} linha(s) com CNPJ inválido serão ignoradas.` });
    if (parsed.duplicates) warns.push({ level: "info", text: `${nf.format(parsed.duplicates)} linha(s) repetem um CNPJ já lido: foram juntadas numa só.` });
    if (parsed.ambiguous) warns.push({ level: "warn", text: `${nf.format(parsed.ambiguous)} nome(s) de empresa se repetem: o Código EOX deles não vem dos Contatos (a busca pela API completa depois).` });
    if (con && parsed.contactsOrphan) warns.push({ level: "info", text: `${nf.format(parsed.contactsOrphan)} contato(s) não acharam empresa pelo nome e ficam de fora.` });
    if (!con) warns.push({ level: "info", text: "Sem a planilha de Contatos, os Códigos EOX e as pessoas não entram (a busca pela API completa os Códigos depois)." });
  }
  const busy = !!phase || !!reading;
  const sample = parsed?.companies.slice(0, 6) ?? [];
  return (
    <div className="space-y-4">
      <section className={`${panelCls} space-y-4 p-5`}>
        <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><FileSpreadsheet size={16} aria-hidden /></span><h2 className="text-[15px] font-semibold">1. Escolha as planilhas exportadas da EOX</h2></div>
        <div className="grid gap-3 md:grid-cols-2">
          <Drop required title="Empresas" hint="Exportação do módulo Empresas (com IdEOX e CNPJ)." sheet={emp} busy={reading === "emp"} onFile={(f) => load("emp", f)} onClear={() => clear("emp")} />
          <Drop title="Contatos" hint="Exportação do módulo Contatos (com idEmpresa). Traz o Código EOX e as pessoas." sheet={con} busy={reading === "con"} onFile={(f) => load("con", f)} onClear={() => clear("con")} />
        </div>
        <details className="rounded-xl border border-line"><summary className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold">Quais colunas o sistema lê?</summary><div className="space-y-3 border-t border-line p-3"><ImportGuide cols={EOX_EMPRESAS_GUIDE} /><ImportGuide cols={EOX_CONTATOS_GUIDE} /></div></details>
      </section>

      {parsed && (
        <section className={`${panelCls} space-y-4 p-5`}>
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><Search size={16} aria-hidden /></span><h2 className="text-[15px] font-semibold">2. O que a planilha traz</h2></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Stat n={parsed.companies.length} label="empresas lidas" /><Stat n={parsed.withCode} label="com ID EOX" /><Stat n={parsed.linkedRecords} label="com Código EOX" /><Stat n={parsed.people} label="contatos ligados" />
            <Stat n={parsed.customers} label="clientes (Customer)" /><Stat n={parsed.blocked} label="discagem bloqueada" tone={parsed.blocked ? "text-danger" : ""} />
          </div>
          {warns.length > 0 && <ul className="space-y-1.5">{warns.map((w) => <li key={w.text} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${w.level === "warn" ? "bg-warn/10 text-warn" : "bg-sunk text-muted"}`}><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />{w.text}</li>)}</ul>}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-sunk text-xs text-muted"><tr>{["CNPJ", "Empresa", "ID EOX", "Código EOX", "Tipo", "Discagem", "Contatos"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line/70">{sample.map((c) => (
                <tr key={c.cnpj}><td className="figure px-3 py-1.5">{c.cnpj}</td><td className="max-w-[16rem] truncate px-3 py-1.5">{c.company}</td><td className="figure px-3 py-1.5">{c.code ?? "—"}</td><td className="figure px-3 py-1.5">{c.recordId ?? "—"}</td><td className="px-3 py-1.5">{c.info["Tipo"] ?? "—"}</td><td className={`px-3 py-1.5 ${c.info["Discagens bloqueadas"] === "Sim" ? "font-semibold text-danger" : ""}`}>{c.info["Discagens bloqueadas"] ?? "—"}</td><td className="px-3 py-1.5">{c.people.length}</td></tr>
              ))}</tbody>
            </table>
            <p className="border-t border-line bg-sunk/50 px-3 py-1.5 text-xs text-muted">Primeiras {sample.length} de {nf.format(parsed.companies.length)} empresas.</p>
          </div>
        </section>
      )}

      {parsed && (
        <section className={`${panelCls} space-y-4 p-5`}>
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-grad-soft text-accent"><Play size={16} aria-hidden /></span><h2 className="text-[15px] font-semibold">3. Conferir e gravar</h2></div>
          <div className="grid gap-2 md:grid-cols-2">
            <Toggle on={create} set={(v) => { setCreate(v); setTotals(null); setApplied(false); }} title="Criar leads que ainda não existem" text="Customer vai para Vendas e o resto para Prospecção. Desligado: só entram dados de quem já é lead." />
            <Toggle on={overwrite} set={(v) => { setOverwrite(v); setTotals(null); setApplied(false); }} title="Sobrescrever dados diferentes" text="Troca Códigos, endereço, nome fantasia e e-mail pelos da planilha. Telefones e contatos só são acrescentados." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={check} className={btnGhost}>{phase === "check" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search size={16} aria-hidden />} Conferir antes de gravar</button>
            <button type="button" disabled={busy || !totals || applied} onClick={save} className={btnPrimary}>{phase === "apply" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Gravar</button>
            {phase && <span className="text-sm text-muted">{progress}%</span>}
          </div>
          {phase && <div className="h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-grad transition-all" style={{ width: `${progress}%` }} /></div>}
          {undone && <p className="rounded-lg bg-sunk px-3 py-2 text-sm"><Undo2 size={14} className="mr-1.5 inline" aria-hidden />Importação desfeita. {undone}</p>}
          {totals && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{applied ? "Gravado:" : "Prévia (nada foi gravado):"}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat n={totals.found} label="já são leads" /><Stat n={create ? totals.created : totals.missing} label={create ? "leads criados" : "fora do sistema (ignoradas)"} />
                <Stat n={totals.codes} label={overwrite ? "ID EOX novos ou trocados" : "ID EOX novos"} /><Stat n={totals.ids} label={overwrite ? "Códigos EOX novos ou trocados" : "Códigos EOX novos"} />
                <Stat n={totals.info} label="retratos da EOX" /><Stat n={totals.filled} label="leads com dados alterados" />
                <Stat n={totals.phones} label="telefones novos" /><Stat n={totals.people} label="contatos" />
              </div>
              <div className="flex flex-wrap gap-2">
                {missing.length > 0 && !create && <button type="button" onClick={downloadMissing} className={btnGhost}><Download size={16} aria-hidden /> Baixar as {nf.format(totals.missing)} empresas fora do sistema</button>}
                {applied && batchId && <button type="button" disabled={busy} onClick={undo} className={`${btnGhost} !border-danger/50 !text-danger`}><Undo2 size={16} aria-hidden /> Desfazer esta importação</button>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
