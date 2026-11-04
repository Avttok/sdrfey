"use client";

import { Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { applyImportAction, previewImportAction, type ImportPreview } from "@/modules/import/actions";

export function ImportForm() {
  const toast = useToast();
  const [kind, setKind] = useState<"leads" | "reps">("leads");
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<ImportPreview | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const fd = () => { const d = new FormData(); d.set("kind", kind); if (file) d.set("file", file); return d; };

  return (
    <div className={`${panelCls} max-w-3xl space-y-4 p-5`}>
      <div className="flex gap-2">
        {([["leads", "Leads (DB_LD)"], ["reps", "Representantes (DB_RP)"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setPrev(null); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${kind === k ? "bg-accent text-on-accent" : "border border-line hover:bg-sunk"}`}>{l}</button>)}
      </div>
      <p className="text-sm text-muted">{kind === "leads" ? "Só o CNPJ é obrigatório; o resto é completado pela consulta. CNPJs que já existem são mantidos, nada é sobrescrito." : "Atualiza pelo código SAP e acha as coordenadas pela cidade."}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPrev(null); setDetails([]); }} />
        <button type="button" className={btnGhost} disabled={!file || pending} onClick={() => start(async () => { const r = await previewImportAction(fd()); setPrev(r); if (!r.ok) toast("bad", r.message); })}><Upload size={15} aria-hidden /> Conferir arquivo</button>
      </div>
      {prev?.ok && prev.kind === "leads" && (
        <div className="space-y-2 rounded-lg bg-sunk p-4 text-sm">
          <p><b>{prev.fileName}</b>: {prev.report.total} linhas · {prev.report.valid} válidas · {prev.report.duplicatesInFile} repetidas no arquivo · {prev.report.rejected.length} rejeitadas</p>
          {Object.entries(prev.report.fixes).map(([k, v]) => <p key={k} className="text-muted">Correção automática: {k} ({v})</p>)}
          {prev.report.warnings.slice(0, 5).map((w) => <p key={w} className="text-muted">Aviso: {w}</p>)}
          {prev.report.rejected.slice(0, 5).map((r) => <p key={r.line} className="text-danger">Linha {r.line}: {r.reason} {r.company && `(${r.company})`}</p>)}
        </div>
      )}
      {prev?.ok && prev.kind === "reps" && <div className="rounded-lg bg-sunk p-4 text-sm"><b>{prev.fileName}</b>: {prev.total} representantes{prev.warnings.map((w) => <p key={w} className="text-muted">{w}</p>)}</div>}
      {details.map((d) => <p key={d} className="text-sm text-muted">{d}</p>)}
      {prev?.ok && <button type="button" className={btnPrimary} disabled={pending} onClick={() => start(async () => { const r = await applyImportAction(fd()); toast(r.ok ? "ok" : "bad", r.message); setDetails(r.details ?? []); if (r.ok) { setPrev(null); setFile(null); if (input.current) input.current.value = ""; } })}>Importar agora</button>}
    </div>
  );
}
