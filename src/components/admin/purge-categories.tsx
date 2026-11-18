"use client";

import { Flame, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRun } from "@/components/use-run";
import { btnGhost, inputCls, panelCls } from "@/components/ui";
import { purgeCategoryAction, purgeEverythingAction } from "@/modules/admin/purge";
import { CONFIRM_WORD, NUKE_WORD, PURGE_CATEGORIES, type PurgeCategory, type PurgeKey } from "@/modules/admin/purge-spec";
import { TypedConfirm } from "./purge-confirm";

type Counts = Record<PurgeKey, { total: number; test: number | null }>;
type Target = { cat: PurgeCategory; scope: "all" | "test"; before: string };

const nf = (n: number) => n.toLocaleString("pt-BR");

export function PurgeCategories({ counts }: { counts: Counts }) {
  const router = useRouter();
  const { run, pending } = useRun();
  const [scope, setScope] = useState<Partial<Record<PurgeKey, "all" | "test">>>({});
  const [before, setBefore] = useState<Partial<Record<PurgeKey, string>>>({});
  const [target, setTarget] = useState<Target | null>(null);
  const [nuke, setNuke] = useState(false);
  const [withAudit, setWithAudit] = useState(false);
  const [withCatalog, setWithCatalog] = useState(false);
  const groups = [...new Set(PURGE_CATEGORIES.map((c) => c.group))];

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{g}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {PURGE_CATEGORIES.filter((c) => c.group === g).map((c) => {
              const n = counts[c.key];
              const sc = c.test ? scope[c.key] ?? "all" : "all";
              const bf = c.time ? before[c.key] ?? "" : "";
              const shown = sc === "test" ? n.test ?? 0 : n.total;
              return (
                <article key={c.key} className={`${panelCls} flex flex-col gap-3 p-4`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-tight">{c.label}</h3>
                      <p className="mt-0.5 text-sm text-muted">{c.hint}</p>
                    </div>
                    <p className="figure shrink-0 text-right text-2xl font-bold leading-none">{nf(shown)}<span className="mt-1 block text-[11px] font-normal text-muted">{sc === "test" ? "de teste" : "registros"}</span></p>
                  </div>
                  {c.cascade && <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">{c.cascade}</p>}
                  {(c.test || c.time) && (
                    <div className="flex flex-wrap items-end gap-3">
                      {c.test && (
                        <label className="block min-w-36 flex-1 text-xs"><span className="mb-1 block text-muted">O que apagar</span>
                          <select className={inputCls} value={sc} onChange={(e) => setScope((p) => ({ ...p, [c.key]: e.target.value as "all" | "test" }))}>
                            <option value="all">Tudo</option><option value="test">Só dados de teste</option>
                          </select></label>
                      )}
                      {c.time && (
                        <label className="block min-w-40 flex-1 text-xs"><span className="mb-1 block text-muted">Só anteriores a (opcional)</span>
                          <input type="date" className={inputCls} value={bf} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBefore((p) => ({ ...p, [c.key]: e.target.value }))} /></label>
                      )}
                    </div>
                  )}
                  <button type="button" className={`${btnGhost} mt-auto w-full !border-danger/50 text-danger`} disabled={pending || shown === 0} onClick={() => setTarget({ cat: c, scope: sc, before: bf })}>
                    <Trash2 size={15} aria-hidden /> {bf ? `Apagar anteriores a ${bf.split("-").reverse().join("/")}` : sc === "test" ? "Apagar dados de teste" : `Apagar ${c.label.toLowerCase()}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-3 rounded-2xl border-2 border-danger/50 bg-danger/5 p-5">
        <h2 className="flex items-center gap-2 font-semibold text-danger"><Flame size={18} aria-hidden /> Zona de perigo: zerar o sistema</h2>
        <p className="text-sm text-muted">Apaga todos os leads e tudo que depende deles (negociações, cotações, visitas, interações, atendimentos) e o chat. <b className="text-ink">Continuam:</b> usuários, permissões, metas, tags, modelos de e-mail e parâmetros. Faça um backup em Exportar antes.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--color-danger)]" checked={withAudit} onChange={(e) => setWithAudit(e.target.checked)} /> Apagar também o Registro de atividades</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--color-danger)]" checked={withCatalog} onChange={(e) => setWithCatalog(e.target.checked)} /> Apagar também representantes, produtos e condições de pagamento</label>
        </div>
        <button type="button" className={`${btnGhost} !border-danger text-danger`} disabled={pending} onClick={() => setNuke(true)}><Flame size={15} aria-hidden /> Zerar o sistema…</button>
      </section>

      <TypedConfirm open={!!target} word={CONFIRM_WORD} busy={pending} label="Apagar definitivamente" onCancel={() => setTarget(null)}
        title={target ? `Apagar ${target.cat.label.toLowerCase()}?` : ""}
        onConfirm={(typed) => { const t = target!; setTarget(null); run(() => purgeCategoryAction({ key: t.cat.key, scope: t.scope, before: t.before || null, confirm: typed }), undefined, () => router.refresh(), "Apagando…"); }}>
        {target && (<>
          <p>{target.scope === "test" ? "Só os dados de teste desta categoria serão apagados." : target.before ? `Serão apagados os registros anteriores a ${target.before.split("-").reverse().join("/")}.` : "TODOS os registros desta categoria serão apagados."}</p>
          {target.cat.cascade && <p className="text-warn">{target.cat.cascade}</p>}
          <p>Não dá para desfazer. Fica um registro desta exclusão em Registro.</p>
        </>)}
      </TypedConfirm>
      <TypedConfirm open={nuke} word={NUKE_WORD} busy={pending} label="Zerar o sistema" title="Zerar o sistema inteiro?" onCancel={() => setNuke(false)}
        onConfirm={(typed) => { setNuke(false); run(() => purgeEverythingAction({ confirm: typed, audit: withAudit, catalog: withCatalog }), undefined, () => router.refresh(), "Apagando…"); }}>
        <p>Todos os leads, negociações, cotações, visitas, interações, atendimentos e o chat serão apagados{withAudit ? ", além do Registro de atividades" : ""}{withCatalog ? " e do catálogo (representantes, produtos, condições)" : ""}.</p>
        <p>Não dá para desfazer.</p>
      </TypedConfirm>
    </div>
  );
}
