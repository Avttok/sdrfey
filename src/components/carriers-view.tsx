"use client";

import { Calculator, Clock, FileUp, Pencil, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { estimateFreight, FREIGHT_MODES, type CarrierRow, type FreightMode } from "@/config/carriers";
import { UFS } from "@/config/lists";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { applyCarrierImportAction, deleteCarrierAction, previewCarrierImportAction, saveCarrierAction, type CarrierPreview } from "@/modules/carriers/actions";
import { CARRIER_SAMPLE_CSV } from "@/modules/carriers/parse";
import { parseMoneyToCents, fmtBRL } from "@/config/deals";

const MODE_STYLE: Record<FreightMode, string> = { CIF: "bg-ok/15 text-ok", FOB: "bg-accent/15 text-accent", RED: "bg-warn/20 text-ink" };
const pct = (n: number | null) => (n == null ? "—" : `${String(n).replace(".", ",")}%`);
const days = (n: number | null) => (n == null ? "—" : `${n} d.u.`);
type Draft = { id?: number; uf: string; mode: FreightMode; name: string; capitalPct: string; interiorPct: string; capitalDays: string; interiorDays: string; min: string; contact: string; note: string; active: boolean };
const num = (s: string) => { const t = s.replace("%", "").replace(",", ".").trim(); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
const blank = (uf = "SP"): Draft => ({ uf, mode: "CIF", name: "", capitalPct: "", interiorPct: "", capitalDays: "", interiorDays: "", min: "", contact: "", note: "", active: true });
const toDraft = (c: CarrierRow): Draft => ({ id: c.id, uf: c.uf, mode: c.mode, name: c.name, capitalPct: c.capitalPct == null ? "" : String(c.capitalPct).replace(".", ","), interiorPct: c.interiorPct == null ? "" : String(c.interiorPct).replace(".", ","), capitalDays: c.capitalDays == null ? "" : String(c.capitalDays), interiorDays: c.interiorDays == null ? "" : String(c.interiorDays), min: c.minCents == null ? "" : (c.minCents / 100).toFixed(2).replace(".", ","), contact: c.contact ?? "", note: c.note ?? "", active: c.active });

function Editor({ d, setD, onClose }: { d: Draft; setD: (d: Draft) => void; onClose: () => void }) {
  const { run, pending } = useRun();
  const save = () => run(() => saveCarrierAction({ id: d.id, uf: d.uf, mode: d.mode, name: d.name, capitalPct: num(d.capitalPct), interiorPct: num(d.interiorPct), capitalDays: num(d.capitalDays), interiorDays: num(d.interiorDays), minCents: d.min.trim() ? parseMoneyToCents(d.min) : null, contact: d.contact.trim() || null, note: d.note.trim() || null, active: d.active }), undefined, onClose);
  const f = (k: keyof Draft, label: string, ph?: string) => <label className="text-sm">{label}<input className={inputCls} value={String(d[k] ?? "")} placeholder={ph} inputMode={["name", "contact", "note"].includes(k) ? "text" : "decimal"} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></label>;
  return (
    <div className={`${panelCls} space-y-3 p-4`}>
      <div className="flex items-center gap-2"><Truck size={18} aria-hidden className="text-accent" /><h3 className="flex-1 font-semibold">{d.id ? "Editar transportadora" : "Nova transportadora"}</h3><button type="button" aria-label="Fechar" className={btnGhost} onClick={onClose}><X size={15} /></button></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm">Estado<select className={inputCls} value={d.uf} onChange={(e) => setD({ ...d, uf: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <label className="text-sm">Frete<select className={inputCls} value={d.mode} onChange={(e) => setD({ ...d, mode: e.target.value as FreightMode })}>{Object.entries(FREIGHT_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {f("name", "Transportadora")}
        {f("capitalPct", "% frete Capital", "3,5")}{f("interiorPct", "% frete Interior", "5,2")}{f("min", "Frete mínimo (R$)", "80,00")}
        {f("capitalDays", "Dias úteis Capital", "2")}{f("interiorDays", "Dias úteis Interior", "4")}{f("contact", "Contato")}
      </div>
      <label className="block text-sm">Observação<input className={inputCls} value={d.note} maxLength={400} onChange={(e) => setD({ ...d, note: e.target.value })} /></label>
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Ativa</label><span className="flex-1" /><button type="button" className={btnPrimary} disabled={pending} onClick={save}>Salvar</button></div>
    </div>
  );
}

function Importer({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<CarrierPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const { run, pending } = useRun();
  const fd = (f: File) => { const x = new FormData(); x.set("file", f); return x; };
  return (
    <div className={`${panelCls} space-y-3 p-4`}>
      <div className="flex items-center gap-2"><FileUp size={18} aria-hidden className="text-accent" /><h3 className="flex-1 font-semibold">Importar transportadoras (CSV)</h3><button type="button" aria-label="Fechar" className={btnGhost} onClick={onClose}><X size={15} /></button></div>
      <p className="text-sm text-muted">Colunas: <b>UF</b>, <b>Tipo</b> (CIF/FOB/RED), <b>Transportadora</b> e, se tiver, % Capital, % Interior, Dias Capital, Dias Interior, Frete mínimo, Contato, Obs. Quem já existe (mesmo estado, tipo e nome) é atualizado.</p>
      <a className="text-sm text-accent underline" download="modelo-transportadoras.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + CARRIER_SAMPLE_CSV)}`}>Baixar planilha modelo</a>
      <input type="file" accept=".csv,text/csv" className={inputCls} onChange={async (e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPv(null); if (f) { setBusy(true); setPv(await previewCarrierImportAction(fd(f)).catch(() => ({ ok: false as const, message: "Não consegui ler o arquivo." }))); setBusy(false); } }} />
      {busy && <p className="text-sm text-muted">Conferindo o arquivo…</p>}
      {pv && !pv.ok && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{pv.message}</p>}
      {pv?.ok && (
        <div className="space-y-2 text-sm">
          <p><b>{pv.total}</b> transportadoras no arquivo: <b>{pv.fresh}</b> novas e <b>{pv.existing}</b> já existem (serão atualizadas).</p>
          <ul className="grid gap-1 sm:grid-cols-2">{pv.sample.map((s, i) => <li key={i} className="rounded-xl border border-line bg-sunk/50 px-3 py-1.5">{s.uf} · {s.mode} · <b>{s.name}</b> · {pct(s.capitalPct)} / {pct(s.interiorPct)}</li>)}</ul>
          {pv.warnings.map((w, i) => <p key={i} className="text-xs text-warn">{w}</p>)}
          <button type="button" className={btnPrimary} disabled={pending || !file} onClick={() => run(() => applyCarrierImportAction(fd(file!)), undefined, onClose)}>Importar agora</button>
        </div>
      )}
    </div>
  );
}

export function CarriersView({ rows, canEdit }: { rows: CarrierRow[]; canEdit: boolean }) {
  const [uf, setUf] = useState<string>("");
  const [mode, setMode] = useState<FreightMode | "">("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [imp, setImp] = useState(false);
  const [calcValue, setCalcValue] = useState("");
  const [region, setRegion] = useState<"capital" | "interior">("interior");
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);

  const ufsWith = useMemo(() => [...new Set(rows.map((r) => r.uf))].sort(), [rows]);
  const shown = rows.filter((r) => (!uf || r.uf === uf) && (!mode || r.mode === mode) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())));
  const order = parseMoneyToCents(calcValue);
  const calc = uf && order ? shown.filter((r) => r.active).map((r) => ({ r, e: estimateFreight(r, region, order) })).filter((x) => x.e).sort((a, b) => a.e!.cents - b.e!.cents) : [];
  const groups = useMemo(() => { const m = new Map<string, CarrierRow[]>(); for (const r of shown) m.set(r.uf, [...(m.get(r.uf) ?? []), r]); return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [shown]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1"><Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label="Buscar transportadora" className={`${inputCls} pl-9`} placeholder="Buscar transportadora" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Estado" className={`${inputCls} !w-auto`} value={uf} onChange={(e) => setUf(e.target.value)}><option value="">Todos os estados</option>{ufsWith.map((u) => <option key={u}>{u}</option>)}</select>
        {(["CIF", "FOB", "RED"] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(mode === m ? "" : m)} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${mode === m ? MODE_STYLE[m] + " ring-2 ring-current" : "bg-sunk text-muted"}`}>{m}</button>)}
        {canEdit && <><button type="button" className={btnPrimary} onClick={() => { setImp(false); setEdit(blank(uf || "SP")); }}><Plus size={15} aria-hidden /> Nova</button><button type="button" className={btnGhost} onClick={() => { setEdit(null); setImp(!imp); }}><FileUp size={15} aria-hidden /> Importar CSV</button></>}
      </div>

      {edit && <Editor d={edit} setD={setEdit} onClose={() => setEdit(null)} />}
      {imp && <Importer onClose={() => setImp(false)} />}

      <section className={`${panelCls} space-y-2 p-4`}>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Calculator size={16} aria-hidden className="text-accent" /> Frete estimado (escolha um estado acima)</h2>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <label className="block text-sm"><span className="mb-1 block text-muted">Valor do pedido (R$)</span><input className={`${inputCls} !w-44 text-right`} inputMode="decimal" placeholder="12.500,00" value={calcValue} onChange={(e) => setCalcValue(e.target.value)} /></label>
          <div className="flex items-center gap-1.5 pb-1">{(["capital", "interior"] as const).map((r) => <button key={r} type="button" aria-pressed={region === r} onClick={() => setRegion(r)} className={`rounded-full border px-3 py-1.5 text-sm ${region === r ? "border-accent bg-accent/15 font-semibold text-accent" : "border-line bg-sunk/60 text-muted"}`}>{r === "capital" ? "Capital" : "Interior"}</button>)}</div>
        </div>
        {!uf || !order ? <p className="text-xs text-muted">Escolha o estado e digite o valor para ver as transportadoras da mais barata para a mais cara.</p> : calc.length === 0 ? <p className="text-sm text-muted">Nenhuma transportadora com % cadastrado nessa região.</p> : (
          <ol className="space-y-1">{calc.map(({ r, e }, i) => <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sunk/50 px-3 py-2 text-sm"><span className="grid size-6 place-items-center rounded-full bg-grad-soft text-xs font-bold text-accent">{i + 1}</span><b className="flex-1">{r.name}</b><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${MODE_STYLE[r.mode]}`}>{r.mode}</span><span className="figure font-semibold">{fmtBRL(e!.cents)}</span><span className="text-xs text-muted">{days(e!.days)}</span></li>)}</ol>
        )}
      </section>

      {groups.map(([u, list]) => (
        <section key={u} className="space-y-2">
          <h2 className="display text-lg">{u} <span className="text-sm font-normal text-muted">· {list.length}</span></h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {list.map((r) => (
              <li key={r.id} className={`${panelCls} lift space-y-1.5 p-3 ${r.active ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${MODE_STYLE[r.mode]}`}>{r.mode}</span><b className="min-w-0 flex-1 truncate">{r.name}</b>
                  {canEdit && <><button type="button" aria-label="Editar" className={btnGhost} onClick={() => { setImp(false); setEdit(toDraft(r)); }}><Pencil size={14} /></button><button type="button" aria-label="Excluir" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir transportadora?", body: `${r.name} (${r.uf} · ${r.mode}) será excluída.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteCarrierAction(r.id)) })}><Trash2 size={14} /></button></>}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
                  <dt className="text-muted">Capital</dt><dd className="figure text-right">{pct(r.capitalPct)} <Clock size={11} aria-hidden className="mx-0.5 inline text-muted" /> {days(r.capitalDays)}</dd>
                  <dt className="text-muted">Interior</dt><dd className="figure text-right">{pct(r.interiorPct)} <Clock size={11} aria-hidden className="mx-0.5 inline text-muted" /> {days(r.interiorDays)}</dd>
                  {r.minCents != null && <><dt className="text-muted">Frete mínimo</dt><dd className="figure text-right">{fmtBRL(r.minCents)}</dd></>}
                </dl>
                {(r.contact || r.note) && <p className="text-xs text-muted">{[r.contact, r.note].filter(Boolean).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {rows.length === 0 && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Nenhuma transportadora cadastrada ainda.{canEdit ? " Use “Nova” ou “Importar CSV”." : ""}</p>}
      {dialog}
    </div>
  );
}
