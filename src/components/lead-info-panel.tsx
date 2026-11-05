"use client";

import { MapPin, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { CopyVal } from "@/components/copy-val";
import { Spinner } from "@/components/spinner";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, panelCls } from "@/components/ui";
import { fmtAge, fmtCnpj, fmtDate, fmtMoney } from "@/lib/format";
import { selectedRows } from "@/modules/enrich/flatten";
import { refreshInfoAction } from "@/modules/leads/actions";
import type { LeadView } from "@/modules/leads/view";

type Search = "idle" | "searching" | "failed";

/** Dados da empresa + representante mais próximo. Usado no atendimento e no editor do lead. */
export function LeadInfoPanel({ lead, autoSearch = true, wide = false }: { lead: LeadView; autoSearch?: boolean; wide?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [state, setState] = useState<Search>(autoSearch && lead.enrichedAt === null ? "searching" : "idle");
  const [all, setAll] = useState(false);
  useBusyWhile(pending, "Pesquisando…");

  const search = () => {
    setState("searching");
    start(async () => {
      const r = await refreshInfoAction(lead.id);
      setState(r.ok ? "idle" : "failed");
      if (!r.ok) toast("warn", r.message);
      else if (r.message) toast("ok", r.message);
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
        <dt className="text-muted">Razão social</dt><dd><CopyVal>{lead.company}</CopyVal></dd>
        {lead.tradeName && <><dt className="text-muted">Fantasia</dt><dd><CopyVal>{lead.tradeName}</CopyVal></dd></>}
        <dt className="text-muted">CNPJ</dt><dd><CopyVal text={lead.cnpj}>{fmtCnpj(lead.cnpj)}</CopyVal></dd>
        <dt className="text-muted">Situação</dt>
        <dd>{status ? <b className={status.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{status.toUpperCase()}</b> : missing}</dd>
        <dt className="text-muted">Atividade</dt><dd>{info?.activity ? <CopyVal>{`${info.cnae ? `${info.cnae} - ` : ""}${info.activity}`}</CopyVal> : missing}</dd>
        <dt className="text-muted">Tempo de atividade</dt><dd>{ageText ? <CopyVal>{ageText}</CopyVal> : missing}</dd>
        <dt className="text-muted">Capital</dt><dd>{info?.capital != null ? <CopyVal>{fmtMoney(info.capital)}</CopyVal> : missing}</dd>
        <dt className="text-muted">Sócios</dt><dd>{info?.partners.length ? <ul className="space-y-0.5">{info.partners.map((p, i) => <li key={i}><CopyVal text={p.name}><b className="font-semibold">{p.name}</b>{p.role ? <span className="text-muted"> · {p.role}</span> : null}</CopyVal></li>)}</ul> : missing}</dd>
        <dt className="text-muted">Endereço</dt><dd>{addressLine ? <CopyVal>{addressLine}</CopyVal> : missing}</dd>
        <dt className="text-muted">Cidade</dt>
        <dd className="flex flex-wrap items-center gap-2">{lead.city ? <CopyVal>{`${lead.city}/${lead.uf}`}</CopyVal> : missing} <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline"><MapPin size={14} aria-hidden /> Google Maps</a></dd>
      </dl>
      {lead.enrichedAt && <p className="text-xs text-muted">Consulta salva em {fmtDate(lead.enrichedAt)}. Use “Atualizar informações” para buscar de novo.</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={pending} className={btnGhost} onClick={() => search()}>{pending ? <Spinner size={15} /> : <RefreshCw size={15} aria-hidden />} Atualizar informações</button>
        <button type="button" className={btnGhost} onClick={() => setAll(!all)}>{all ? "Ocultar informações" : "Ver todas as informações"}</button>
      </div>

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
                {rows.length ? <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1">{rows.map((r, i) => <div key={i} className="contents"><dt className="text-muted">{r.label}</dt><dd><CopyVal>{r.value}</CopyVal></dd></div>)}</dl> : <p className="text-warn">{searching ? "Pesquisando…" : (name === "BrasilAPI" && lead.receitaWs ? "" : "Sem resposta desta fonte. Use “Atualizar informações”.")}</p>}
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
    <>
      <div className={`${panelCls} p-3 text-sm`}>
        <p className="mb-2 font-semibold">Representante mais próximo</p>
        {rep ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Representante</dt><dd>{rep.repName ? <CopyVal>{rep.repName}</CopyVal> : missing}</dd>
            <dt className="text-muted">Equipe</dt><dd>{rep.team ? <CopyVal>{rep.team}</CopyVal> : missing}</dd>
            <dt className="text-muted">Cidade/UF</dt><dd>{rep.city ? <CopyVal>{`${rep.city}/${rep.uf}`}</CopyVal> : missing}</dd>
            <dt className="text-muted">Distância</dt><dd><CopyVal text={`${rep.km} km`}>{rep.km} km</CopyVal></dd>
            <dt className="text-muted">Gestor</dt><dd>{rep.managerName ? <CopyVal>{rep.managerName}</CopyVal> : missing}</dd>
            <dt className="text-muted">Código SAP</dt><dd>{rep.sapCode ? <CopyVal>{rep.sapCode}</CopyVal> : missing}</dd>
          </dl>
        ) : <p>{missing}{!lead.city && !searching ? <span className="ml-1 text-xs text-muted">(cidade do lead desconhecida)</span> : null}</p>}
      </div>
    </>
  );

  if (wide) {
    return (
      <section className="space-y-4">
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {companyBlock}
          <div className="space-y-3">{repBlock}</div>
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
