"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, MapPin, Upload, Users, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { LEAD_GUIDE, REP_GUIDE } from "@/config/import-guide";
import { ImportExample } from "@/components/import-example";
import { applyImportAction, previewImportAction, type ImportPreview } from "@/modules/import/actions";

const KINDS = [
  { key: "leads", title: "Leads", sub: "Planilha DB_LD", Icon: Users },
  { key: "reps", title: "Representantes", sub: "Planilha DB_RP", Icon: MapPin },
] as const;

const EXAMPLES = {
  leads: {
    headers: ["CNPJ", "EMPRESA", "COD SAP", "CONTATO", "TELEFONE", "CARGO", "EMAIL", "OBSERVACAO"],
    rows: [
      ["00.000.000/0001-91", "EMPRESA EXEMPLO LTDA", "123456", "Maria", "(47) 99999-0000", "Compradora", "maria@exemplo.com", "Pediu retorno em novembro"],
      ["11.111.111/0001-91", "COMÉRCIO ÁGUA BRANCA", "", "João", "(47) 3333-0000", "", "", "Cotação enviada, aguardando aprovação"],
    ],
    required: ["CNPJ"],
    file: "modelo-leads.csv",
  },
  reps: {
    headers: ["ESC", "GESTOR", "EQUIPE", "COD SAP", "CNPJ", "ENDERECO", "CEP", "CIDADE", "UF", "NOME REP", "ATIVO"],
    rows: [["ESC 01", "Carlos", "Sul", "900100", "22.222.222/0001-91", "Rua das Flores, 100", "89130-000", "Indaial", "SC", "REPRESENTAÇÕES SILVA", "SIM"]],
    required: ["COD SAP", "NOME REP"],
    file: "modelo-representantes.csv",
  },
} as const;

const nf = new Intl.NumberFormat("pt-BR");

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "";
  return <div className="rounded-xl border border-line bg-panel p-3.5"><p className="text-xs text-muted">{label}</p><p className={`figure mt-1 text-2xl font-semibold ${color}`}>{nf.format(value)}</p></div>;
}

function StepTitle({ n, children, done }: { n: number; children: React.ReactNode; done?: boolean }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
      <span className={`flex size-7 items-center justify-center rounded-full text-sm ${done ? "bg-ok text-white" : "bg-grad text-on-accent"}`}>{done ? "✓" : n}</span>
      {children}
    </h2>
  );
}

export function ImportForm() {
  const toast = useToast();
  const [kind, setKind] = useState<"leads" | "reps">("leads");
  const [leadKind, setLeadKind] = useState<"prospect" | "inativo">("prospect");
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<ImportPreview | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const input = useRef<HTMLInputElement>(null);
  const fd = () => { const d = new FormData(); d.set("kind", kind); d.set("leadKind", leadKind); if (file) d.set("file", file); return d; };
  const pick = (f: File | null | undefined) => { setFile(f ?? null); setPrev(null); setDetails([]); };
  const reset = () => { setPrev(null); setFile(null); if (input.current) input.current.value = ""; };
  const current = KINDS.find((k) => k.key === kind)!;

  const check = () => start(async () => { const r = await previewImportAction(fd()); setPrev(r); if (!r.ok) toast("bad", r.message); });
  const apply = () => start(async () => {
    const r = await applyImportAction(fd());
    toast(r.ok ? "ok" : "bad", r.message);
    setDetails(r.details ?? []);
    if (r.ok) reset();
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className={`${panelCls} p-5`}>
        <StepTitle n={1} done={!!file}>O que você vai importar?</StepTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map(({ key, title, sub, Icon }) => (
            <button key={key} type="button" aria-pressed={kind === key} onClick={() => { setKind(key); reset(); setDetails([]); }}
              className={`flex items-center gap-3.5 rounded-xl border-2 p-4 text-left transition ${kind === key ? "border-accent bg-sunk shadow-sm" : "border-line hover:border-muted"}`}>
              <span className="flex size-12 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }}><Icon size={24} aria-hidden /></span>
              <span><span className="block text-lg font-semibold">{title}</span><span className="text-sm text-muted">{sub}</span></span>
            </button>
          ))}
        </div>
        {kind === "leads" && (
          <div role="radiogroup" aria-label="Tipo dos leads" className="mt-3 inline-flex rounded-xl border border-line bg-sunk/50 p-1">
            {([["prospect", "Novos (Shuffler do SDR)"], ["inativo", "Inativos (Shuffler de vendas)"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={leadKind === k} onClick={() => setLeadKind(k)} className={`min-h-9 rounded-lg px-4 text-sm font-medium transition ${leadKind === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="mt-4"><ImportExample {...EXAMPLES[kind]} fileName={EXAMPLES[kind].file} guide={kind === "leads" ? LEAD_GUIDE : REP_GUIDE} /></div>
      </section>

      <section className={`${panelCls} p-5`}>
        <StepTitle n={2} done={!!prev?.ok}>Escolha o arquivo CSV</StepTitle>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-accent bg-sunk [&_*]:pointer-events-none" : "border-line"}`}>
          {file ? (
            <>
              <FileSpreadsheet size={36} className="text-accent" aria-hidden />
              <p className="font-semibold">{file.name}</p>
              <p className="text-sm text-muted">{(file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={btnPrimary} disabled={pending} onClick={check}>{pending && !prev ? <Spinner size={16} /> : <CheckCircle2 size={16} aria-hidden />} Conferir arquivo</button>
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
          <StepTitle n={3}>Confira antes de importar</StepTitle>
          {prev.kind === "leads" ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Linhas no arquivo" value={prev.report.total} />
                <Stat label="Válidas" value={prev.report.valid} tone="ok" />
                <Stat label="Repetidas no arquivo" value={prev.report.duplicatesInFile} tone={prev.report.duplicatesInFile ? "warn" : undefined} />
                <Stat label="Rejeitadas" value={prev.report.rejected.length} tone={prev.report.rejected.length ? "bad" : undefined} />
              </div>
              {Object.keys(prev.report.fixes).length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm"><p className="mb-1 font-medium">Correções automáticas</p>{Object.entries(prev.report.fixes).map(([k, v]) => <p key={k} className="text-muted">{k} ({nf.format(v as number)})</p>)}</div>}
              {prev.report.warnings.length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm"><p className="mb-1 flex items-center gap-1.5 font-medium text-warn"><AlertTriangle size={15} aria-hidden /> Avisos</p>{prev.report.warnings.slice(0, 6).map((w) => <p key={w} className="text-muted">{w}</p>)}</div>}
              {prev.report.rejected.length > 0 && <div className="rounded-lg border border-danger/40 p-3 text-sm"><p className="mb-1 font-medium text-danger">Linhas rejeitadas (primeiras {Math.min(8, prev.report.rejected.length)})</p>{prev.report.rejected.slice(0, 8).map((r) => <p key={r.line}>Linha {r.line}: {r.reason}{r.company ? ` (${r.company})` : ""}</p>)}</div>}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Representantes" value={prev.total} tone="ok" /></div>
              {prev.warnings.length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm">{prev.warnings.map((w) => <p key={w} className="text-muted">{w}</p>)}</div>}
            </>
          )}
          <button type="button" className={`${btnPrimary} !px-6 !py-3 text-base`} disabled={pending} onClick={apply}>{pending ? <Spinner size={18} /> : <Upload size={18} aria-hidden />} Importar agora</button>
        </section>
      )}

      {details.length > 0 && <section className={`${panelCls} space-y-1 p-5 text-sm`}><p className="mb-1 font-medium">Detalhes da importação</p>{details.map((d) => <p key={d} className="text-muted">{d}</p>)}</section>}
    </div>
  );
}
