"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { STAGE_META } from "@/config/deals";
import { applyDealImportAction, previewDealImportAction, type DealImportPreview } from "@/modules/import/deals-actions";

const nf = new Intl.NumberFormat("pt-BR");
function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "";
  return <div className="rounded-xl border border-line bg-panel p-3.5"><p className="text-xs text-muted">{label}</p><p className={`figure mt-1 text-2xl font-semibold ${color}`}>{nf.format(value)}</p></div>;
}
function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold"><span className={`flex size-7 items-center justify-center rounded-full text-sm ${done ? "bg-ok text-white" : "bg-grad text-on-accent"}`}>{done ? "✓" : n}</span>{children}</h2>;
}

export function DealImportForm({ sellers }: { sellers: { id: number; name: string }[] | null }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [seller, setSeller] = useState(sellers?.[0]?.id ?? 0);
  const [prev, setPrev] = useState<DealImportPreview | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const input = useRef<HTMLInputElement>(null);
  const fd = () => { const d = new FormData(); if (file) d.set("file", file); if (sellers) d.set("sellerId", String(seller)); return d; };
  const pick = (f: File | null | undefined) => { setFile(f ?? null); setPrev(null); setDetails([]); };
  const reset = () => { setPrev(null); setFile(null); if (input.current) input.current.value = ""; };
  const check = () => start(async () => { const r = await previewDealImportAction(fd()); setPrev(r); if (!r.ok) toast("bad", r.message); });
  const apply = () => start(async () => { const r = await applyDealImportAction(fd()); toast(r.ok ? "ok" : "bad", r.message); setDetails(r.details ?? []); if (r.ok) reset(); });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className={`${panelCls} space-y-3 p-5`}>
        <Step n={1} done={!!file}>Prepare sua planilha</Step>
        <p className="text-sm text-muted">Salve a sua planilha como <b>CSV</b> (Arquivo → Salvar como → CSV). Só o <b>CNPJ</b> é obrigatório; as outras colunas são opcionais e reconhecidas pelo nome. Baixe o modelo para ver os nomes aceitos.</p>
        <ul className="grid gap-1.5 text-sm text-muted sm:grid-cols-2">
          <li>• <b className="text-ink">ETAPA</b>: novo, contato, cotação, negociação, ganho (fechado/vendido) ou perdido</li>
          <li>• <b className="text-ink">Datas</b>: 16/10/2026 · <b className="text-ink">Valores</b>: 10.127,44</li>
          <li>• Cliente que já existe no sistema é reaproveitado: só completamos o que estiver vazio</li>
          <li>• Nada é duplicado: mesmo CNPJ, pedido ou cotação já cadastrados são ignorados</li>
        </ul>
        <a href="/negociacoes/importar/modelo" className={btnGhost} download><Download size={16} aria-hidden /> Baixar modelo (CSV)</a>
        {sellers && (
          <label className="block max-w-xs text-sm"><span className="mb-1 block text-muted">Importar para o vendedor</span>
            <select className={inputCls} value={seller} onChange={(e) => { setSeller(Number(e.target.value)); setPrev(null); }}>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        )}
      </section>

      <section className={`${panelCls} p-5`}>
        <Step n={2} done={!!prev?.ok}>Escolha o arquivo CSV</Step>
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-accent bg-sunk [&_*]:pointer-events-none" : "border-line"}`}>
          {file ? (
            <>
              <FileSpreadsheet size={36} className="text-accent" aria-hidden />
              <p className="font-semibold">{file.name}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={btnPrimary} disabled={pending} onClick={check}>{pending && !prev ? <Spinner size={16} /> : <CheckCircle2 size={16} aria-hidden />} {pending && !prev ? "Conferindo…" : "Conferir arquivo"}</button>
                <button type="button" className={btnGhost} disabled={pending} onClick={reset}><X size={15} aria-hidden /> Trocar arquivo</button>
              </div>
            </>
          ) : (
            <>
              <Upload size={36} className="text-muted" aria-hidden />
              <p className="font-medium">Arraste o CSV para cá</p>
              <button type="button" className={btnGhost} onClick={() => input.current?.click()}>Escolher arquivo</button>
            </>
          )}
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      </section>

      {prev?.ok && (
        <section className={`${panelCls} space-y-4 p-5`}>
          <Step n={3}>Confira antes de importar</Step>
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
          <button type="button" className={`${btnPrimary} !px-6 !py-3 text-base`} disabled={pending || prev.willCreate === 0} onClick={apply}>{pending ? <Spinner size={18} /> : <Upload size={18} aria-hidden />} {pending ? "Importando…" : `Importar ${prev.willCreate} ${prev.willCreate === 1 ? "negociação" : "negociações"}`}</button>
        </section>
      )}
      {details.length > 0 && <section className={`${panelCls} space-y-1 p-5 text-sm`}>{details.map((d) => <p key={d} className="text-muted">{d}</p>)}</section>}
      <p className="text-center text-xs text-muted"><Link href="/negociacoes" className="hover:text-accent">← Voltar para Negociações</Link></p>
    </div>
  );
}
