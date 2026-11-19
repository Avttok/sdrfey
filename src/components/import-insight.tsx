"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { Check, FileInsight } from "@/modules/import/insight";

const TONE = { bad: ["border-danger/40 bg-danger/10 text-danger", AlertOctagon], warn: ["border-warn/40 bg-warn/10 text-warn", AlertTriangle], info: ["border-line bg-sunk text-muted", Info], ok: ["border-ok/40 bg-ok/10 text-ok", CheckCircle2] } as const;
const nf = new Intl.NumberFormat("pt-BR");

/** Precisa o usuário marcar "li os avisos" para importar? */
export const needsAck = (checks: Check[]) => checks.some((c) => c.level === "bad" || c.level === "warn");
export const hasBlocker = (checks: Check[]) => checks.some((c) => c.level === "bad");

export function ImportInsight({ info, ack, onAck }: { info: FileInsight; ack: boolean; onAck: (v: boolean) => void }) {
  const order = { bad: 0, warn: 1, info: 2, ok: 3 } as const;
  const checks = [...info.checks].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Arquivo", info.fileName, true], ["Tamanho", `${nf.format(info.sizeKb)} KB`], ["Linhas de dados", nf.format(info.totalRows)], ["Colunas", `${info.columns.length} (${info.columns.filter((c) => c.field).length} reconhecidas)`]].map(([l, v, trunc]) => (
          <div key={String(l)} className="rounded-xl border border-line bg-panel p-3"><p className="text-xs text-muted">{l}</p><p className={`mt-0.5 font-semibold ${trunc ? "truncate" : "figure text-lg"}`} title={String(v)}>{v}</p></div>
        ))}
      </div>

      <ul className="space-y-2" aria-label="Avisos da importação">
        {checks.map((c, i) => { const [cls, Icon] = TONE[c.level]; return <li key={i} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}><Icon size={17} className="mt-0.5 shrink-0" aria-hidden /><span className={c.level === "info" || c.level === "ok" ? "text-ink" : "font-medium text-ink"}>{c.text}</span></li>; })}
      </ul>

      <details className="group rounded-xl border border-line bg-panel" open>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">Colunas do arquivo <span className="font-normal text-muted">· o que cada uma vira no sistema e quanto está preenchida</span></summary>
        <ul className="divide-y divide-line/70 border-t border-line">
          {info.columns.map((c) => {
            const pct = info.totalRows ? Math.round((c.filled / info.totalRows) * 100) : 0;
            return (
              <li key={c.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem] items-center gap-3 px-4 py-2 text-sm max-sm:grid-cols-[minmax(0,1fr)_5rem]">
                <span className="truncate font-medium" title={c.name}>{c.name || "(sem nome)"}</span>
                <span className={`truncate max-sm:hidden ${c.field ? "text-ink" : "text-muted"}`}>{c.field ? `→ ${c.field}` : "ignorada"}</span>
                <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk"><span className={`block h-full rounded-full ${pct < 20 ? "bg-warn" : "bg-grad"}`} style={{ width: `${pct}%` }} /></span><span className="figure w-9 text-right text-xs text-muted">{pct}%</span></span>
              </li>
            );
          })}
        </ul>
        {info.missingOptional.length > 0 && <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Colunas opcionais que não vieram no arquivo: {info.missingOptional.join(", ")}.</p>}
      </details>

      <details className="rounded-xl border border-line bg-panel">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">Amostra das primeiras linhas <span className="font-normal text-muted">· como o arquivo foi lido</span></summary>
        <div className="no-sb overflow-x-auto border-t border-line">
          <table className="w-full text-xs"><thead><tr>{info.sample.headers.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-muted">{h}</th>)}</tr></thead>
            <tbody>{info.sample.rows.map((r, i) => <tr key={i} className="border-t border-line/70">{r.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{v}</td>)}</tr>)}</tbody></table>
        </div>
      </details>

      {needsAck(info.checks) && !hasBlocker(info.checks) && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-sm font-medium"><input type="checkbox" className="mt-0.5 size-4" checked={ack} onChange={(e) => onAck(e.target.checked)} /> Li os avisos acima e quero importar mesmo assim.</label>
      )}
      {hasBlocker(info.checks) && <p className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-sm font-semibold text-danger">Há problemas graves. Corrija o arquivo ou escolha o tipo certo antes de importar.</p>}
    </div>
  );
}
