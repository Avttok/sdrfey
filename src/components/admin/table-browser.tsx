"use client";

import { ChevronLeft, ChevronRight, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, inputCls, panelCls } from "@/components/ui";
import { useToast, useBusyWhile } from "@/components/toast";
import { browseTableAction, deleteTableRowsAction, emptyTableAction, type BrowseResult } from "@/modules/admin/table-browser";

/** Janela grande para ver os registros de uma tabela, buscar e apagar um a um, vários ou todos. */
export function TableBrowser({ table, onClose, onChanged }: { table: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<BrowseResult | null>(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useBusyWhile(busy);
  const [word, setWord] = useState("");
  const [emptyOpen, setEmptyOpen] = useState(false);
  const { ask, dialog } = useConfirm(busy);
  const load = useCallback(async (p: number, term: string) => { setD(await browseTableAction(table, p, term)); setSel(new Set()); }, [table]);
  useEffect(() => { const t = setTimeout(() => void load(page, q), q ? 250 : 0); return () => clearTimeout(t); }, [load, page, q]);
  const ok = d?.ok ? d : null;
  const del = (keys: string[]) => ask({ title: `Apagar ${keys.length} registro(s)?`, body: `Os registros somem de ${table} e não dá para desfazer. Fica um aviso no registro de alterações.`, label: "Sim, apagar", icon: Trash2, onConfirm: async () => {
    setBusy(true); const r = await deleteTableRowsAction(table, keys, !!ok?.hasId); setBusy(false);
    toast(r.ok ? "ok" : "bad", r.message); if (r.ok) { await load(page, q); onChanged(); } } });
  const empty = async () => { setBusy(true); const r = await emptyTableAction(table, word); setBusy(false); toast(r.ok ? "ok" : "bad", r.message); if (r.ok) { setEmptyOpen(false); setWord(""); await load(0, q); onChanged(); } };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Registros de ${table}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${panelCls} !bg-panel flex max-h-[94vh] w-full max-w-[min(96vw,100rem)] flex-col overflow-hidden shadow-2xl`}>
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1"><h2 className="display text-xl">{table}</h2><p className="text-xs text-muted">{ok ? `${ok.total.toLocaleString("pt-BR")} registro(s)${q ? " na busca" : ""}` : "Carregando…"}</p></div>
          <label className="relative w-full min-w-48 sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input className={`${inputCls} pl-9`} placeholder="Buscar em qualquer coluna…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Buscar" /></label>
          {sel.size > 0 && <button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={busy} onClick={() => del([...sel])}><Trash2 size={15} aria-hidden /> Apagar {sel.size} marcado(s)</button>}
          {ok?.canEmpty && <button type="button" className={`${btnGhost} text-danger`} disabled={busy} onClick={() => setEmptyOpen((o) => !o)}>Esvaziar tabela</button>}
          <button type="button" aria-label="Fechar" className="rounded-lg p-2 hover:bg-sunk" onClick={onClose}><X size={20} /></button>
        </header>
        {emptyOpen && <div className="flex flex-wrap items-center gap-3 border-b border-danger/40 bg-danger/10 px-5 py-3 text-sm"><span className="min-w-60 flex-1">Para apagar TODOS os registros de <b>{table}</b>, digite o nome da tabela:</span><input className={`${inputCls} !w-56`} value={word} onChange={(e) => setWord(e.target.value)} placeholder={table} aria-label="Confirmação" /><button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={busy || word.trim().toLowerCase() !== table} onClick={empty}>Esvaziar agora</button></div>}
        <div className="no-sb min-h-0 flex-1 overflow-auto">
          {d && !d.ok && <p className="p-6 text-sm text-danger">{d.message}</p>}
          {ok && (
            <table className="w-full min-w-max text-left text-xs">
              <thead className="sticky top-0 z-10 bg-sunk"><tr><th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Marcar todos" checked={ok.rows.length > 0 && sel.size === ok.rows.length} onChange={(e) => setSel(e.target.checked ? new Set(ok.rows.map((r) => r.key)) : new Set())} /></th>{ok.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold text-muted">{c}</th>)}<th className="w-10" /></tr></thead>
              <tbody>
                {ok.rows.map((r) => (
                  <tr key={r.key} className={`border-t border-line/60 ${sel.has(r.key) ? "bg-accent/8" : "hover:bg-sunk/50"}`}>
                    <td className="px-3 py-1.5"><input type="checkbox" aria-label="Marcar registro" checked={sel.has(r.key)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(r.key); else n.delete(r.key); setSel(n); }} /></td>
                    {r.cells.map((c, i) => <td key={i} className="max-w-72 truncate px-3 py-1.5" title={c}>{c}</td>)}
                    <td className="sticky right-0 bg-panel px-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,.15)]"><button type="button" aria-label="Apagar este registro" title="Apagar este registro" disabled={busy} onClick={() => del([r.key])} className="rounded-md p-1.5 text-muted hover:bg-sunk hover:text-danger"><Trash2 size={14} aria-hidden /></button></td>
                  </tr>
                ))}
                {ok.rows.length === 0 && <tr><td colSpan={ok.columns.length + 2} className="p-8 text-center text-muted">Nenhum registro.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        {ok && ok.pages > 1 && <footer className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-sm"><button type="button" className={btnGhost} disabled={ok.page === 0} onClick={() => setPage(ok.page - 1)} aria-label="Página anterior"><ChevronLeft size={15} aria-hidden /></button><span className="text-muted">Página {ok.page + 1} de {ok.pages}</span><button type="button" className={btnGhost} disabled={ok.page >= ok.pages - 1} onClick={() => setPage(ok.page + 1)} aria-label="Próxima página"><ChevronRight size={15} aria-hidden /></button></footer>}
      </div>
      {dialog}
    </div>
  );
}
