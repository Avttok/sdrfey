"use client";

import { CheckCircle2, Clock3, Link2, ListChecks, Loader2, Pause, Play, Plug, Save, Search, SlidersHorizontal, TriangleAlert, XCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { EOX_GROUPS } from "@/config/eox-lists";
import { EOX_LISTS } from "@/config/eox-lists";
import type { EoxPreview } from "@/modules/eox/consult";
import type { EoxDock } from "@/modules/eox/consult-daemon";
import { CONSULT_DEFAULT, type ConsultOptions } from "@/modules/eox/consult-options";
import { saveConsultOptionsAction } from "@/modules/eox/consult-actions";
import { btnPrimary, inputCls } from "../ui";
import { useToast } from "../toast";
import { EOX_STATE, askEox, eoxPreviewApi, eoxStartApi, eoxStopApi, setEox } from "../eox-api";
import { EOX_HEX, EoxChoice, EoxIcon, EoxResult, LeadLink, eoxVisual } from "../eox-parts";
import { Panel, StatRow } from "../theme-kit";
import { iconTile } from "../enrich-visual";

const nf = new Intl.NumberFormat("pt-BR");
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const TOGGLES: { key: keyof ConsultOptions; label: string; hint: string }[] = [
  { key: "phones", label: "Telefones do cadastro", hint: "Telefone, Outro, Alternativos e WhatsApp da empresa." },
  { key: "phoneList", label: "Lista \"Telefones\"", hint: "Todos os números cadastrados, com o tipo (Fixo, Celular, WhatsApp…)." },
  { key: "emails", label: "E-mails", hint: "Email e Email Alternativo." },
  { key: "people", label: "Pessoas de contato", hint: "Contatos da empresa, com cargo, telefone e e-mail." },
  { key: "address", label: "Endereço", hint: "Rua, número, bairro, CEP, cidade e UF." },
  { key: "social", label: "Site e redes", hint: "Website, Facebook e Linkedin." },
  { key: "fiscal", label: "Inscrição Estadual", hint: "Usada em cotações e pedidos." },
  { key: "info", label: "Retrato da EOX", hint: "Tipo, vendedor, gestor, financeiro, última compra, bloqueios…" },
];

/** Tela do Adm da Consulta EOX. Quem roda a consulta é o painel lateral (que vive no layout); aqui se escolhe a fila, as opções e se acompanha. */
export function EoxConsultAdmin({ initial, ready, options: optionsIn }: { initial: EoxDock; ready: boolean; options: ConsultOptions }) {
  const [d, setD] = useState(initial);
  const [scope, setScope] = useState("new");
  const [busy, setBusy] = useState(false);
  const [opt, setOpt] = useState(optionsIn);
  const [saving, startSave] = useTransition();
  const [q, setQ] = useState("");
  const [pv, setPv] = useState<EoxPreview | null>(null);
  const [testing, setTesting] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const on = (e: Event) => setD((e as CustomEvent<EoxDock>).detail);
    window.addEventListener(EOX_STATE, on); askEox();
    return () => window.removeEventListener(EOX_STATE, on);
  }, []);
  const act = async (fn: () => Promise<EoxDock>) => { setBusy(true); try { const r = await fn(); setD(r); setEox(r); askEox(); } finally { setBusy(false); } };
  const { stats, state } = d;
  const key = state.on ? state.scope : scope;
  const cur = eoxVisual(key);
  const left = stats.lists?.[key] ?? 0;
  const dirty = JSON.stringify(opt) !== JSON.stringify(optionsIn);
  const save = () => startSave(async () => { const r = await saveConsultOptionsAction(opt); if (r.ok && r.options) setOpt(r.options); toast(r.ok ? "ok" : "bad", r.message ?? ""); });
  const test = async () => { setTesting(true); setPv(null); try { setPv(await eoxPreviewApi(q)); } catch { setPv({ ok: false, message: "Não consegui falar com o servidor." }); } finally { setTesting(false); } };
  const f = pv?.found;

  return (
    <div className="space-y-5">
      {!ready && <p className="flex items-start gap-2 rounded-2xl border-2 border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn"><TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />A integração com a EOX está desligada ou incompleta. Ligue e preencha em <a className="font-semibold underline" href="/admin/eox">Admin → Integração com a EOX</a> (endereço, usuário, chave e o campo do CNPJ: <code>cnpj</code>; campo do ID EOX: <code>id_erp_original</code>).</p>}
      <StatRow stats={[
        { icon: CheckCircle2, label: "Consultados", value: stats.done, hint: `${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}% da base`, hex: "#22c55e" },
        { icon: Link2, label: "Com link do perfil", value: stats.linked, hint: "Código EOX gravado", hex: "#6366f1" },
        { icon: Clock3, label: "Esperando", value: stats.pending, hint: `${nf.format(stats.failed)} sem resposta`, hex: EOX_HEX },
        { icon: Plug, label: "Ritmo", value: `${d.rate.perMin.toLocaleString("pt-BR")}/min`, hint: d.rate.okPct != null ? `${d.rate.okPct}% deram certo` : "parada", hex: "#0ea5e9" },
      ]} />

      <Panel icon={ListChecks} title="Qual fila consultar" hint="Só preenche o que está vazio: nada do que a equipe digitou é trocado. Todo lead achado ganha o Código/link do perfil na EOX." hex={EOX_HEX}>
        {state.stoppedWhy && <p className="mb-3 flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn"><TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />{state.stoppedWhy}</p>}
        <div className="space-y-4" role="radiogroup" aria-label="Filas">
          {EOX_GROUPS.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{g}</h3>
              <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {EOX_LISTS.filter((l) => l.group === g).map((l) => <li key={l.key}><EoxChoice k={l.key} count={stats.lists?.[l.key] ?? 0} selected={key === l.key} onPick={() => !state.on && setScope(l.key)} /></li>)}
              </ul>
            </div>
          ))}
          {Object.keys(stats.ufs ?? {}).length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Por estado (ainda não consultados)</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {Object.entries(stats.ufs).map(([u, n]) => <li key={u}><EoxChoice compact k={`uf:${u}`} count={n} selected={key === `uf:${u}`} onPick={() => !state.on && setScope(`uf:${u}`)} /></li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {state.on
            ? <button type="button" disabled={busy} onClick={() => act(eoxStopApi)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-danger/40 bg-danger/10 px-5 text-sm font-bold text-danger transition hover:bg-danger/20 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Pause size={16} aria-hidden />} Parar consulta</button>
            : <button type="button" disabled={busy || !ready || left === 0} onClick={() => act(() => eoxStartApi(scope))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50" style={{ background: iconTile(cur.hex) }}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Iniciar: {cur.label}</button>}
          <p className="text-sm text-muted">{state.on ? <>Rodando no navegador de <b className="text-ink">{state.byName ?? "—"}</b> · restam {nf.format(left)}.</> : cur.hint}</p>
        </div>
      </Panel>

      <Panel icon={SlidersHorizontal} title="Opções da consulta" hint="O que preencher e em que ritmo. Vale para o painel lateral, para esta tela e para o botão do perfil do lead." hex="#f59e0b">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {TOGGLES.map((t) => (
            <label key={t.key} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border-2 p-3 transition ${opt[t.key] ? "border-accent/50 bg-accent/10" : "border-line bg-panel/60"}`}>
              <input type="checkbox" className="mt-0.5 size-4" checked={opt[t.key] as boolean} onChange={(e) => setOpt({ ...opt, [t.key]: e.target.checked })} />
              <span><span className="block text-sm font-semibold">{t.label}</span><span className="block text-xs text-muted">{t.hint}</span></span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block text-muted">Leads por passo (10 a 100)</span><input type="number" min={10} max={100} className={inputCls} value={opt.batch} onChange={(e) => setOpt({ ...opt, batch: Number(e.target.value) })} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted">Consultas ao mesmo tempo (1 a 10)</span><input type="number" min={1} max={10} className={inputCls} value={opt.workers} onChange={(e) => setOpt({ ...opt, workers: Number(e.target.value) })} /></label>
          <label className="text-sm"><span className="mb-1 block text-muted">Horas até repetir quem falhou (1 a 72)</span><input type="number" min={1} max={72} className={inputCls} value={opt.retryHours} onChange={(e) => setOpt({ ...opt, retryHours: Number(e.target.value) })} /></label>
          <label className="text-sm sm:col-span-3 lg:col-span-1"><span className="mb-1 block text-muted">Campos extras de telefone (nome interno, separados por vírgula)</span><input className={inputCls} placeholder="ex.: cf_1234, cf_1235" value={opt.extraPhoneFields} onChange={(e) => setOpt({ ...opt, extraPhoneFields: e.target.value })} /></label>
          <label className="text-sm sm:col-span-3 lg:col-span-2"><span className="mb-1 block text-muted">Campos extras de e-mail</span><input className={inputCls} placeholder="ex.: cf_2000" value={opt.extraEmailFields} onChange={(e) => setOpt({ ...opt, extraEmailFields: e.target.value })} /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!dirty || saving} onClick={save} className={btnPrimary}>{saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Salvar opções</button>
          <button type="button" onClick={() => setOpt(CONSULT_DEFAULT)} className="text-sm text-muted underline hover:text-ink">Voltar ao padrão</button>
        </div>
      </Panel>

      <Panel icon={Search} title="Testar um cliente" hint="Digite um CNPJ ou o ID EOX: mostra o que a EOX devolve e o que seria gravado, sem gravar nada. Bom para conferir os campos." hex="#06b6d4">
        <form onSubmit={(e) => { e.preventDefault(); void test(); }} className="flex flex-wrap gap-2">
          <input className={`${inputCls} max-w-sm flex-1`} placeholder="CNPJ ou ID EOX" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" disabled={testing || !q.trim()} className={btnPrimary}>{testing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />} Testar</button>
        </form>
        {pv && (
          <div className="mt-4 space-y-3 text-sm">
            <p className={`flex items-center gap-2 font-semibold ${pv.ok ? "text-ok" : "text-danger"}`}>{pv.ok ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />}{pv.message}{pv.link && <a className="ml-2 font-normal text-accent underline" href={pv.link} target="_blank" rel="noopener noreferrer">abrir perfil na EOX</a>}</p>
            {pv.ok && pv.counts && <p className="text-xs text-muted">{pv.counts.fields} campos · {pv.counts.contacts} contatos · {pv.counts.phoneRows} telefones na lista{(pv.copies ?? 1) > 1 ? ` · ${pv.copies} cadastros iguais (vale o mais recente)` : ""} · Código do perfil: <b className="text-ink">{pv.record}</b>{f?.code ? <> · ID EOX: <b className="text-ink">{f.code}</b></> : null}</p>}
            {pv.errors && pv.errors.length > 0 && <ul className="space-y-1 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">{pv.errors.map((e) => <li key={e}>⚠ {e}</li>)}</ul>}
            {f && (
              <div className="grid gap-3 lg:grid-cols-2">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-line bg-panel/70 p-3">
                  {([["Telefones", f.phones.map((p) => (f.phoneKinds[p] ? `${p} (${f.phoneKinds[p]})` : p)).join(", ")], ["E-mails", f.emails.join(", ")], ["Endereço", [f.address, f.neighborhood, f.zip, f.city && `${f.city}/${f.uf ?? ""}`].filter(Boolean).join(" · ")], ["Site / redes", [f.site, f.facebook, f.linkedin].filter(Boolean).join(" · ")], ["Inscrição Estadual", f.stateReg ?? ""], ["Pessoas", f.people.map((p) => `${p.name}${p.title ? ` (${p.title})` : ""}`).join(", ")]] as [string, string][]).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v || <span className="text-muted">—</span>}</dd></div>)}
                </dl>
                <dl className="grid max-h-72 grid-cols-[auto_1fr] gap-x-3 gap-y-1 overflow-y-auto rounded-xl border border-line bg-panel/70 p-3">
                  {Object.entries(f.info).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
                </dl>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel icon={Clock3} title="Últimas consultas" hint="O que a EOX trouxe de novo para cada lead." hex="#0ea5e9">
        <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line bg-panel/60">
          {d.rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
              <EoxIcon ok={r.ok} />
              <div className="min-w-0 flex-1"><LeadLink id={r.leadId} className="text-sm">{r.company}</LeadLink><EoxResult r={r} /></div>
              <span className="figure shrink-0 text-right text-[11px] text-muted">{when(r.at)}<br />{r.by ?? "automático"} · {(r.ms / 1000).toFixed(1).replace(".", ",")} s</span>
            </li>
          ))}
          {!d.rows.length && <li className="px-4 py-8 text-center text-sm text-muted">Nenhuma consulta ainda.</li>}
        </ul>
      </Panel>
    </div>
  );
}
