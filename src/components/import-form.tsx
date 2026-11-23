"use client";

import { AlertTriangle, Check, CircleHelp, FileSpreadsheet, Layers, ListChecks, MapPin, PackageCheck, PlusCircle, Sparkles, Upload, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { LEAD_GUIDE, REP_GUIDE } from "@/config/import-guide";
import { ImportFilePicker } from "@/components/import-file-picker";
import { ImportEditor } from "@/components/import-editor";
import { needsMapping } from "@/modules/import/fields";
import { ImportExample } from "@/components/import-example";
import { hasBlocker, ImportInsight, needsAck } from "@/components/import-insight";
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
  const [leadKind, setLeadKind] = useState<"prospect" | "inativo" | "global">("prospect");
  const [mode, setMode] = useState<"novos" | "nutrir" | "ambos">("ambos");
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<ImportPreview | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const fd = (f: File | null = file) => { const d = new FormData(); d.set("kind", kind); d.set("leadKind", leadKind); d.set("mode", mode); if (f) d.set("file", f); return d; };
  const pickFile = (f: File | null, auto?: boolean) => { setFile(f); setPrev(null); setDetails([]); if (f && auto) check(f); };
  const reset = () => { setPrev(null); setFile(null); };
  const current = KINDS.find((k) => k.key === kind)!;

  const check = (f?: File, m: typeof mode = mode) => start(async () => { const d = fd(f); d.set("mode", m); const r = await previewImportAction(d); setAck(false); setPrev(r); if (!r.ok) toast("bad", r.message); });
  const changeKind = (k: typeof leadKind) => { setLeadKind(k); if (k === "global") { setMode("nutrir"); if (file && prev?.ok) check(undefined, "nutrir"); } };
  const changeMode = (m: typeof mode) => { setMode(m); if (file && prev?.ok) check(undefined, m); };
  const apply = () => start(async () => {
    const r = await applyImportAction(fd());
    toast(r.ok ? "ok" : "bad", r.message);
    setDetails(r.details ?? []);
    if (r.ok) reset();
  });

  const stage = !file ? 0 : !prev?.ok ? 1 : 2;
  const TRACK = [{ t: "Escolher", i: ListChecks }, { t: "Arquivo", i: FileSpreadsheet }, { t: "Revisar", i: Sparkles }, { t: "Importar", i: PackageCheck }] as const;
  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-4 gap-2" aria-label="Etapas da importação">
        {TRACK.map((s, i) => { const done = i < stage, cur = i === stage;
          return <li key={s.t} className={`flex items-center justify-center gap-2 rounded-2xl border p-2.5 text-sm font-semibold transition ${cur ? "border-accent bg-grad-soft text-accent shadow-md" : done ? "border-accent/40 text-accent" : "border-line text-muted"}`}><span className={`grid size-8 place-items-center rounded-xl ${cur ? "bg-grad text-on-accent step-ping" : done ? "bg-accent/15" : "bg-panel"}`}>{done ? <Check size={16} aria-hidden /> : <s.i size={16} aria-hidden />}</span><span className="hidden sm:inline">{s.t}</span></li>; })}
      </ol>
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
            {([["prospect", "Novos (Shuffler Prospecção)"], ["inativo", "Inativos (Shuffler Vendas)"], ["global", "Todos (SDR e Vendas) · só enriquecer"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={leadKind === k} onClick={() => changeKind(k)} className={`min-h-9 rounded-lg px-4 text-sm font-medium transition ${leadKind === k ? "bg-grad text-on-accent shadow-sm" : "text-muted hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        )}
        {kind === "leads" && leadKind === "global" && <p className="mt-2 max-w-2xl text-sm text-muted">Completa os leads que já existem, estejam no Shuffler Prospecção ou no Vendas (telefone, e-mail, contato, tags, Código EOX, ID EOX e Id Salesforce). Ninguém novo é criado e nenhum dado existente é trocado.</p>}
        <div className="mt-4"><ImportExample {...EXAMPLES[kind]} fileName={EXAMPLES[kind].file} guide={kind === "leads" ? LEAD_GUIDE : REP_GUIDE} /></div>
      </section>

      <section className={`${panelCls} p-5`}>
        <StepTitle n={2} done={!!prev?.ok}>Escolha o arquivo (CSV ou Excel .xlsx)</StepTitle>
        <ImportFilePicker file={file} checking={pending} busy={pending} hasResult={!!prev} noun={kind === "leads" ? "leads" : "representantes"} onPick={pickFile} onCheck={() => check()} onReset={reset} />
      </section>

      {prev && !prev.ok && file && needsMapping(prev.message) && (
        <section className={`${panelCls} space-y-4 border-warn/60 p-5`}>
          <h2 className="flex items-center gap-2.5 text-lg font-semibold"><span className="grid size-8 place-items-center rounded-full bg-warn/20 text-warn"><CircleHelp size={18} aria-hidden /></span> Preciso da sua ajuda com as colunas</h2>
          <p className="text-sm text-muted">{prev.message} Isso acontece quando os títulos das colunas têm outros nomes. Abra a edição, diga o que é cada coluna e o sistema reconfere sozinho.</p>
          <ImportEditor kind={kind} file={file} busy={pending} onApply={(f) => { setFile(f); check(f); }} />
        </section>
      )}

      {prev?.ok && (
        <section className={`${panelCls} space-y-4 p-5`}>
          <StepTitle n={3}>Confira antes de importar</StepTitle>
          <ImportInsight info={prev.insight} ack={ack} onAck={setAck} />
          {prev.kind === "leads" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Como importar?</p>
              <div role="radiogroup" aria-label="Como importar" className="grid gap-3 md:grid-cols-3">
                {([
                  ["ambos", "Importar e enriquecer", "Entram os novos e quem já existe recebe só a informação nova.", Layers, `${nf.format(prev.fresh)} novos · ${nf.format(prev.enrich)} enriquecidos`],
                  ["novos", "Importar só os novos", "Os que já estão no sistema ficam exatamente como estão (sem duplicar).", PlusCircle, `${nf.format(prev.fresh)} novos · ${nf.format(prev.existing)} ignorados`],
                  ["nutrir", "Só enriquecer os atuais", "Ninguém novo entra: só completa telefone, e-mail, contato e tags de quem já existe.", Sparkles, `${nf.format(prev.enrich)} enriquecidos · ${nf.format(prev.fresh)} não entram`],
                ] as const).map(([k, t, d, I, c]) => (
                  <button key={k} type="button" role="radio" aria-checked={mode === k} disabled={pending || (leadKind === "global" && k !== "nutrir")} onClick={() => changeMode(k)}
                    className={`relative flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 ${mode === k ? "border-accent bg-grad-soft shadow-lg" : "border-line bg-panel hover:border-accent/50"}`}>
                    <span className="flex w-full items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl ${mode === k ? "bg-grad text-on-accent" : "bg-sunk text-muted"}`}><I size={20} aria-hidden /></span>{mode === k && <span className="grid size-6 place-items-center rounded-full bg-accent text-on-accent"><Check size={14} aria-hidden /></span>}</span>
                    <span className="font-bold">{t}</span><span className="text-xs text-muted">{d}</span><span className="figure mt-1 rounded-full bg-sunk px-2.5 py-1 text-xs font-semibold">{c}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {file && <ImportEditor kind={kind} file={file} busy={pending} onApply={(f) => { setFile(f); check(f); }} />}
          {prev.kind === "leads" ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                <Stat label="Linhas no arquivo" value={prev.report.total} />
                <Stat label="Válidas" value={prev.report.valid} tone="ok" />
                <Stat label="Repetidas no arquivo" value={prev.report.duplicatesInFile} tone={prev.report.duplicatesInFile ? "warn" : undefined} />
                <Stat label="Rejeitadas" value={prev.report.rejected.length} tone={prev.report.rejected.length ? "bad" : undefined} />
                <Stat label="Novos no sistema" value={prev.fresh} tone="ok" />
                <Stat label="Já existem" value={prev.existing} tone={prev.existing ? "warn" : undefined} /><Stat label="Recebem info nova" value={prev.enrich} tone={prev.enrich ? "ok" : undefined} />
              </div>
              {Object.keys(prev.report.fixes).length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm"><p className="mb-1 font-medium">Correções automáticas</p>{Object.entries(prev.report.fixes).map(([k, v]) => <p key={k} className="text-muted">{k} ({nf.format(v as number)})</p>)}</div>}
              {prev.report.warnings.length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm"><p className="mb-1 flex items-center gap-1.5 font-medium text-warn"><AlertTriangle size={15} aria-hidden /> Avisos</p>{prev.report.warnings.slice(0, 6).map((w) => <p key={w} className="text-muted">{w}</p>)}</div>}
              {prev.report.rejected.length > 0 && <div className="rounded-lg border border-danger/40 p-3 text-sm"><p className="mb-1 font-medium text-danger">Linhas rejeitadas (primeiras {Math.min(8, prev.report.rejected.length)})</p>{prev.report.rejected.slice(0, 8).map((r) => <p key={r.line}>Linha {r.line}: {r.reason}{r.company ? ` (${r.company})` : ""}</p>)}</div>}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Representantes" value={prev.total} tone="ok" /><Stat label="Novos" value={prev.fresh} tone="ok" /><Stat label="Atualizados" value={prev.existing} tone={prev.existing ? "warn" : undefined} /></div>
              {prev.warnings.length > 0 && <div className="rounded-lg bg-sunk p-3 text-sm">{prev.warnings.map((w) => <p key={w} className="text-muted">{w}</p>)}</div>}
            </>
          )}
          <button type="button" className={`${btnPrimary} !px-6 !py-3 text-base`} disabled={pending || hasBlocker(prev.insight.checks) || (needsAck(prev.insight.checks) && !ack) || (prev.kind === "leads" && ((mode === "novos" && prev.fresh === 0) || (mode === "nutrir" && prev.enrich === 0)))} onClick={apply}>{pending ? <Spinner size={18} /> : <Upload size={18} aria-hidden />} {prev.kind === "leads" && mode === "nutrir" ? "Enriquecer agora" : "Importar agora"}</button>
        </section>
      )}

      {details.length > 0 && <section className={`${panelCls} space-y-1 p-5 text-sm`}><p className="mb-1 font-medium">Detalhes da importação</p>{details.map((d) => <p key={d} className="text-muted">{d}</p>)}</section>}
    </div>
  );
}
