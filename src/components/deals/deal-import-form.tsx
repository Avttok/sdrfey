"use client";

import { ImportEditor } from "@/components/import-editor";
import { needsMapping } from "@/modules/import/fields";
import { AlertTriangle, CircleHelp, FileText, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { STAGE_META } from "@/config/deals";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExistingClientDialog } from "@/components/deals/existing-client-dialog";
import { DEAL_GUIDE } from "@/config/import-guide";
import { ImportExample } from "@/components/import-example";
import { DEAL_TEMPLATE_HEADERS, DEAL_TEMPLATE_ROWS } from "@/modules/import/deals-parse";
import { hasBlocker, ImportInsight, needsAck } from "@/components/import-insight";
import { ImportFilePicker } from "@/components/import-file-picker";
import { applyDealImportAction, previewDealImportAction, type DealImportPreview } from "@/modules/import/deals-actions";

const nf = new Intl.NumberFormat("pt-BR");
function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "";
  return <div className="rounded-xl border border-line bg-panel p-3.5"><p className="text-xs text-muted">{label}</p><p className={`figure mt-1 text-2xl font-semibold ${color}`}>{nf.format(value)}</p></div>;
}
function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold"><span className={`flex size-7 items-center justify-center rounded-full text-sm ${done ? "bg-ok text-white" : "bg-grad text-on-accent"}`}>{done ? "✓" : n}</span>{children}</h2>;
}

export function DealImportForm({ sellers, terms = [] }: { sellers: { id: number; name: string }[] | null; terms?: string[] }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [seller, setSeller] = useState(sellers?.[0]?.id ?? 0);
  const [prev, setPrev] = useState<DealImportPreview | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);
  const [ack, setAck] = useState(false);
  const [view, setView] = useState<{ id: number; name: string } | null>(null);
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [policy, setPolicy] = useState<"skip" | "fill" | "overwrite">("skip");
  const fd = (f: File | null = file, p: File[] = pdfs) => { const d = new FormData(); if (f) d.set("file", f); if (sellers) d.set("sellerId", String(seller)); for (const x of p) d.append("pdf", x); d.set("dupPolicy", policy); return d; };
  const pickFile = (f: File | null, auto?: boolean) => { setPrev(null); setDetails([]); setFile(f); if (f && auto) check(f); };
  const reset = () => { setPrev(null); setFile(null); setPdfs([]); setPolicy("skip"); };
  const check = (f?: File, p?: File[]) => start(async () => { const r = await previewDealImportAction(fd(f ?? file, p ?? pdfs)); setAck(false); setPrev(r); if (!r.ok) toast("bad", r.message); });
  const apply = () => start(async () => { const r = await applyDealImportAction(fd()); toast(r.ok ? "ok" : "bad", r.message); setDetails(r.details ?? []); if (r.ok) reset(); });

  return (
    <div className="space-y-5">
      <section className={`${panelCls} space-y-3 p-5`}>
        <Step n={1} done={!!file}>Modelo da planilha</Step>
        <ImportExample headers={DEAL_TEMPLATE_HEADERS} rows={DEAL_TEMPLATE_ROWS} required={["CNPJ"]} fileName="modelo-negociacoes.csv" guide={DEAL_GUIDE} extra={{ "CONDICAO DE PAGAMENTO": terms }} />
        {sellers && (
          <label className="block max-w-xs text-sm"><span className="mb-1 block text-muted">Importar para o vendedor</span>
            <select className={inputCls} value={seller} onChange={(e) => { setSeller(Number(e.target.value)); setPrev(null); }}>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        )}
      </section>

      <section className={`${panelCls} p-5`}>
        <Step n={2} done={!!prev?.ok}>Escolha o arquivo (CSV ou Excel .xlsx)</Step>
        <ImportFilePicker file={file} checking={pending} busy={pending} hasResult={!!prev} noun="negociações" onPick={pickFile} onCheck={() => check()} onReset={reset} />
      </section>

      {prev && !prev.ok && file && needsMapping(prev.message) && (
        <section className={`${panelCls} space-y-4 border-warn/60 p-5`}>
          <h2 className="flex items-center gap-2.5 text-lg font-semibold"><span className="grid size-8 place-items-center rounded-full bg-warn/20 text-warn"><CircleHelp size={18} aria-hidden /></span> Preciso da sua ajuda com as colunas</h2>
          <p className="text-sm text-muted">{prev.message} Isso acontece quando os títulos das colunas têm outros nomes. Abra a edição, diga o que é cada coluna e o sistema reconfere sozinho.</p>
          <ImportEditor kind={"deals"} file={file} busy={pending} onApply={(f) => { setFile(f); check(f); }} />
        </section>
      )}

      {prev?.ok && (
        <section className={`${panelCls} space-y-4 p-5`}>
          <Step n={3}>Confira antes de importar</Step>
          <ImportInsight info={prev.insight} ack={ack} onAck={setAck} />
          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="space-y-2 rounded-xl border border-line p-4 text-sm">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Se já existir no sistema</legend>
              {([["skip", "Não adicionar nada", "Linhas repetidas são ignoradas."], ["fill", "Completar só o que falta", "Preenche campos vazios da negociação existente."], ["overwrite", "Substituir pela planilha", "Os dados da planilha passam por cima dos atuais."]] as const).map(([v, t, h]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${policy === v ? "border-accent bg-grad-soft" : "border-line"}`}>
                  <input type="radio" name="dup" className="mt-1" checked={policy === v} onChange={() => setPolicy(v)} />
                  <span><b className="block">{t}</b><span className="text-xs text-muted">{h}</span></span>
                </label>
              ))}
              <p className="text-xs text-muted">{prev.matches > 0 ? `${nf.format(prev.matches)} linha(s) já existem no sistema.` : "Nenhuma linha desta planilha existe no sistema ainda."} Só vale para negociações já encontradas pelo CNPJ + pedido/cotação.</p>
            </fieldset>
            <div className="space-y-2 rounded-xl border border-line p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">PDFs de cotação ou pedido (opcional)</p>
              <p className="text-xs text-muted">Anexe 1 PDF por cliente. O CNPJ do PDF liga ele à linha da planilha e completa número, data, valor, condição e itens. Os arquivos não são guardados.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnGhost} disabled={pending} onClick={() => pdfInput.current?.click()}><FileText size={15} aria-hidden /> Anexar PDFs</button>
                {pdfs.length > 0 && <button type="button" className={btnGhost} disabled={pending} onClick={() => { setPdfs([]); if (file) check(file, []); }}>Remover todos</button>}
                {pdfs.length > 0 && <button type="button" className={btnPrimary} disabled={pending} onClick={() => check()}>Reconferir com os PDFs</button>}
              </div>
              <input ref={pdfInput} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ""; if (l.length) { const n = [...pdfs, ...l]; setPdfs(n); if (file) check(file, n); } }} />
              {prev.pdfs.length > 0 && (
                <ul className="max-h-44 space-y-1 overflow-y-auto">
                  {prev.pdfs.map((p, i) => <li key={p.name + i} className="flex items-start gap-2 text-xs"><span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${p.matched ? "bg-ok" : "bg-warn"}`} /><span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="text-muted">{p.matched ? `Cotação ${p.quoteNumber ?? "s/n"} · ${p.items} itens · ` : ""}{p.note}</span></span></li>)}
                </ul>
              )}
            </div>
          </div>
          {file && <ImportEditor kind="deals" file={file} busy={pending} onApply={(f) => { setFile(f); check(f); }} />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Linhas no arquivo" value={prev.report.total} />
            <Stat label="Vão entrar" value={prev.willCreate} tone="ok" />
            <Stat label="Já existiam" value={prev.skippedTotal + prev.report.duplicatesInFile} tone={prev.skippedTotal + prev.report.duplicatesInFile ? "warn" : undefined} />
            <Stat label="Rejeitadas" value={prev.report.rejected.length} tone={prev.report.rejected.length ? "bad" : undefined} />
          </div>
          {prev.willCreate > 0 && (
            <div className="rounded-lg bg-sunk p-3 text-sm">
              <p className="mb-1 font-medium">O que vai ser criado</p>
              <p className="text-muted">{prev.newLeads} {prev.newLeads === 1 ? "cliente novo" : "clientes novos"} · {prev.existingLeads} {prev.existingLeads === 1 ? "cliente já cadastrado (reaproveitado)" : "clientes já cadastrados (reaproveitados)"}</p>
              <p className="mt-1 flex flex-wrap gap-1.5">{Object.entries(prev.byStage).map(([k, n]) => <span key={k} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium">{STAGE_META[k as keyof typeof STAGE_META]?.label ?? k}: {n}</span>)}</p>
            </div>
          )}
          {(prev.skipped.length > 0 || prev.report.duplicatesInFile > 0) && (
            <div className="rounded-lg bg-sunk p-3 text-sm">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-warn"><AlertTriangle size={15} aria-hidden /> Ignorados para não duplicar</p>
              {prev.report.duplicatesInFile > 0 && <p className="text-muted">{prev.report.duplicatesInFile} linha(s) repetida(s) dentro do próprio arquivo</p>}
              {prev.skipped.map((s) => <p key={s.reason} className="text-muted">{s.count} · {s.reason} <span className="text-xs">({s.samples.join(", ")}{s.count > s.samples.length ? "…" : ""})</span></p>)}
            </div>
          )}
          {prev.report.warnings.map((w) => <p key={w} className="rounded-lg bg-sunk p-3 text-sm text-muted">{w}</p>)}
          {prev.report.rejected.length > 0 && <div className="rounded-lg border border-danger/40 p-3 text-sm"><p className="mb-1 font-medium text-danger">Linhas rejeitadas (primeiras {Math.min(8, prev.report.rejected.length)})</p>{prev.report.rejected.slice(0, 8).map((r) => <p key={r.line}>Linha {r.line}: {r.reason}{r.company ? ` (${r.company})` : ""}</p>)}</div>}
          <button type="button" className={`${btnPrimary} !px-6 !py-3 text-base`} disabled={pending || (prev.willCreate === 0 && !(policy !== "skip" && prev.matches > 0)) || hasBlocker(prev.insight.checks) || (needsAck(prev.insight.checks) && !ack)} onClick={() => (prev.inPortfolio.length ? setAsk(true) : apply())}>{pending ? <Spinner size={18} /> : <Upload size={18} aria-hidden />} {pending ? "Importando…" : `Importar ${prev.willCreate} ${prev.willCreate === 1 ? "negociação" : "negociações"}`}</button>
        </section>
      )}
      {prev?.ok && (
        <>
          <ConfirmDialog open={ask && !view} tone="warn" icon={AlertTriangle} title={`${prev.inPortfolio.length} ${prev.inPortfolio.length === 1 ? "cliente já está" : "clientes já estão"} na carteira de vendedores`} confirmLabel="Prosseguir mesmo assim" busy={pending} onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); apply(); }}>
            <span className="block space-y-2">
              <span className="block">Eles já têm negociações no sistema. Veja o histórico antes de decidir.</span>
              <span className="block max-h-64 divide-y divide-line/70 overflow-y-auto rounded-xl border border-line">
                {prev.inPortfolio.map((c) => (
                  <span key={c.leadId} className="flex items-center gap-3 px-3 py-2 text-left">
                    <span className="min-w-0 flex-1"><b className="block truncate text-ink">{c.company}</b><span className="text-xs">{c.sellers.join(", ")}</span></span>
                    <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => setView({ id: c.leadId, name: c.company })}>Ver histórico</button>
                  </span>
                ))}
              </span>
            </span>
          </ConfirmDialog>
          {view && <ExistingClientDialog leadId={view.id} name={view.name} onCancel={() => setView(null)} onProceed={() => setView(null)} />}
        </>
      )}
      {details.length > 0 && <section className={`${panelCls} space-y-1 p-5 text-sm`}>{details.map((d) => <p key={d} className="text-muted">{d}</p>)}</section>}
      <p className="text-center text-xs text-muted"><Link href="/negociacoes" className="hover:text-accent">← Voltar para Negociações</Link></p>
    </div>
  );
}
