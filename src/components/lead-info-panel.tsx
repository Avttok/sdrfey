"use client";

import { LeadLinks } from "@/components/lead-links";
import { Briefcase, Building2, CalendarCheck, CalendarClock, ChevronDown, ChevronUp, CircleCheck, Factory, Landmark, MapPin, RefreshCw, Scale, TriangleAlert, UserRound, Users, type LucideIcon } from "lucide-react";
import { ClientIds } from "@/components/client-ids";
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

/** "EMPRESA DE PEQUENO PORTE" → "Empresa de pequeno porte" (a Receita manda tudo em maiúsculas). */
const nice = (t: string) => { const l = t.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); };

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

  const open = status ? status.toUpperCase() === "ATIVA" : null;
  /* aceita "www.empresa.com.br" sem http; descarta o que não parece endereço */
  const toUrl = (v: string | null | undefined) => { const t = (v ?? "").trim(); if (!t || /\s/.test(t)) return null; if (/^https?:\/\//i.test(t)) return t; return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t) ? `https://${t}` : null; };
  const net = ([["site", lead.site], ["instagram", lead.instagram], ["facebook", lead.facebook], ["linkedin", lead.linkedin]] as [string, string | null][]).map(([k, v]) => [k, toUrl(v)] as const).filter((x): x is [string, string] => !!x[1]);
  const lastVisit = lead.visits.filter((v) => !v.canceled)[0];
  const companyBlock = (
    <div className="space-y-4">
      {/* capa: razão social inteira, fantasia, CNPJ e situação */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-grad-soft p-4 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative flex flex-wrap items-start gap-3">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-lg shadow-accent/30"><Building2 size={26} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-lg font-extrabold leading-snug tracking-tight sm:text-xl">{lead.company}</h2>
            {lead.tradeName && lead.tradeName.trim().toLowerCase() !== lead.company.trim().toLowerCase() && <p className="mt-0.5 break-words text-sm font-medium text-muted">{nice(lead.tradeName)}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><CopyVal text={lead.cnpj}><span className="figure">{fmtCnpj(lead.cnpj)}</span></CopyVal>{lead.city && <span className="inline-flex items-center gap-1 text-muted"><MapPin size={13} aria-hidden /> {lead.city}/{lead.uf}</span>}</p>
          </div>
          {status ? <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{open ? <CircleCheck size={14} aria-hidden /> : <TriangleAlert size={14} aria-hidden />} {status.toUpperCase()}</span> : <span className="rounded-full bg-sunk px-3 py-1 text-xs font-bold">{missing}</span>}
        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <LeadLinks lead={lead} />
        </div>
      </div>

      {/* números que importam para a conversa */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
        <Tile icon={Factory} label="Porte">{info?.porte ? nice(info.porte) : info?.isMei ? "MEI" : missing}</Tile>
        <Tile icon={Landmark} label="Capital">{info?.capital != null ? fmtMoney(info.capital) : missing}</Tile>
        <Tile icon={CalendarClock} label="Atividade há">{ageText ?? missing}</Tile>
        <Tile icon={CalendarCheck} label="Visitas">{lead.visits.length ? `${lead.visits.filter((v) => !v.canceled).length} · última ${fmtDate(lastVisit?.at ?? lead.visits[0].at)}` : "Nenhuma"}</Tile>
      </div>

      <div className="space-y-2.5 rounded-2xl border border-line p-4 text-sm">
        <Row icon={Briefcase} label="Atividade">{info?.activity ? `${info.cnae ? `${info.cnae} - ` : ""}${nice(info.activity)}` : missing}</Row>
        {info?.nature && <Row icon={Scale} label="Natureza jurídica">{nice(info.nature)}</Row>}
        <Row icon={MapPin} label="Endereço"><span className="flex flex-wrap items-center gap-x-2 gap-y-1">{addressLine ? <CopyVal>{addressLine}</CopyVal> : missing}{!showMap && <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline"><MapPin size={13} aria-hidden /> Abrir no mapa</a>}</span></Row>
        <Row icon={Users} label="Sócios">{info?.partners.length ? <span className="flex flex-wrap gap-1.5">{info.partners.map((p, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-sunk px-2.5 py-1 text-xs"><UserRound size={12} aria-hidden className="text-accent" /><b className="font-semibold">{p.name}</b>{cleanRole(p.role) ? <span className="text-muted">· {cleanRole(p.role)}</span> : null}</span>)}</span> : missing}</Row>
      </div>

    </div>
  );
  const actionsBlock = (
    <div className="space-y-3">
      {lead.enrichedAt && <p className="text-xs text-muted">Consulta da Receita salva em {fmtDate(lead.enrichedAt)}.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={btnGhost} onClick={() => setConfirmRefresh(true)}>{pending ? <Spinner size={15} /> : <RefreshCw size={15} aria-hidden />} Atualizar informações</button>
        <button type="button" className={btnGhost} onClick={() => setAll(!all)}>{all ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />} {all ? "Ocultar informações" : "Ver todas as informações"}</button>
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
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl border border-line p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent"><MapPin size={14} aria-hidden /> Representante mais próximo</p>
        {rep ? (
          <>
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><UserRound size={22} /></span>
              <div className="min-w-0 flex-1"><p className="break-words text-base font-bold leading-tight">{rep.repName ?? missing}</p><p className="text-xs text-muted">{[rep.team, rep.city ? `${rep.city}/${rep.uf}` : null].filter(Boolean).join(" · ")}</p></div>
              <span className="figure shrink-0 rounded-full bg-grad px-3 py-1 text-sm font-bold text-on-accent">{rep.km} km</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-sunk px-3 py-2"><dt className="text-muted">Gestor</dt><dd className="font-semibold">{rep.managerName ?? "—"}</dd></div><div className="rounded-xl bg-sunk px-3 py-2"><dt className="text-muted">Código SAP</dt><dd className="font-semibold">{rep.sapCode ?? "—"}</dd></div></dl>
          </>
        ) : <p className="text-sm">{missing}{!lead.city && !searching ? <span className="ml-1 text-xs text-muted">(cidade do lead desconhecida)</span> : null}</p>}
      </div>
      {showMap && (a?.street || lead.city) && (
        <div className="min-h-60 flex-1 overflow-hidden rounded-3xl border border-line">
          <iframe title={`Mapa de ${lead.tradeName ?? lead.company}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-full min-h-60 w-full" src={`https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`} />
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
        {actionsBlock}
        {allBlock}
      </section>
    );
  }
  return (
    <section className="space-y-3">
      {companyBlock}
      {actionsBlock}
      {allBlock}
      {repBlock}
    </section>
  );
}

function Tile({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-sunk/50 p-3"><p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-muted"><Icon size={13} aria-hidden className="shrink-0 text-accent" /> {label}</p><p className="mt-1.5 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{children}</p></div>;
}
function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return <div className="flex items-start gap-3"><span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent"><Icon size={14} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p><div className="text-sm leading-snug [overflow-wrap:anywhere]">{children}</div></div></div>;
}
