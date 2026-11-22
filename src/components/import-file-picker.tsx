"use client";

import Papa from "papaparse";
import { CheckCircle2, FileSpreadsheet, Layers, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { readSheetsAction } from "@/modules/import/sheets-action";

const nf = new Intl.NumberFormat("pt-BR");
type Book = { name: string; sheets: { name: string; rows: number; cols: number; csv: string }[]; pick: Set<number> };

/** Seletor único de arquivo para todas as importações: CSV ou Excel (.xlsx, com escolha de abas). */
export function ImportFilePicker({ file, checking, busy, hasResult, noun = "dados", onPick, onCheck, onReset }: {
  file: File | null; checking: boolean; busy: boolean; hasResult: boolean; noun?: string;
  onPick: (f: File | null, autoCheck?: boolean) => void; onCheck: () => void; onReset: () => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [book, setBook] = useState<Book | null>(null);
  const [reading, read] = useTransition();

  const pick = (f: File | null | undefined) => {
    setBook(null);
    if (f && /\.xlsx?$/i.test(f.name)) {
      onPick(null);
      read(async () => {
        const body = new FormData(); body.set("file", f);
        const r = await readSheetsAction(body);
        if (!r.ok) return toast("bad", r.message);
        setBook({ name: f.name, sheets: r.sheets, pick: new Set(r.sheets.map((_, i) => i)) });
      });
      return;
    }
    onPick(f ?? null);
  };
  const useSheets = () => {
    if (!book) return;
    const chosen = book.sheets.filter((_, i) => book.pick.has(i));
    const heads: string[] = []; const all: Record<string, string>[] = [];
    for (const sh of chosen) {
      const p = Papa.parse<Record<string, string>>(sh.csv, { header: true, skipEmptyLines: true });
      for (const h of p.meta.fields ?? []) if (!heads.includes(h)) heads.push(h);
      all.push(...p.data);
    }
    const csv = Papa.unparse({ fields: heads, data: all.map((r) => heads.map((h) => r[h] ?? "")) });
    const f = new File([csv], book.name.replace(/\.xlsx?$/i, "") + (chosen.length === 1 ? ` (${chosen[0].name})` : " (abas juntas)") + ".csv", { type: "text/csv" });
    setBook(null); onPick(f, true);
  };
  const reset = () => { setBook(null); if (input.current) input.current.value = ""; onReset(); };

  return (
    <>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-accent bg-sunk [&_*]:pointer-events-none" : "border-line"}`}>
        {file ? (
          <>
            <FileSpreadsheet size={36} className="text-accent" aria-hidden />
            <p className="font-semibold">{file.name}</p>
            <p className="text-sm text-muted">{(file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={btnPrimary} disabled={busy} onClick={onCheck}>{checking && !hasResult ? <Spinner size={16} /> : <CheckCircle2 size={16} aria-hidden />} {checking && !hasResult ? "Conferindo…" : "Conferir arquivo"}</button>
              <button type="button" className={btnGhost} disabled={busy} onClick={reset}><X size={15} aria-hidden /> Trocar arquivo</button>
            </div>
          </>
        ) : (
          <>
            {reading ? <Spinner size={36} /> : <Upload size={36} className="text-muted" aria-hidden />}
            <p className="font-medium">{reading ? "Abrindo a planilha…" : "Arraste o CSV ou o Excel para cá"}</p>
            <button type="button" className={btnGhost} disabled={reading} onClick={() => input.current?.click()}>Escolher arquivo</button>
          </>
        )}
        <input ref={input} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {book && (
        <div className={`${panelCls} mt-4 space-y-3 p-5`}>
          <h3 className="flex items-center gap-2 text-lg font-semibold"><Layers size={18} aria-hidden /> Abas de {book.name}</h3>
          <p className="text-sm text-muted">Marque as abas que têm {noun}. Elas serão juntadas num só arquivo, que você ainda pode editar antes de importar.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {book.sheets.map((sh, i) => (
              <li key={sh.name + i}><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm">
                <input type="checkbox" checked={book.pick.has(i)} onChange={() => { const n = new Set(book.pick); if (n.has(i)) n.delete(i); else n.add(i); setBook({ ...book, pick: n }); }} />
                <span className="min-w-0 flex-1"><b className="block truncate">{sh.name}</b><span className="text-xs text-muted">{nf.format(sh.rows)} linha(s) · {sh.cols} coluna(s)</span></span>
              </label></li>
            ))}
          </ul>
          <div className="flex gap-2"><button type="button" className={btnPrimary} disabled={book.pick.size === 0 || busy} onClick={useSheets}>Usar {book.pick.size} {book.pick.size === 1 ? "aba" : "abas"} e conferir</button><button type="button" className={btnGhost} onClick={reset}>Cancelar</button></div>
        </div>
      )}
    </>
  );
}
