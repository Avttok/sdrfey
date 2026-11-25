"use client";

import Papa from "papaparse";
import { Check, ChevronLeft, ChevronRight, CircleHelp, EyeOff, Pencil, RotateCcw, Search, Sparkles, Trash2, TriangleAlert, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { decodeCsv, parseCsv } from "@/modules/import/csv";
import { colLetter, FIELDS, fieldOfHeader, IGNORE_HEADER, suggestField, type FieldInfo, type ImportKind } from "@/modules/import/fields";
import { headerKey } from "@/modules/import/normalize";

const PAGE = 50;
type Row = { id: number; cells: string[] };

/** Edição direta dos dados do CSV na prévia: células, cabeçalhos e remoção de linhas. Gera um novo CSV e devolve ao formulário para reconferir. */
export function ImportEditor({ file, kind, busy, onApply }: { file: File; kind: ImportKind; busy?: boolean; onApply: (f: File) => void }) {
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [orig, setOrig] = useState<{ headers: string[]; rows: Row[] } | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const go = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  useEffect(() => {
    let alive = true;
    setOrig(null); setErr(""); setDirty(false);
    file.arrayBuffer().then((buf) => {
      if (!alive) return;
      try {
        const p = parseCsv(decodeCsv(buf));
        const r = p.rows.slice(0, 20000).map((o, i) => ({ id: i, cells: p.headers.map((h) => o[h] ?? "") }));
        setHeaders(p.headers); setRows(r); setOrig({ headers: p.headers, rows: r });
      } catch { setErr("Não consegui abrir o arquivo para edição."); }
    });
    return () => { alive = false; };
  }, [file]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.cells.some((c) => c.toLowerCase().includes(t))) : rows;
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  const setCell = (id: number, c: number, v: string) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, cells: r.cells.map((x, i) => (i === c ? v : x)) } : r))); setDirty(true); };
  const setHead = (c: number, v: string) => { setHeaders((h) => h.map((x, i) => (i === c ? v : x))); setDirty(true); };
  const colInfo = useMemo(() => headers.map((h, c) => {
    const field = fieldOfHeader(kind, h);
    const ignored = headerKey(h) === IGNORE_HEADER;
    const sample = field || ignored ? [] : rows.slice(0, 60).map((r) => r.cells[c] ?? "");
    return { field, ignored, sample };
  }), [headers, rows, kind]);
  const usedKeys = new Set(colInfo.flatMap((i) => (i.field ? [i.field.key] : [])));
  const suggestions = colInfo.map((i, c) => { const f = i.field || i.ignored ? null : suggestField(kind, i.sample, orig?.headers[c] ?? headers[c]); return f && !usedKeys.has(f.key) ? f : null; });
  const missing = FIELDS[kind].filter((f) => f.required && !usedKeys.has(f.key));
  const unknownCount = colInfo.filter((i, c) => !i.field && !i.ignored && headers[c].trim()).length;
  const sugCount = suggestions.filter(Boolean).length;
  const pick = (c: number, v: string) => {
    if (v === "__ignore") return setHead(c, IGNORE_HEADER);
    if (v === "") return setHead(c, orig?.headers[c] ?? headers[c]);
    const f = FIELDS[kind].find((x) => x.key === v);
    if (f) setHead(c, f.header);
  };
  const acceptAll = () => { const taken = new Set(usedKeys); setHeaders((hs) => hs.map((h, c) => { const f = suggestions[c]; if (f && !taken.has(f.key)) { taken.add(f.key); return f.header; } return h; })); setDirty(true); };
  const del = (id: number) => { setRows((rs) => rs.filter((r) => r.id !== id)); setDirty(true); };
  const undo = () => { if (!orig) return; setHeaders(orig.headers); setRows(orig.rows); setDirty(false); };
  const apply = () => {
    const csv = Papa.unparse({ fields: headers, data: rows.map((r) => r.cells) });
    onApply(new File([csv], file.name, { type: "text/csv" }));
    setOrig({ headers, rows }); setDirty(false);
  };

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    const prevOv = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prevOv; };
  }, [open]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" disabled={!orig && !err}
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 border-accent/60 bg-grad-soft p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-accent hover:shadow-xl sm:p-5">
        <span aria-hidden className="glow-pulse pointer-events-none absolute -left-6 top-1/2 size-28 -translate-y-1/2 rounded-full bg-accent/30 blur-2xl" />
        <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-md transition group-hover:rotate-6"><Pencil size={26} aria-hidden /></span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-lg font-bold">Revisar e editar o arquivo</span>
          <span className="block text-sm text-muted">Diga o que é cada coluna, corrija células e tire linhas antes de importar. Quanto mais certinho, melhor o resultado.</span>
        </span>
        <span className="relative hidden shrink-0 flex-col items-end gap-1.5 text-xs font-semibold sm:flex">
          {!orig ? <span className="text-muted">Abrindo o arquivo…</span> : (<>
            {missing.length > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1 text-danger"><TriangleAlert size={13} aria-hidden /> Falta: {missing.map((m) => m.label).join(", ")}</span>
              : unknownCount > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/20 px-3 py-1 text-warn"><CircleHelp size={13} aria-hidden /> {unknownCount} {unknownCount === 1 ? "coluna" : "colunas"} sem reconhecimento</span>
              : <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1 text-ok"><Check size={13} aria-hidden /> Todas as colunas reconhecidas</span>}
            {sugCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-accent"><Sparkles size={13} aria-hidden /> {sugCount} {sugCount === 1 ? "sugestão" : "sugestões"} para você</span>}
          </>)}
        </span>
        <ChevronRight size={22} className="relative shrink-0 text-accent transition group-hover:translate-x-1" aria-hidden />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-3" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !dirty) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Editar dados da importação" className="flex h-[min(94vh,60rem)] w-[min(98vw,110rem)] flex-col overflow-hidden rounded-2xl card-edge card-surface shadow-2xl">
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-grad-soft text-accent"><Pencil size={17} aria-hidden /></span>
              <div className="min-w-0 flex-1"><h2 className="truncate text-base font-semibold">Editar dados da importação</h2><p className="truncate text-xs text-muted">{file.name} · nada é gravado no sistema até você importar</p></div>
              {orig && (
                <>
                  <label className="relative w-full min-w-48 max-w-sm sm:w-auto sm:flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                    <input className={`${inputCls} pl-9`} placeholder="Buscar nas linhas…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Buscar nas linhas" /></label>
                  <span className="text-xs text-muted">{filtered.length.toLocaleString("pt-BR")} linha(s){rows.length >= 20000 ? " (limite de 20.000)" : ""}</span>
                  <button type="button" className={btnGhost} disabled={!dirty || busy} onClick={undo}><RotateCcw size={14} aria-hidden /> Desfazer</button>
                  <button type="button" className={btnPrimary} disabled={!dirty || busy} onClick={() => { apply(); setOpen(false); }}>Aplicar e reconferir</button>
                </>
              )}
              <button type="button" aria-label="Fechar" title={dirty ? "Fechar sem aplicar" : "Fechar"} onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunk"><X size={18} aria-hidden /></button>
            </header>
            {orig && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-sunk/50 px-5 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 font-medium"><Check size={15} className="text-ok" aria-hidden /> {colInfo.filter((i) => i.field).length} de {headers.length} colunas reconhecidas</span>
                {missing.length > 0 && <span className="flex items-center gap-1.5 font-semibold text-danger"><TriangleAlert size={15} aria-hidden /> Falta dizer qual é: {missing.map((m) => m.label).join(", ")}</span>}
                {sugCount > 0 && <button type="button" onClick={acceptAll} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-grad px-3 py-1.5 text-xs font-bold text-on-accent shadow-sm transition hover:-translate-y-0.5"><Wand2 size={14} aria-hidden /> Aceitar as {sugCount} {sugCount === 1 ? "sugestão" : "sugestões"}</button>}
                <span className={`${sugCount > 0 ? "" : "ml-auto"} text-xs text-muted`}>Escolha no topo de cada coluna o que ela é. As células também podem ser editadas.</span>
              </div>
            )}
            {err && <p className="p-4 text-sm text-danger">{err}</p>}
            {!orig && !err && <p className="p-6 text-sm text-muted">Abrindo…</p>}
            {orig && (
              <>
                <div className="relative flex min-h-0 flex-1 flex-col">
                <button type="button" aria-label="Rolar para a esquerda" onClick={() => go(-480)} className="absolute left-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full card-edge card-surface/95 shadow-lg hover:bg-sunk"><ChevronLeft size={20} aria-hidden /></button>
                <button type="button" aria-label="Rolar para a direita" onClick={() => go(480)} className="absolute right-4 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full card-edge card-surface/95 shadow-lg hover:bg-sunk"><ChevronRight size={20} aria-hidden /></button>
                <div ref={scroller} className="min-h-0 w-full min-w-0 flex-1 overflow-x-scroll overflow-y-auto">
                  <table className="w-full min-w-max text-sm">
                    <thead className="sticky top-0 z-10 bg-sunk">
                      <tr><th className="w-10 p-1.5" />
                        {headers.map((h, c) => {
                          const i = colInfo[c], sug = suggestions[c];
                          const tone = i.ignored ? "border-line opacity-70" : i.field ? "border-ok/50" : sug ? "border-accent/70" : "border-warn/60";
                          return (
                            <th key={c} className="min-w-48 p-1.5 align-top font-normal">
                              <div className={`space-y-1.5 rounded-xl border-2 bg-panel p-2 text-left ${tone}`}>
                                <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted"><span>Coluna {colLetter(c)}</span><span className="max-w-32 truncate normal-case" title={orig?.headers[c]}>{orig?.headers[c] || "(sem título)"}</span></p>
                                <select aria-label={`O que é a coluna ${colLetter(c)}`} className={`${inputCls} !min-h-9 !py-1 text-sm font-semibold`} value={i.ignored ? "__ignore" : i.field?.key ?? ""} onChange={(e) => pick(c, e.target.value)}>
                                  <option value="">{i.field || i.ignored ? "Voltar ao nome do arquivo" : "Escolha o que é…"}</option>
                                  <optgroup label="Campos do sistema">{FIELDS[kind].map((f: FieldInfo) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}{usedKeys.has(f.key) && i.field?.key !== f.key ? " (já usada)" : ""}</option>)}</optgroup>
                                  <option value="__ignore">Ignorar esta coluna</option>
                                </select>
                                {i.ignored ? <p className="flex items-center gap-1 text-xs text-muted"><EyeOff size={12} aria-hidden /> Não será importada</p>
                                  : i.field ? <p className="flex items-start gap-1 text-xs text-ok"><Check size={12} className="mt-0.5 shrink-0" aria-hidden /> <span className="font-normal text-muted">{i.field.hint}</span></p>
                                  : sug ? <button type="button" onClick={() => pick(c, sug.key)} className="flex w-full items-center gap-1.5 rounded-lg bg-accent/15 px-2 py-1 text-left text-xs font-semibold text-accent transition hover:bg-accent/25"><Sparkles size={12} className="shrink-0" aria-hidden /> Parece ser {sug.label}. Usar</button>
                                  : <p className="flex items-center gap-1 text-xs text-warn"><CircleHelp size={12} aria-hidden /> Não reconheço. Escolha acima ou ignore.</p>}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {view.map((r) => (
                        <tr key={r.id} className="border-t border-line">
                          <td className="p-1 text-center"><button type="button" aria-label="Remover linha" title="Remover linha" onClick={() => del(r.id)} className="rounded-md p-1.5 text-muted hover:bg-sunk hover:text-danger"><Trash2 size={14} aria-hidden /></button></td>
                          {r.cells.map((v, c) => <td key={c} className="p-1"><input aria-label={`${headers[c]} linha ${r.id + 2}`} className={`${inputCls} !min-h-8 !py-1 min-w-36`} value={v} onChange={(e) => setCell(r.id, c, e.target.value)} /></td>)}
                        </tr>
                      ))}
                      {view.length === 0 && <tr><td colSpan={headers.length + 1} className="p-6 text-center text-muted">Nenhuma linha.</td></tr>}
                    </tbody>
                  </table>
                </div>
                </div>
                <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-line px-4 py-2.5 text-sm">
                  <button type="button" className={btnGhost} disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Página anterior"><ChevronLeft size={15} aria-hidden /></button>
                  <span className="text-muted">Página {cur + 1} de {pages}</span>
                  <button type="button" className={btnGhost} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Próxima página"><ChevronRight size={15} aria-hidden /></button>
                  {dirty && <span className="ml-4 text-xs font-medium text-warn">Edições ainda não aplicadas</span>}
                </footer>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
