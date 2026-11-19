"use client";

import { Download } from "lucide-react";
import { ImportGuide } from "@/components/import-guide";
import { btnGhost } from "@/components/ui";
import type { GuideCol } from "@/config/import-guide";

const cell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Baixa o exemplo montado aqui mesmo, em UTF-8 com BOM, para o Excel não trocar os acentos por "?". */
function download(name: string, headers: readonly string[], rows: readonly (readonly string[])[]) {
  const csv = [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exemplo da planilha numa tabela, ali mesmo na tela, com o download do mesmo exemplo. */
export function ImportExample({ headers, rows, required, fileName, guide, extra }: { guide?: GuideCol[]; extra?: Record<string, string[]>; headers: readonly string[]; rows: readonly (readonly string[])[]; required: readonly string[]; fileName: string }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-sunk/70">
            <tr>{headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}{required.includes(h) && <span title="Obrigatória" className="ml-1 rounded bg-accent/15 px-1 text-[10px] text-accent">obrigatória</span>}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line/60">{r.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5 text-muted">{v || <span className="opacity-40">—</span>}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {guide && <ImportGuide cols={guide} extra={extra} />}
      <button type="button" className={btnGhost} onClick={() => download(fileName, headers, rows)}><Download size={16} aria-hidden /> Baixar exemplo (CSV)</button>
    </div>
  );
}
