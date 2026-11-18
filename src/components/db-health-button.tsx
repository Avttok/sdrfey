"use client";

import { Activity, Database, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { btnGhost } from "@/components/ui";
import { Trash2, Sparkles } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { dbHealthAction, dbMaintenanceAction, type DbHealth, type Level } from "@/modules/admin/db-health";

const N = new Intl.NumberFormat("pt-BR");
const bytes = (b: number | null) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = b / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1).replace(".", ",")} ${u[i]}`;
};
const uptime = (s: number | null) => {
  if (s == null) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const dot: Record<Level, string> = { ok: "bg-ok", warn: "bg-warn", bad: "bg-danger" };
const tone: Record<Level, string> = { ok: "border-ok/30 bg-ok/10", warn: "border-warn/40 bg-warn/10", bad: "border-danger/40 bg-danger/10" };

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-line/60 bg-sunk/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="figure mt-0.5 text-lg font-semibold">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/** Tag com a contagem de leads; ao clicar abre o monitor de saúde do banco (Gestor/Adm). */
export function DbHealthButton({ total }: { total: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DbHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  const { ask, dialog } = useConfirm();
  const toast = useToast();
  useEffect(() => setMounted(true), []);

  const load = useCallback(() => start(async () => {
    const r = await dbHealthAction();
    if (r.ok) { setData(r.data); setErr(null); } else setErr(r.message);
  }), []);
  useEffect(() => { if (open && !data) load(); }, [open, data, load]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  const maintain = (input: Parameters<typeof dbMaintenanceAction>[0], title: string, body: React.ReactNode, label: string, danger: boolean) =>
    ask({ title, body, label, tone: danger ? "danger" : "accent", icon: danger ? Trash2 : Sparkles, onConfirm: async () => {
      const r = await dbMaintenanceAction(input);
      toast(r.ok ? "ok" : "bad", r.message);
      if (r.ok) load();
    } });

  const worst: Level | null = data ? (data.checks.some((c) => c.level === "bad") ? "bad" : data.checks.some((c) => c.level === "warn") ? "warn" : "ok") : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Ver saúde do banco de dados" className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3.5 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/25">
        <Database size={15} aria-hidden />
        <span><span className="figure">{N.format(total)}</span> {total === 1 ? "lead" : "leads"}</span>
      </button>
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-3 sm:p-6" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Saúde do banco de dados" className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
            <span aria-hidden className="block h-1 shrink-0 bg-grad" />
            <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line/60 px-5 py-4">
              <span className="grid size-10 place-items-center rounded-xl bg-grad-soft text-accent"><Activity size={20} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <h2 className="display text-lg">Saúde do banco de dados</h2>
                <p className="text-xs text-muted">{data ? `${data.version ?? "PostgreSQL"} · atualizado ${when(data.at)}` : "Consultando…"}</p>
              </div>
              {worst && <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tone[worst]}`}><i className={`size-2 rounded-full ${dot[worst]}`} />{worst === "ok" ? "Tudo certo" : worst === "warn" ? "Atenção" : "Problema"}</span>}
              <button type="button" className={`${btnGhost} !py-1.5`} onClick={load} disabled={pending}><RefreshCw size={14} className={pending ? "animate-spin" : ""} aria-hidden /> Atualizar</button>
              <button type="button" aria-label="Fechar" className="rounded-lg p-2 text-muted hover:bg-sunk hover:text-ink" onClick={() => setOpen(false)}><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {err && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{err}</p>}
              {!data && !err && <p className="py-10 text-center text-sm text-muted">Consultando o banco…</p>}
              {data && (
                <>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {data.checks.map((c) => (
                      <li key={c.label} className={`flex items-start gap-2.5 rounded-xl border p-3 ${tone[c.level]}`}>
                        <i className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dot[c.level]}`} />
                        <div className="min-w-0"><p className="text-sm font-semibold">{c.label}</p><p className="text-xs text-muted">{c.detail}</p></div>
                      </li>
                    ))}
                  </ul>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Visão geral</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat label="Tamanho do banco" value={bytes(data.sizeBytes)} />
                      <Stat label="Resposta" value={`${data.latencyMs} ms`} />
                      <Stat label="Ligado há" value={uptime(data.uptimeSec)} />
                      <Stat label="Cache" value={data.cacheHitPct != null ? `${String(data.cacheHitPct).replace(".", ",")}%` : "—"} />
                      <Stat label="Conexões ativas" value={data.connections ? `${data.connections.active}` : "—"} hint={data.connections ? `${data.connections.idle} ociosas${data.connections.max ? ` · máx. ${data.connections.max}` : ""}` : undefined} />
                      <Stat label="Transações OK" value={data.xactCommit != null ? N.format(data.xactCommit) : "—"} hint={data.xactRollback != null ? `${N.format(data.xactRollback)} desfeitas` : undefined} />
                      <Stat label="Deadlocks" value={data.deadlocks ?? "—"} />
                      <Stat label="Índices" value={N.format(data.indexes.total)} hint={bytes(data.indexes.bytes)} />
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Leads</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat label="Total" value={N.format(data.leads.total)} hint={data.leads.test ? `${N.format(data.leads.test)} de teste` : undefined} />
                      <Stat label="Com responsável" value={N.format(data.leads.owned)} />
                      <Stat label="Em atendimento agora" value={N.format(data.leads.locked)} />
                      <Stat label="Sem consulta de CNPJ" value={N.format(data.leads.unenriched)} />
                      <Stat label="Sem e-mail" value={N.format(data.leads.noEmail)} />
                      <Stat label="Sem cidade" value={N.format(data.leads.noCity)} />
                      <Stat label="Último importado" value={<span className="text-sm">{when(data.leads.lastCreated)}</span>} />
                      <Stat label="Última consulta" value={<span className="text-sm">{when(data.leads.lastEnriched)}</span>} />
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Maiores tabelas</h3>
                      {data.isAdmin && <button type="button" className={`${btnGhost} !py-1 text-xs`} onClick={() => maintain({ kind: "vacuum" }, "Limpar todas as tabelas?", "Roda a limpeza (vacuum) do banco: recupera o espaço de linhas mortas e atualiza as estatísticas. Não apaga nenhum dado e pode levar alguns segundos.", "Limpar tudo", false)}><Sparkles size={13} aria-hidden /> Limpar tudo</button>}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-line/60">
                      <table className="w-full min-w-[30rem] text-sm">
                        <thead className="bg-sunk/60 text-left text-xs text-muted"><tr><th className="px-3 py-2">Tabela</th><th className="px-3 py-2 text-right">Linhas</th><th className="px-3 py-2 text-right">Tamanho</th><th className="px-3 py-2 text-right">Mortas</th><th className="px-3 py-2">Últ. limpeza</th>{data.isAdmin && <th className="px-3 py-2" />}</tr></thead>
                        <tbody>
                          {data.tables.map((t) => (
                            <tr key={t.name} className="border-t border-line/50">
                              <td className="px-3 py-1.5 font-medium">{t.name}</td>
                              <td className="figure px-3 py-1.5 text-right">{N.format(t.rows)}</td>
                              <td className="figure px-3 py-1.5 text-right">{bytes(t.bytes)}</td>
                              <td className="figure px-3 py-1.5 text-right">{N.format(t.dead)}</td>
                              <td className="px-3 py-1.5 text-xs text-muted">{when(t.lastVacuum)}</td>
                              {data.isAdmin && <td className="px-3 py-1.5 text-right">{t.dead > 0 && <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => maintain({ kind: "vacuum", table: t.name }, `Limpar a tabela ${t.name}?`, `Recupera ${N.format(t.dead)} linhas mortas. Nenhum dado é apagado.`, "Limpar", false)}>Limpar</button>}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {data.indexes.unused.length > 0 && (
                    <section>
                      <h3 className="mb-1 text-sm font-semibold">Índices nunca usados</h3>
                      <p className="mb-2 text-xs text-muted">Ocupam espaço e deixam as gravações mais lentas. Só vale remover depois de bastante uso real.</p>
                      <ul className="space-y-1 text-sm">
                        {data.indexes.unused.map((i) => <li key={i.name} className="flex justify-between gap-3 rounded-lg bg-sunk/60 px-3 py-1.5"><span className="truncate">{i.name} <span className="text-muted">({i.table})</span></span><span className="flex items-center gap-2"><span className="figure text-muted">{bytes(i.bytes)}</span>{data.isAdmin && <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10" onClick={() => maintain({ kind: "drop_index", name: i.name }, "Remover este índice?", <>O índice <b>{i.name}</b> (tabela {i.table}) será apagado. Nada some dos dados, mas buscas que dependiam dele podem ficar mais lentas.</>, "Remover índice", true)}><Trash2 size={13} aria-hidden /> Remover</button>}</span></li>)}
                      </ul>
                    </section>
                  )}
                  {data.errors.length > 0 && <p className="text-xs text-muted">Não foi possível ler: {data.errors.join(", ")}.</p>}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {dialog}
    </>
  );
}
