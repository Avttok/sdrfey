"use client";

import { CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, panelCls } from "@/components/ui";
import { importContactsAction, type ContactsImportResult } from "@/modules/facts/contacts";

/** Importa contatos (uma linha por pessoa, ligada ao lead pelo CNPJ). Confere primeiro, grava depois. */
export function ContactsImport() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Extract<ContactsImportResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const send = (apply: boolean) => {
    if (!file) return;
    const body = new FormData(); body.set("file", file);
    start(async () => {
      const r = await importContactsAction(body, apply);
      if (!r.ok) return toast("bad", r.message);
      setRes(r);
      if (apply) { toast("ok", `${r.created} contatos novos e ${r.updated} atualizados.`); setFile(null); if (input.current) input.current.value = ""; }
    });
  };
  const nf = (n: number) => n.toLocaleString("pt-BR");
  return (
    <div className="space-y-4">
      <section className={`${panelCls} space-y-3 p-5`}>
        <h2 className="flex items-center gap-2 text-base font-bold"><FileSpreadsheet size={17} aria-hidden className="text-accent" /> Planilha de contatos (CSV)</h2>
        <p className="text-sm text-muted">Uma linha por pessoa. Colunas: <b>CNPJ</b> e <b>Nome</b> são obrigatórias; <b>Cargo</b>, <b>Telefone</b>, <b>E-mail</b>, <b>Ramal</b> e <b>Observação</b> são opcionais. O mesmo CNPJ pode aparecer em várias linhas (um contato em cada). Quem já existe na empresa é atualizado, sem duplicar.</p>
        <input ref={input} type="file" accept=".csv,text/csv" aria-label="Arquivo CSV de contatos" className="block w-full text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); }} />
        <div className="flex gap-2"><button type="button" className={btnGhost} disabled={!file || pending} onClick={() => send(false)}>Conferir antes</button>
          <button type="button" className={btnPrimary} disabled={!file || pending || !res || res.applied} onClick={() => send(true)}>Importar</button></div>
      </section>
      {res && (
        <section className={`${panelCls} space-y-2 p-5`} aria-live="polite">
          <h3 className="flex items-center gap-2 font-bold"><CheckCircle2 size={16} aria-hidden className="text-ok" /> {res.applied ? "Importado" : "Prévia (nada foi gravado ainda)"}</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            <li><b className="figure">{nf(res.rows)}</b> linhas na planilha</li><li><b className="figure">{nf(res.leadsFound)}</b> empresas encontradas</li>
            <li><b className="figure">{nf(res.created)}</b> contatos novos</li><li><b className="figure">{nf(res.updated)}</b> contatos já existentes (completados)</li>
            <li><b className="figure">{nf(res.phones)}</b> telefones</li><li><b className="figure">{nf(res.emails)}</b> e-mails</li>
            <li><b className="figure">{nf(res.skipped)}</b> linhas ignoradas</li>
          </ul>
          {res.problems.length > 0 && <ul className="space-y-0.5 rounded-xl bg-warn/10 p-3 text-xs text-warn">{res.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        </section>
      )}
    </div>
  );
}
