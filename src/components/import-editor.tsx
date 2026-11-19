"use client";

import Papa from "papaparse";
import { ChevronLeft, ChevronRight, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { decodeCsv, parseCsv } from "@/modules/import/csv";

const PAGE = 20;
type Row = { id: number; cells: string[] };

/** Edição direta dos dados do CSV na prévia: células, cabeçalhos e remoção de linhas. Gera um novo CSV e devolve ao formulário para reconferir. */
export function ImportEditor({ file, busy, onApply }: { file: File; busy?: boolean; onApply: (f: File) => void }) {
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [orig, setOrig] = useState<{ headers: string[]; rows: Row[] } | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || orig?.headers.length) return;
    let alive = true;
    file.arrayBuffer().then((buf) => {
      if (!alive) return;
      try {
        const p = parseCsv(decodeCsv(buf));
        const r = p.rows.slice(0, 20000).map((o, i) => ({ id: i, cells: p.headers.map((h) => o[h] ?? "") }));
        setHeaders(p.headers); setRows(r); setOrig({ headers: p.headers, rows: r });
      } catch { setErr("Não consegui abrir o arquivo para edição."); }
    });
    return () => { alive = false; };
  }, [open, file, orig]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.cells.some((c) => c.toLowerCase().includes(t))) : rows;
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  const setCell = (id: number, c: number, v: string) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, cells: r.cells.map((x, i) => (i === c ? v : x)) } : r))); setDirty(true); };
  const setHead = (c: number, v: string) => { setHeaders((h) => h.map((x, i) => (i === c ? v : x))); setDirty(true); };
  const del = (id: number) => { setRows((rs) => rs.filter((r) => r.id !== id)); setDirty(true); };
  const undo = () => { if (!orig) return; setHeaders(orig.headers); setRows(orig.rows); setDirty(false); };
  const apply = () => {
    const csv = Papa.unparse({ fields: headers, data: rows.map((r) => r.cells) });
    onApply(new File([csv], file.name, { type: "text/csv" }));
    setOrig({ headers, rows }); setDirty(false);
  };

  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
        <Pencil size={16} aria-hidden /> Editar os dados antes de importar
        <span className="ml-auto text-xs font-normal text-muted">{open ? "Fechar" : "Corrigir células, cabeçalhos e remover linhas"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-4">
          {err && <p className="text-sm text-danger">{err}</p>}
          {!orig && !err && <p className="text-sm text-muted">Abrindo…</p>}
          {orig && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-48 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                  <input className={`${inputCls} pl-9`} placeholder="Buscar nas linhas…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Buscar nas linhas" /></label>
                <span className="text-xs text-muted">{filtered.length.toLocaleString("pt-BR")} linha(s){rows.length >= 20000 ? " (limite de 20.000)" : ""}</span>
                <button type="button" className={btnGhost} disabled={!dirty || busy} onClick={undo}><RotateCcw size={14} aria-hidden /> Desfazer</button>
                <button type="button" className={btnPrimary} disabled={!dirty || busy} onClick={apply}>Aplicar edições e reconferir</button>
              </div>
              <div className="no-sb max-h-[28rem] overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-max text-sm">
                  <thead className="sticky top-0 z-10 bg-sunk">
                    <tr><th className="w-10 p-1.5" />
                      {headers.map((h, c) => <th key={c} className="p-1"><input aria-label={`Cabeçalho ${c + 1}`} className={`${inputCls} !min-h-8 !py-1 text-xs font-semibold uppercase`} value={h} onChange={(e) => setHead(c, e.target.value)} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {view.map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="p-1 text-center"><button type="button" aria-label="Remover linha" title="Remover linha" onClick={() => del(r.id)} className="rounded-md p-1.5 text-muted hover:bg-sunk hover:text-danger"><Trash2 size={14} aria-hidden /></button></td>
                        {r.cells.map((v, c) => <td key={c} className="p-1"><input aria-label={`${headers[c]} linha ${r.id + 2}`} className={`${inputCls} !min-h-8 !py-1 min-w-32`} value={v} onChange={(e) => setCell(r.id, c, e.target.value)} /></td>)}
                      </tr>
                    ))}
                    {view.length === 0 && <tr><td colSpan={headers.length + 1} className="p-4 text-center text-muted">Nenhuma linha.</td></tr>}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <button type="button" className={btnGhost} disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Página anterior"><ChevronLeft size={15} aria-hidden /></button>
                  <span className="text-muted">Página {cur + 1} de {pages}</span>
                  <button type="button" className={btnGhost} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Próxima página"><ChevronRight size={15} aria-hidden /></button>
                </div>
              )}
              <p className="text-xs text-muted">As edições geram um novo arquivo e a conferência roda de novo. Nada é gravado no sistema até você clicar em importar.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
