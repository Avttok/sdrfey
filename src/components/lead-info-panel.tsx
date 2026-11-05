"use client";

import { Copy, MapPin, RefreshCw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { btnGhost, panelCls } from "@/components/ui";
import { fmtAge, fmtCnpj, fmtDate, fmtMoney } from "@/lib/format";
import { flattenRaw } from "@/modules/enrich/flatten";
import { refreshInfoAction } from "@/modules/leads/actions";
import type { LeadView } from "@/modules/leads/view";

type Search = "idle" | "searching" | "failed";

/** Dados da empresa + representante mais próximo. Usado no atendimento e no editor do lead. */
export function LeadInfoPanel({ lead, autoSearch = true }: { lead: LeadView; autoSearch?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [state, setState] = useState<Search>(autoSearch && lead.enrichedAt === null ? "searching" : "idle");
  const [all, setAll] = useState(false);

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
  const mapsQuery = a?.street ? [a.street, a.number, lead.city, lead.uf].filter(Boolean).join(", ") : [lead.company, lead.city, lead.uf].filter(Boolean).join(" ");
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const rep = lead.rep;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast("info", `Copiado: ${t}`); } catch { toast("warn", "Não consegui copiar."); } };

  const sources = [["BrasilAPI", lead.brasilApi], ["ReceitaWS", lead.receitaWs]] as const;

  return (
    <section className="space-y-3">
      <h2 className="display text-xl">Dados da empresa</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Razão social</dt><dd>{lead.company}</dd>
        {lead.tradeName && <><dt className="text-muted">Fantasia</dt><dd>{lead.tradeName}</dd></>}
        <dt className="text-muted">CNPJ</dt><dd className="flex items-center gap-2">{fmtCnpj(lead.cnpj)} <button type="button" aria-label="Copiar CNPJ" onClick={() => copy(lead.cnpj)}><Copy size={14} /></button></dd>
        <dt className="text-muted">Situação</dt>
        <dd>{status ? <b className={status.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{status.toUpperCase()}</b> : missing}</dd>
        <dt className="text-muted">Atividade</dt><dd>{val(info?.activity ? `${info.cnae ? `${info.cnae} - ` : ""}${info.activity}` : null)}</dd>
        <dt className="text-muted">Tempo de atividade</dt><dd>{val(ageText)}</dd>
        <dt className="text-muted">Capital</dt><dd>{val(info?.capital != null ? fmtMoney(info.capital) : null)}</dd>
        <dt className="text-muted">Sócios</dt><dd>{val(info?.partners.length ? info.partners.map((p) => p.name).join(", ") : null)}</dd>
        <dt className="text-muted">Endereço</dt><dd>{val(addressLine)}</dd>
        <dt className="text-muted">Cidade</dt>
        <dd className="flex flex-wrap items-center gap-2">{val(lead.city ? `${lead.city}/${lead.uf}` : null)} <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline"><MapPin size={14} aria-hidden /> Google Maps</a></dd>
      </dl>
      {lead.enrichedAt && <p className="text-xs text-muted">Consulta salva em {fmtDate(lead.enrichedAt)}. Use “Atualizar informações” para buscar de novo.</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={pending} className={btnGhost} onClick={search}>{pending ? <Spinner size={15} /> : <RefreshCw size={15} aria-hidden />} Atualizar informações</button>
        <button type="button" className={btnGhost} onClick={() => setAll(!all)}>{all ? "Ocultar informações" : "Ver todas as informações"}</button>
      </div>

      {all && (
        <div className="space-y-4 rounded-lg bg-sunk p-3 text-xs">
          {sources.map(([name, raw]) => {
            const rows = flattenRaw(raw);
            return (
              <div key={name}>
                <p className="mb-1.5 text-sm font-semibold">{name}</p>
                {rows.length ? <dl className="grid grid-cols-[minmax(0,14rem)_1fr] gap-x-3 gap-y-1">{rows.map((r, i) => <div key={i} className="contents"><dt className="text-muted">{r.label}</dt><dd className="break-words">{r.value}</dd></div>)}</dl> : <p className="text-warn">{searching ? "Pesquisando…" : "Sem resposta desta fonte."}</p>}
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

      <div className={`${panelCls} p-3 text-sm`}>
        <p className="mb-2 font-semibold">Representante mais próximo</p>
        {rep ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Representante</dt><dd>{val(rep.repName)}</dd>
            <dt className="text-muted">Código SAP</dt><dd>{val(rep.sapCode)}</dd>
            <dt className="text-muted">ESC</dt><dd>{val(rep.esc)}</dd>
            <dt className="text-muted">Gestor</dt><dd>{val(rep.managerName)}</dd>
            <dt className="text-muted">Equipe</dt><dd>{val(rep.team)}</dd>
            <dt className="text-muted">CNPJ</dt><dd>{val(rep.cnpj ? fmtCnpj(rep.cnpj.replace(/\D/g, "")) : null)}</dd>
            <dt className="text-muted">Endereço</dt><dd>{val(rep.address)}</dd>
            <dt className="text-muted">CEP</dt><dd>{val(rep.cep)}</dd>
            <dt className="text-muted">Cidade</dt><dd>{val(rep.city ? `${rep.city}/${rep.uf}` : null)}</dd>
            <dt className="text-muted">Distância</dt><dd>~{rep.km} km em linha reta</dd>
          </dl>
        ) : <p>{missing}{!lead.city && !searching ? <span className="ml-1 text-xs text-muted">(cidade do lead desconhecida)</span> : null}</p>}
      </div>
    </section>
  );
}
