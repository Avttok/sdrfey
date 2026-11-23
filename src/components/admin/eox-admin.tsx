"use client";

import { Loader2, PlugZap, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { saveEoxConfigAction, syncEoxNowAction, testEoxAction } from "@/modules/eox/actions";
import type { EoxConfig } from "@/modules/eox/config";
import type { EoxSyncState } from "@/modules/eox/sync";

export function EoxAdmin({ initial, hasKey: hadKey, sync, coverage }: { initial: EoxConfig; hasKey: boolean; sync: EoxSyncState; coverage: { total: number; without: number } }) {
  const [c, setC] = useState(initial);
  // o que está salvo agora (a chave nunca volta do servidor: só sabemos se existe)
  const [base, setBase] = useState(initial);
  const [hasKey, setHasKey] = useState(hadKey);
  const [fields, setFields] = useState<{ name: string; label: string }[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"test" | "sync" | null>(null);
  const { run, pending } = useRun();
  const set = <K extends keyof EoxConfig>(k: K, v: EoxConfig[K]) => setC({ ...c, [k]: v });
  const dirty = JSON.stringify(c) !== JSON.stringify(base);
  const cand = (fields ?? []).filter((f) => /cnpj|cpf|documento/i.test(`${f.label} ${f.name}`));

  return (
    <div className="space-y-4">
      <section className={`${panelCls} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><h2 className="font-semibold">Buscar o cadastro de cada lead na EOX</h2><p className="text-sm text-muted">O sistema procura o CNPJ de cada lead na EOX e guarda o link do cadastro no lead. É isso que faz o Atendimento da EOX abrir depois da ligação. Nunca troca um link que já foi preenchido.</p></div>
          <button type="button" role="switch" aria-checked={c.on} aria-label="Integração com a EOX" onClick={() => set("on", !c.on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${c.on ? "bg-ok" : "bg-line"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${c.on ? "left-[1.5rem]" : "left-0.5"}`} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Endereço da EOX<input className={inputCls} value={c.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://fey.vocallcontact.com.br" /></label>
          <label className="text-sm">Usuário da EOX<input className={inputCls} autoComplete="off" value={c.username} onChange={(e) => set("username", e.target.value)} /></label>
          <label className="text-sm">Chave de acesso<input className={inputCls} type="password" autoComplete="new-password" value={c.accessKey} onChange={(e) => set("accessKey", e.target.value)} placeholder={hasKey ? "•••••• (deixe vazio para manter)" : "Na EOX: Minhas preferências → Chave de acesso"} /></label>
          <label className="text-sm">Módulo dos clientes<input className={inputCls} value={c.module} onChange={(e) => set("module", e.target.value)} /><span className="text-xs text-muted">Padrão: Accounts (o mesmo do link <code>module=Accounts</code>).</span></label>
          <label className="text-sm">Campo do CNPJ<input className={inputCls} value={c.cnpjField} onChange={(e) => set("cnpjField", e.target.value)} placeholder="Ex.: cf_850" /><span className="text-xs text-muted">Use “Testar conexão” para listar os campos e escolher.</span></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={pending || !dirty} onClick={() => run(() => saveEoxConfigAction(c), undefined, () => { const saved = { ...c, accessKey: "" }; setBase(saved); setC(saved); setHasKey(hasKey || !!c.accessKey); })}><Save size={15} aria-hidden /> Salvar</button>
          <button type="button" className={btnGhost} disabled={busy !== null || dirty} onClick={async () => { setBusy("test"); const r = await testEoxAction(); setBusy(null); setMsg({ ok: r.ok, text: r.message ?? "" }); setFields(r.fields ?? null); }}>{busy === "test" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <PlugZap size={14} aria-hidden />} Testar conexão</button>
        </div>
        {dirty && <p className="text-xs text-muted">Salve antes de testar.</p>}
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
        {fields && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{cand.length ? "Campos que parecem ser o CNPJ (clique para usar):" : "Nenhum campo com “CNPJ” no nome. Todos os campos:"}</p>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-auto">
              {(cand.length ? cand : fields).map((f) => <button key={f.name} type="button" onClick={() => set("cnpjField", f.name)} className={`rounded-full border px-2.5 py-1 text-xs ${c.cnpjField === f.name ? "border-accent bg-accent/10 font-semibold" : "border-line bg-sunk"}`}>{f.label} <code>{f.name}</code></button>)}
            </div>
          </div>
        )}
      </section>

      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="font-semibold">Sincronização</h2>
        <p className="text-sm text-muted">Roda sozinha todo dia de manhã e também na hora em que alguém liga para um lead sem link. Hoje <b>{coverage.total - coverage.without}</b> de <b>{coverage.total}</b> leads têm o link da EOX.{sync.at && <> Última rodada: {new Date(sync.at).toLocaleString("pt-BR")} ({sync.lastLinked} novos, {sync.lastScanned} cadastros lidos).</>}</p>
        <button type="button" className={btnGhost} disabled={busy !== null || !base.on || dirty} onClick={async () => { setBusy("sync"); const r = await syncEoxNowAction(); setBusy(null); setMsg({ ok: r.ok, text: r.message ?? "" }); }}>{busy === "sync" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />} Sincronizar agora</button>
      </section>
    </div>
  );
}
