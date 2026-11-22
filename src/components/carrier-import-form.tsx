"use client";

import { AlertTriangle, CircleHelp, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ImportEditor } from "@/components/import-editor";
import { ImportExample } from "@/components/import-example";
import { ImportFilePicker } from "@/components/import-file-picker";
import { hasBlocker, ImportInsight, needsAck } from "@/components/import-insight";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnPrimary, panelCls } from "@/components/ui";
import { CARRIER_GUIDE } from "@/config/import-guide";
import { applyCarrierImportAction, previewCarrierImportAction, type CarrierPolicy, type CarrierPreview } from "@/modules/carriers/actions";
import { CARRIER_SAMPLE_CSV } from "@/modules/carriers/parse";
import { needsMapping } from "@/modules/import/fields";

const nf = new Intl.NumberFormat("pt-BR");
const pct = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")}%`);
function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "";
  return <div className="rounded-xl border border-line bg-panel p-3.5"><p className="text-xs text-muted">{label}</p><p className={`figure mt-1 text-2xl font-semibold ${color}`}>{nf.format(value)}</p></div>;
}
function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold"><span className={`flex size-7 items-center justify-center rounded-full text-sm ${done ? "bg-ok text-white" : "bg-grad text-on-accent"}`}>{done ? "✓" : n}</span>{children}</h2>;
}

const [HEAD, ...LINES] = CARRIER_SAMPLE_CSV.trim().split("\n");
const HEADERS = HEAD.split(";");
const ROWS = LINES.map((l) => l.split(";"));

export function CarrierImportForm() {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<CarrierPreview | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [policy, setPolicy] = useState<CarrierPolicy>("overwrite");
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const fd = (f: File | null = file, p: CarrierPolicy = policy) => { const d = new FormData(); if (f) d.set("file", f); d.set("dupPolicy", p); return d; };
  const check = (f?: File) => start(async () => { const r = await previewCarrierImportAction(fd(f ?? file)); setAck(false); setPrev(r); if (!r.ok) toast("bad", r.message); });
  const pickFile = (f: File | null, auto?: boolean) => { setPrev(null); setDetails([]); setFile(f); if (f && auto) check(f); };
  const reset = () => { setPrev(null); setFile(null); setPolicy("overwrite"); };
  const apply = () => start(async () => { const r = await applyCarrierImportAction(fd()); toast(r.ok ? "ok" : "bad", r.message); setDetails(r.details ?? []); if (r.ok) reset(); });

  return (
    <div className="space-y-5">
      <section className={`${panelCls} p-5`}>
        <Step n={1} done={!!file}>Modelo da planilha</Step>
        <ImportExample headers={HEADERS} rows={ROWS} required={["UF", "TIPO", "TRANSPORTADORA"]} fileName="modelo-transportadoras.csv" guide={CARRIER_GUIDE} />
      </section>

      <section className={`${panelCls} p-5`}>
        <Step n={2} done={!!prev?.ok}>Escolha o arquivo (CSV ou Excel .xlsx)</Step>
        <ImportFilePicker file={file} checking={pending} busy={pending} hasResult={!!prev} noun="transportadoras" onPick={pickFile} onCheck={() => check()} onReset={reset} />
      </section>

      {prev && !prev.ok && file && needsMapping(prev.message) && (
        <section className={`${panelCls} space-y-4 border-warn/60 p-5`}>
          <h2 className="flex items-center gap-2.5 text-lg font-semibold"><span className="grid size-8 place-items-center rounded-full bg-warn/20 text-warn"><CircleHelp size={18} aria-hidden /></span> Preciso da sua ajuda com as colunas</h2>
          <p className="text-sm text-muted">{prev.message} Isso acontece quando os títulos das colunas têm outros nomes. Abra a edição, diga o que é cada coluna e o sistema reconfere sozinho.</p>
          <ImportEditor kind="carriers" file={file} busy={pending} onApply={(f) => { setFile(f); check(f); }} />
        </section>
      )}

      {prev?.ok && (
        <section className={`${panelCls} space-y-4 p-5`}>
          <Step n={3}>Confira antes de importar</Step>
          <ImportInsight info={prev.insight} ack={ack} onAck={setAck} />
          {file && <ImportEditor kind="carriers" file={file} busy={pending} onApply={(f) => { setFile(f); check(f); }} />}
          <fieldset className="max-w-2xl space-y-2 rounded-xl border border-line p-4 text-sm">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Se a transportadora já existir (mesmo estado, tipo e nome)</legend>
            {([["overwrite", "Atualizar com a planilha", "Percentuais, prazos, mínimo e contato passam a valer os da planilha."], ["fill", "Completar só o que falta", "Preenche apenas campos vazios da transportadora existente."], ["skip", "Não mexer nas existentes", "Só entram as transportadoras novas."]] as const).map(([v, t, h]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${policy === v ? "border-accent bg-grad-soft" : "border-line"}`}>
                <input type="radio" name="cdup" className="mt-1" checked={policy === v} onChange={() => setPolicy(v)} />
                <span><b className="block">{t}</b><span className="text-xs text-muted">{h}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Transportadoras no arquivo" value={prev.total} />
            <Stat label="Novas" value={prev.fresh} tone="ok" />
            <Stat label="Já existem" value={prev.existing} tone={prev.existing ? "warn" : undefined} />
            <Stat label="Linhas rejeitadas" value={prev.rejected} tone={prev.rejected ? "bad" : undefined} />
          </div>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">{prev.sample.map((s, i) => <li key={i} className="rounded-xl border border-line bg-sunk/50 px-3 py-1.5">{s.uf} · {s.mode} · <b>{s.name}</b> · {pct(s.capitalPct)} / {pct(s.interiorPct)}</li>)}</ul>
          {prev.warnings.length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm"><p className="mb-1 flex items-center gap-1.5 font-medium text-warn"><AlertTriangle size={15} aria-hidden /> Avisos</p>{prev.warnings.map((w) => <p key={w} className="text-muted">{w}</p>)}</div>}
          <button type="button" className={`${btnPrimary} !px-6 !py-3 text-base`} disabled={pending || hasBlocker(prev.insight.checks) || (needsAck(prev.insight.checks) && !ack) || (policy === "skip" && prev.fresh === 0)} onClick={apply}>{pending ? <Spinner size={18} /> : <Upload size={18} aria-hidden />} {pending ? "Importando…" : "Importar transportadoras"}</button>
        </section>
      )}
      {details.length > 0 && <section className={`${panelCls} space-y-1 p-5 text-sm`}>{details.map((d) => <p key={d} className="text-muted">{d}</p>)}</section>}
      <p className="text-center text-xs text-muted"><Link href="/transportadoras" className="hover:text-accent">← Voltar para Transportadoras</Link></p>
    </div>
  );
}
