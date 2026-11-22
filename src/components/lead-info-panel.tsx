"use client";

import { MapPin, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyVal } from "@/components/copy-val";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost } from "@/components/ui";
import { cleanRole, fmtAge, fmtCnpj, fmtDate, fmtMoney } from "@/lib/format";
import { selectedRows } from "@/modules/enrich/flatten";
import type { LeadView } from "@/modules/leads/view";

type Search = "idle" | "searching" | "failed";

/** Dados da empresa + representante mais próximo. Usado no atendimento e no editor do lead. */
export function LeadInfoPanel({ lead, autoSearch = true, wide = false, showMap = true }: { lead: LeadView; autoSearch?: boolean; wide?: boolean; showMap?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<Search>(autoSearch && lead.enrichedAt === null ? "searching" : "idle");
  const [all, setAll] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [manual, setManual] = useState(false);
  // A pesquisa automática ao abrir o lead NÃO trava a tela (só mostra "Pesquisando…" no painel); o botão Atualizar trava.
  useBusyWhile(pending && manual, "Pesquisando…");

  const search = (isManual = false) => {
    setManual(isManual);
    setState("searching");
    start(async () => {
      let r: { ok: boolean; message?: string } = { ok: false, message: "Não consegui consultar agora." };
      try {
        const res = await fetch("/api/enrich", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: lead.id, manual: isManual }) });
        r = await res.json();
      } catch { /* sem rede: mantém a mensagem padrão */ }
      setState(r.ok ? "idle" : "failed");
      if (!r.ok) toast("warn", r.message ?? "Consulta indisponível.");
      else if (r.message) toast("ok", r.message);
      if (r.ok) router.refresh();
    });
  };
  useEffect(() => { if (autoSearch && lead.enrichedAt === null) search(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lead.id]);

  const info = lead.info;
  const searching = state === "searching";
  /** Valor ausente: “Pesquisando…” enquanto busca, aviso se falhou, “Sem informação” em amarelo. */
  const missing = searching ? <span className="inline-flex items-center gap-1.5 text-muted"><Spinner size={13} /> Pesquisando…</span> : <span className="text-warn">{state === "failed" ? "Consulta indisponível" : "Sem informação"}</span>;
  const val = (v: React.ReactNode) => (v === null || v === undefined || v === "" ? missing : v);

  const status = lead.registrationStatus;
  const ageText = fmtAge(info?.openedAt);
  const a = info?.address;
  const addressLine = a && (a.street || a.district) ? [a.street && `${a.street}${a.number ? `, ${a.number}` : ""}`, a.complement, a.district, a.cep && `CEP ${a.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`].filter(Boolean).join(" · ") : null;
  /** Sem número (vazio, S/N, SN, “sem número”…): busca por NOME DA EMPRESA + RUA + CIDADE + UF. */
  const noNumber = !a?.number || /^(s\s*\/?\s*n|sn|sem\s+n[uú]mero|s\.?\s*n\.?|0+|-+)$/i.test(a.number.trim());
  const mapsQuery = a?.street
    ? (noNumber ? [lead.tradeName ?? lead.company, a.street, lead.city, lead.uf] : [a.street, a.number, lead.city, lead.uf]).filter(Boolean).join(", ")
    : [lead.company, lead.city, lead.uf].filter(Boolean).join(" ");
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const rep = lead.rep;

  // Só a fonte que respondeu: ReceitaWS; a BrasilAPI aparece apenas se a ReceitaWS não trouxe nada.
  const sources: ["ReceitaWS" | "BrasilAPI", typeof lead.receitaWs][] = lead.receitaWs ? [["ReceitaWS", lead.receitaWs]] : lead.brasilApi ? [["BrasilAPI", lead.brasilApi]] : [["ReceitaWS", null]];

  const companyBlock = (
    <div className="space-y-3">
      <h2 className="display text-xl">Dados da empresa</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Razão social</dt><dd>{lead.company}</dd>
        {lead.tradeName && <><dt className="text-muted">Fantasia</dt><dd>{lead.tradeName}</dd></>}
        <dt className="text-muted">CNPJ</dt><dd><CopyVal text={lead.cnpj}>{fmtCnpj(lead.cnpj)}</CopyVal></dd>
        <dt className="text-muted">Situação</dt>
        <dd>{status ? <b className={status.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{status.toUpperCase()}</b> : missing}</dd>
        <dt className="text-muted">Atividade</dt><dd>{info?.activity ? (`${info.cnae ? `${info.cnae} - ` : ""}${info.activity}`) : missing}</dd>
        <dt className="text-muted">Tempo de atividade</dt><dd>{ageText ? (ageText) : missing}</dd>
        <dt className="text-muted">Capital</dt><dd>{info?.capital != null ? (fmtMoney(info.capital)) : missing}</dd>
        <dt className="text-muted">Sócios</dt><dd>{info?.partners.length ? <ul className="space-y-0.5">{info.partners.map((p, i) => <li key={i}><b className="font-semibold">{p.name}</b>{cleanRole(p.role) ? <span className="text-muted"> · {cleanRole(p.role)}</span> : null}</li>)}</ul> : missing}</dd>
        <dt className="text-muted">Endereço</dt><dd className="flex flex-wrap items-center gap-x-2 gap-y-1">{addressLine ? <CopyVal>{addressLine}</CopyVal> : missing}{!showMap && <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline"><MapPin size={14} aria-hidden /> Google Maps</a>}</dd>
        {(lead.site || lead.instagram) && <><dt className="text-muted">Na internet</dt><dd className="flex flex-wrap gap-x-3 gap-y-1">{[["Site", lead.site], ["Instagram", lead.instagram]].map(([k, u]) => u && /^https?:\/\//i.test(u) ? <a key={k} href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline-offset-2 hover:underline">{k}</a> : u ? <span key={k}>{k}: {u}</span> : null)}</dd></>}
        <dt className="text-muted">Cidade</dt>
        <dd className="flex flex-wrap items-center gap-2">{lead.city ? (`${lead.city}/${lead.uf}`) : missing}</dd>
      </dl>
      {lead.enrichedAt && <p className="text-xs text-muted">Consulta salva em {fmtDate(lead.enrichedAt)}. Use “Atualizar informações” para buscar de novo.</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={pending} className={btnGhost} onClick={() => setConfirmRefresh(true)}>{pending ? <Spinner size={15} /> : <RefreshCw size={15} aria-hidden />} Atualizar informações</button>
        <button type="button" className={btnGhost} onClick={() => setAll(!all)}>{all ? "Ocultar informações" : "Ver todas as informações"}</button>
      </div>
      <ConfirmDialog open={confirmRefresh} icon={RefreshCw} title="Atualizar as informações?" confirmLabel="Sim, atualizar" cancelLabel="Não" onCancel={() => setConfirmRefresh(false)} onConfirm={() => { setConfirmRefresh(false); search(true); }}>
        Vamos consultar o CNPJ de novo e substituir os dados salvos desta empresa. Tem certeza?
      </ConfirmDialog>

    </div>
  );
  const allBlock = (
    <>
      {all && (
        <div className={`grid gap-4 rounded-lg bg-sunk p-3 text-xs ${wide ? "md:grid-cols-3 md:gap-6" : ""}`}>
          {sources.map(([name, raw]) => {
            const rows = selectedRows(name, raw);
            return (
              <div key={name}>
                <p className="mb-1.5 text-sm font-semibold">{name}</p>
                {rows.length ? <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1">{rows.map((r, i) => <div key={i} className="contents"><dt className="text-muted">{r.label}</dt><dd>{r.value}</dd></div>)}</dl> : <p className="text-warn">{searching ? "Pesquisando…" : (name === "BrasilAPI" && lead.receitaWs ? "" : "Sem resposta desta fonte. Use “Atualizar informações”.")}</p>}
              </div>
            );
          })}
          <div><p className="mb-1.5 text-sm font-semibold">Neste sistema</p>
            {lead.people.length ? lead.people.map((p) => <p key={p.id}>{p.name}{p.roleTitle ? ` · ${p.roleTitle}` : ""}{p.extension ? ` · ramal ${p.extension}` : ""}</p>) : <p className="text-muted">Nenhuma pessoa cadastrada.</p>}
            {lead.visits.map((v) => <p key={v.at}>Visita {v.code} · {fmtDate(v.at)}{v.canceled ? " (cancelada)" : ""}</p>)}
            {lead.legacyVisit && <p>Visita na planilha antiga: {lead.legacyVisit}</p>}
          </div>
        </div>
      )}

    </>
  );
  const repBlock = (
    <div className="space-y-3">
      <h2 className="display text-xl">Representante mais próximo</h2>
      {rep ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Representante</dt><dd>{rep.repName ? (rep.repName) : missing}</dd>
          <dt className="text-muted">Equipe</dt><dd>{rep.team ? (rep.team) : missing}</dd>
          <dt className="text-muted">Cidade/UF</dt><dd>{rep.city ? (`${rep.city}/${rep.uf}`) : missing}</dd>
          <dt className="text-muted">Distância</dt><dd>{rep.km} km</dd>
          <dt className="text-muted">Gestor</dt><dd>{rep.managerName ? (rep.managerName) : missing}</dd>
          <dt className="text-muted">Código SAP</dt><dd>{rep.sapCode ? (rep.sapCode) : missing}</dd>
        </dl>
      ) : <p className="text-sm">{missing}{!lead.city && !searching ? <span className="ml-1 text-xs text-muted">(cidade do lead desconhecida)</span> : null}</p>}
      {showMap && (a?.street || lead.city) && (
        <div className="overflow-hidden rounded-xl border border-line">
          <iframe title={`Mapa de ${lead.tradeName ?? lead.company}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-60 w-full" src={`https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`} />
        </div>
      )}
    </div>
  );

  if (wide) {
    return (
      <section className="space-y-4">
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {companyBlock}
          {repBlock}
        </div>
        {allBlock}
      </section>
    );
  }
  return (
    <section className="space-y-3">
      {companyBlock}
      {allBlock}
      {repBlock}
    </section>
  );
}
