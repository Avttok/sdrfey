"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Calendar, Download, FileSpreadsheet, Handshake, Loader2, MapPin, Package, Phone, Play, Radar, ScrollText, Search, ShieldCheck, Users, X } from "lucide-react";
import { EX_FORMATS, type ExDataset, type ExFilter, type ExFormat } from "@/config/export-spec";
import { exportOptionsAction, exportPreviewAction } from "@/modules/export/actions";
import { FilterGroup, Pill, Segmented, Tri3, type Tri } from "@/components/filter-ui";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";

const ICONS = { users: Users, handshake: Handshake, calendar: Calendar, phone: Phone, play: Play, map: MapPin, shield: ShieldCheck, scroll: ScrollText, radar: Radar } as const;
type Opt = { value: string; label: string };
type Preview = { total: number; headers: string[]; sample: string[][] } | null;

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.values(v as object).some((x) => x !== "" && x !== undefined && x !== null));
const b64 = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const nf = new Intl.NumberFormat("pt-BR");

export function ExportCenter({ datasets, canPackage }: { datasets: ExDataset[]; canPackage: boolean }) {
  const [key, setKey] = useState(datasets[0]?.key);
  const ds = datasets.find((d) => d.key === key) ?? datasets[0];
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [cols, setCols] = useState<string[]>(() => ds.columns.filter((c) => c.preset?.includes("basic")).map((c) => c.key));
  const [format, setFormat] = useState<ExFormat>("xlsx");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [limit, setLimit] = useState("");
  const [opts, setOpts] = useState<Record<string, Opt[]>>({});
  const [preview, setPreview] = useState<Preview>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [find, setFind] = useState<Record<string, string>>({});

  const pick = (k: string) => {
    const d = datasets.find((x) => x.key === k)!;
    setKey(d.key); setFilters({}); setSort(null); setLimit(""); setPreview(null); setError("");
    setCols(d.columns.filter((c) => c.preset?.includes("basic")).map((c) => c.key));
  };

  useEffect(() => {
    const dyn = ds.filters.map((f) => f.dyn).filter((x): x is NonNullable<ExFilter["dyn"]> => !!x && !(x in opts));
    if (!dyn.length) return;
    let live = true;
    exportOptionsAction(dyn).then((o) => { if (live) setOpts((p) => ({ ...p, ...o })); }).catch(() => {});
    return () => { live = false; };
  }, [ds, opts]);

  const clean = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => !isEmpty(v))), [filters]);
  const nLimit = Number(limit) > 0 ? Math.floor(Number(limit)) : null;
  const request = useMemo(() => ({ dataset: ds.key, columns: cols, filters: clean, format, sort, limit: nLimit }), [ds.key, cols, clean, format, sort, nLimit]);

  useEffect(() => {
    if (!cols.length) { setPreview(null); setError("Escolha ao menos uma coluna."); return; }
    setError("");
    const t = setTimeout(() => start(async () => { const r = await exportPreviewAction(request); if (r.ok) setPreview(r); else { setPreview(null); setError(r.error); } }), 450);
    return () => clearTimeout(t);
  }, [request, cols.length]);

  const set = (k: string, v: unknown) => setFilters((p) => ({ ...p, [k]: v }));
  const toggle = (k: string, v: string) => { const cur = (filters[k] as string[] | undefined) ?? []; set(k, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]); };
  const groups = [...new Set(ds.filters.map((f) => f.group))];
  const colGroups = [...new Set(ds.columns.map((c) => c.group))];
  const nFilters = Object.keys(clean).length;
  const shown = preview ? (nLimit ? Math.min(nLimit, preview.total) : preview.total) : null;
  const href = `/exportar/run?q=${b64(request)}`;

  const control = (f: ExFilter) => {
    const v = filters[f.key];
    if (f.type === "tri") return <Tri3 key={f.key} label={f.label} v={(v as Tri) ?? ""} set={(t) => set(f.key, t)} labels={["Tudo", "Sim", "Não"]} />;
    if (f.type === "date") { const r = (v as { from?: string; to?: string }) ?? {}; return (
      <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-sunk/60 px-3 py-2"><span className="mr-auto text-sm">{f.label}</span>
        <input type="date" aria-label={`${f.label}: de`} value={r.from ?? ""} onChange={(e) => set(f.key, { ...r, from: e.target.value })} className={`${inputCls} !w-auto`} /><span className="text-xs text-muted">até</span>
        <input type="date" aria-label={`${f.label}: até`} value={r.to ?? ""} onChange={(e) => set(f.key, { ...r, to: e.target.value })} className={`${inputCls} !w-auto`} /></div>); }
    if (f.type === "num") { const r = (v as { min?: number; max?: number }) ?? {}; const n = (s: string) => (s === "" ? undefined : Number(s)); return (
      <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-sunk/60 px-3 py-2"><span className="mr-auto text-sm">{f.label}{f.unit && <span className="text-xs text-muted"> ({f.unit})</span>}</span>
        <input type="number" inputMode="decimal" min={0} placeholder="mín." aria-label={`${f.label}: mínimo`} value={r.min ?? ""} onChange={(e) => set(f.key, { ...r, min: n(e.target.value) })} className={`${inputCls} !w-24`} /><span className="text-xs text-muted">a</span>
        <input type="number" inputMode="decimal" min={0} placeholder="máx." aria-label={`${f.label}: máximo`} value={r.max ?? ""} onChange={(e) => set(f.key, { ...r, max: n(e.target.value) })} className={`${inputCls} !w-24`} /></div>); }
    if (f.type === "text") return <label key={f.key} className="block space-y-1"><span className="text-sm">{f.label}</span><input value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.hint} className={inputCls} /></label>;
    const list = f.options ?? (f.dyn ? opts[f.dyn] : undefined) ?? [];
    const sel = (v as string[]) ?? [];
    const q = (find[f.key] ?? "").toLowerCase();
    const vis = q ? list.filter((o) => o.label.toLowerCase().includes(q)) : list;
    return (
      <div key={f.key} className="space-y-1.5"><div className="flex items-center justify-between gap-2"><span className="text-sm">{f.label}{f.hint && <span className="ml-1.5 text-xs text-muted">{f.hint}</span>}</span>
        {sel.length > 0 && <button type="button" onClick={() => set(f.key, [])} className="text-xs font-semibold text-accent hover:underline">Limpar ({sel.length})</button>}</div>
        {list.length > 12 && <div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input value={find[f.key] ?? ""} onChange={(e) => setFind((p) => ({ ...p, [f.key]: e.target.value }))} placeholder="Buscar na lista…" aria-label={`Buscar em ${f.label}`} className={`${inputCls} !pl-9`} /></div>}
        <div className={`flex flex-wrap gap-1.5 ${list.length > 12 ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
          {!list.length && f.dyn && !opts[f.dyn] ? <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 size={13} className="animate-spin" aria-hidden /> Carregando…</span> : vis.map((o) => <Pill key={o.value} on={sel.includes(o.value)} onClick={() => toggle(f.key, o.value)}>{o.label}</Pill>)}
          {list.length > 0 && !vis.length && <span className="text-xs text-muted">Nada encontrado.</span>}
        </div></div>);
  };

  return (
    <div className="space-y-5">
      <section aria-label="Escolha a base" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {datasets.map((d) => { const I = ICONS[d.icon]; const on = d.key === ds.key; return (
          <button key={d.key} type="button" aria-pressed={on} onClick={() => pick(d.key)} className={`${panelCls} flex items-start gap-3 p-4 text-left transition active:scale-[0.99] ${on ? "!border-accent ring-2 ring-accent/30" : "hover:border-accent/50"}`}>
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-grad text-on-accent" : "bg-sunk text-muted"}`}><I size={18} aria-hidden /></span>
            <span className="min-w-0"><span className="block font-semibold">{d.label}</span><span className="block text-sm text-muted">{d.hint}</span></span>
          </button>); })}
      </section>

      {canPackage && (
        <section className={`${panelCls} flex flex-wrap items-center gap-4 border-accent/40 bg-accent/5 p-4`}>
          <span className="grid size-11 place-items-center rounded-xl bg-grad text-on-accent"><Package size={20} aria-hidden /></span>
          <div className="min-w-64 flex-1"><h2 className="font-semibold">Pacote completo para apresentar</h2><p className="text-sm text-muted">Uma base por planilha (todas as colunas das bases liberadas a você) em Excel com aba Resumo, ou em PDF, ou em CSVs dentro de um .zip.</p></div>
          <div className="flex flex-wrap gap-2"><a href="/exportar/pacote" download className={btnPrimary}><Download size={16} aria-hidden /> Planilha (.xlsx)</a><a href="/exportar/pacote?format=csv" download className={btnGhost}>CSV (.zip)</a><a href="/exportar/pacote?format=pdf" download className={btnGhost}>PDF</a></div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className={`${panelCls} space-y-4 p-4 sm:p-5`} aria-label="Filtros">
          <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Filtros <span className="text-sm font-normal text-muted">{nFilters ? `· ${nFilters} ativo${nFilters > 1 ? "s" : ""}` : "· tudo"}</span></h2>
            {nFilters > 0 && <button type="button" onClick={() => setFilters({})} className={btnGhost}><X size={14} aria-hidden /> Limpar</button>}</div>
          {groups.map((g) => <FilterGroup key={g} title={g}><div className="space-y-3">{ds.filters.filter((f) => f.group === g).map(control)}</div></FilterGroup>)}
        </section>

        <div className="space-y-5">
          <section className={`${panelCls} space-y-3 p-4 sm:p-5`} aria-label="Colunas">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Colunas <span className="text-sm font-normal text-muted">· {cols.length} de {ds.columns.length}</span></h2>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={btnGhost} onClick={() => setCols(ds.columns.filter((c) => c.preset?.includes("basic")).map((c) => c.key))}>Essenciais</button>
                {ds.columns.some((c) => c.preset?.includes("contact")) && <button type="button" className={btnGhost} onClick={() => setCols(ds.columns.filter((c) => c.preset?.includes("contact")).map((c) => c.key))}>Só contato</button>}
                <button type="button" className={btnGhost} onClick={() => setCols(ds.columns.map((c) => c.key))}>Todas</button>
                <button type="button" className={btnGhost} onClick={() => setCols([])}>Nenhuma</button>
              </div></div>
            {colGroups.map((g) => <FilterGroup key={g} title={g}><div className="flex flex-wrap gap-1.5">{ds.columns.filter((c) => c.group === g).map((c) => <Pill key={c.key} on={cols.includes(c.key)} onClick={() => setCols((p) => (p.includes(c.key) ? p.filter((x) => x !== c.key) : [...p, c.key]))}>{c.label}</Pill>)}</div></FilterGroup>)}
          </section>

          <section className={`${panelCls} space-y-3 p-4 sm:p-5`} aria-label="Arquivo">
            <h2 className="font-semibold">Arquivo</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {EX_FORMATS.map((f) => <button key={f.key} type="button" aria-pressed={format === f.key} onClick={() => setFormat(f.key)} className={`rounded-xl border p-3 text-left transition active:scale-[0.99] ${format === f.key ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}><span className="block text-sm font-semibold">{f.label}</span><span className="block text-xs text-muted">{f.hint}</span></button>)}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1"><span className="block text-sm">Ordenar por</span>
                <select value={sort?.key ?? ""} onChange={(e) => setSort(e.target.value ? { key: e.target.value, dir: sort?.dir ?? "asc" } : null)} className={inputCls}><option value="">Padrão</option>{ds.columns.filter((c) => cols.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
              {sort && <Segmented label="Sentido" value={sort.dir} onChange={(dir) => setSort({ ...sort, dir })} options={[["asc", "A → Z"], ["desc", "Z → A"]]} />}
              <label className="space-y-1"><span className="block text-sm">Limite de linhas</span><input type="number" min={1} inputMode="numeric" placeholder="Todas" value={limit} onChange={(e) => setLimit(e.target.value)} className={`${inputCls} !w-32`} /></label>
            </div>
          </section>
        </div>
      </div>

      <section className={`${panelCls} space-y-3 p-4 sm:p-5`} aria-label="Prévia e download" aria-live="polite">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-grad text-on-accent"><FileSpreadsheet size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{error ? "Ajuste o pedido" : shown === null ? "Contando…" : `${nf.format(shown)} linha${shown === 1 ? "" : "s"} · ${cols.length} coluna${cols.length === 1 ? "" : "s"}`}{pending && <Loader2 size={14} className="ml-2 inline animate-spin text-muted" aria-label="Atualizando" />}</h2>
            <p className="text-sm text-muted">{error || `${ds.label}${nFilters ? ` com ${nFilters} filtro${nFilters > 1 ? "s" : ""}` : " sem filtros"} · cada download fica no Registro.`}</p>
          </div>
          {error || !preview?.total ? <button type="button" disabled className={`${btnPrimary} opacity-50`}><Download size={16} aria-hidden /> Baixar</button> : <a href={href} download className={btnPrimary}><Download size={16} aria-hidden /> Baixar {EX_FORMATS.find((f) => f.key === format)?.label.split(" (")[0]}</a>}
        </div>
        {preview && preview.total > 0 && (
          <div className="overflow-x-auto rounded-xl border border-line/60">
            <table className="w-full min-w-max text-left text-sm"><thead className="bg-sunk text-xs uppercase tracking-wide text-muted"><tr>{preview.headers.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line/50">{preview.sample.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="max-w-64 truncate px-3 py-1.5">{c || <span className="text-muted">—</span>}</td>)}</tr>)}</tbody></table>
          </div>
        )}
        {preview && preview.total === 0 && <p className="rounded-xl bg-sunk/60 p-4 text-center text-sm text-muted">Nenhum registro com esses filtros.</p>}
      </section>
    </div>
  );
}
