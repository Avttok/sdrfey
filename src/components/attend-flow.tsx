"use client";

import { Ban, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Mail, MapPin, MessageCircle, Phone, Plus, RefreshCw, SkipForward, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { TagChip } from "@/components/tag-chip";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { fmtCnpj, fmtDate, fmtMoney, fmtPhone } from "@/lib/format";
import { addChannelAction, discardAction, heartbeatAction, markWrongAction, refreshInfoAction, releaseAction, removeChannelAction, saveAction, skipAction, startAction, startedAction } from "@/modules/leads/actions";
import { mailtoLink, renderTemplate } from "@/modules/email/render";
import type { LeadView, TagCatalog } from "@/modules/leads/view";

type Template = { id: number; name: string; subject: string; body: string };
const STEPS = ["Contatos", "E-mail", "WhatsApp", "Ligação", "Resultado"] as const;
const MEIOS = [["ligacao", "Ligação"], ["whatsapp", "WhatsApp"], ["email", "Email"], ["pessoalmente", "Pessoalmente"], ["representante", "Representante"]] as const;

const copy = async (text: string, toast: ReturnType<typeof useToast>) => {
  try {
    await navigator.clipboard.writeText(text);
    toast("info", `Copiado: ${text}`);
  } catch {
    toast("warn", "Não consegui copiar. Selecione e copie manualmente.");
  }
};

function yearsSince(iso: string | null) {
  if (!iso) return null;
  const y = (Date.now() - new Date(iso).getTime()) / (365.25 * 86400_000);
  return y >= 1 ? `${Math.floor(y)} ano(s)` : `${Math.max(1, Math.round(y * 12))} mês(es)`;
}

export function AttendFlow({ lead, catalog, templates, myName, doneToday, goal }: { lead: LeadView; catalog: TagCatalog; templates: Template[]; myName: string; doneToday: number; goal: number }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [temperature, setTemperature] = useState<string | null>(lead.tags.find((t) => t.groupKey === "temperatura")?.key ?? null);
  const [qualification, setQualification] = useState<"qualificado" | "desqualificado" | null>((lead.tags.find((t) => t.groupKey === "qualificacao")?.key as never) ?? null);
  const [situations, setSituations] = useState<Set<string>>(new Set(lead.tags.filter((t) => t.groupKey === "situacao").map((t) => t.key)));
  const [note, setNote] = useState(lead.notes ?? "");
  const [visit, setVisit] = useState("");
  const [showVisit, setShowVisit] = useState(false);
  const [more, setMore] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [tplId, setTplId] = useState(templates[0]?.id ?? 0);
  const [emailTo, setEmailTo] = useState("");
  const [phoneSel, setPhoneSel] = useState("");

  const phones = lead.channels.filter((c) => c.kind === "phone");
  const emails = lead.channels.filter((c) => c.kind === "email");
  const goodPhones = phones.filter((p) => !p.wrong);
  const goodEmails = emails.filter((e) => !e.wrong);
  const groups = useMemo(() => Object.fromEntries(catalog.map((g) => [g.key, g])), [catalog]);

  /* lead ainda não consultado: busca os dados da Receita sozinho, uma vez, ao abrir */
  useEffect(() => {
    if (lead.enrichedAt !== null) return;
    void refreshInfoAction(lead.id).then((r) => {
      if (!r.ok) toast("warn", r.message);
      else if (r.message?.includes("novo")) toast("info", r.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  /* batimento a cada 30 s: mantém o lead com você e mostra que está online */
  useEffect(() => {
    const beat = () => void heartbeatAction(lead.id, `Atendendo ${lead.company}`);
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [lead.id, lead.company]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, okMsg?: string) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok) toast("bad", r.message ?? "Não foi possível concluir.");
      else if (r?.message || okMsg) toast("ok", (r?.message ?? okMsg)!);
    });

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(key) ? n.delete(key) : n.add(key);
    setter(n);
  };
  const go = (n: number) => {
    if (step === 0 && n > 0) void startedAction(lead.id);
    setStep(Math.min(Math.max(n, 0), STEPS.length - 1));
  };

  const tpl = templates.find((t) => t.id === tplId);
  const vars = { meu_nome: myName.split(" ")[0], empresa: lead.tradeName ?? lead.company, cidade: lead.city, representante: lead.rep?.repName, contato: lead.people[0]?.name?.split(" ")[0] };
  const mail = tpl && (emailTo || goodEmails[0]?.value) ? mailtoLink(emailTo || goodEmails[0].value, renderTemplate(tpl.subject, vars), renderTemplate(tpl.body, vars)) : null;
  const wa = (phoneSel || goodPhones[0]?.value) ? `https://app.chatpro.com.br/add/cloud/55${phoneSel || goodPhones[0].value}` : null;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.company} ${lead.city ?? ""} ${lead.uf ?? ""}`)}`;

  const save = (extraSituation?: string) => {
    const sits = new Set(situations);
    if (extraSituation) sits.add(extraSituation);
    run(async () => {
      const r = await saveAction({ leadId: lead.id, channels: [...used], temperature, qualification, situations: [...sits], note, visitCode: showVisit ? visit : null });
      if (r.ok) await startAction();
      return r;
    });
  };

  return (
    <div className="space-y-5">
      {/* topo: progresso do dia + passos */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-2xl sm:text-3xl">{lead.tradeName ?? lead.company}</h1>
        {lead.isTest && <span className="rounded-md bg-sunk px-2 py-0.5 text-xs font-semibold">MODO TESTE</span>}
        <span className="ml-auto text-sm text-muted">Hoje: <b className="figure text-ink">{doneToday}</b> / {goal}</span>
      </div>
      <ol className="flex flex-wrap gap-1.5" aria-label="Passos do atendimento">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${i === step ? "bg-accent text-on-accent" : i < step ? "bg-sunk text-ink" : "text-muted hover:bg-sunk/60"}`}>
              <span className="figure text-xs opacity-80">{i + 1}</span> {s}
            </button>
          </li>
        ))}
      </ol>

      <div className={`${panelCls} p-5 sm:p-6`}>
        {step === 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="display text-xl">Dados da empresa</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted">Razão social</dt><dd>{lead.company}</dd>
                {lead.tradeName && <><dt className="text-muted">Fantasia</dt><dd>{lead.tradeName}</dd></>}
                <dt className="text-muted">CNPJ</dt><dd className="flex items-center gap-2">{fmtCnpj(lead.cnpj)} <button type="button" aria-label="Copiar CNPJ" onClick={() => copy(lead.cnpj, toast)}><Copy size={14} /></button></dd>
                <dt className="text-muted">Situação</dt><dd>{lead.registrationStatus ?? "Sem informação"}</dd>
                <dt className="text-muted">Atividade</dt><dd>{lead.info?.activity ?? "Sem informação"}</dd>
                <dt className="text-muted">Tempo de atividade</dt><dd>{yearsSince(lead.info?.openedAt ?? null) ?? "Sem informação"}</dd>
                <dt className="text-muted">Capital</dt><dd>{lead.info?.capital != null ? fmtMoney(lead.info.capital) : "Sem informação"}</dd>
                <dt className="text-muted">Sócios</dt><dd>{lead.info?.partners.length ? lead.info.partners.map((p) => p.name).join(", ") : "Sem informação"}</dd>
                <dt className="text-muted">Cidade</dt>
                <dd className="flex flex-wrap items-center gap-2">{lead.city ? `${lead.city}/${lead.uf}` : "Sem informação"} <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline"><MapPin size={14} aria-hidden /> Google Maps</a></dd>
              </dl>
              {lead.enrichedAt === null && <p className="text-xs text-muted">Consulta ainda não feita ou indisponível. Use “Atualizar informações”.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending} className={btnGhost} onClick={() => run(() => refreshInfoAction(lead.id))}><RefreshCw size={15} aria-hidden /> Atualizar informações</button>
                <button type="button" className={btnGhost} onClick={() => setMore(!more)}>{more ? "Ocultar" : "Ver todas as informações"}</button>
              </div>
              {more && (
                <div className="rounded-lg bg-sunk p-3 text-xs">
                  <p className="mb-1 font-semibold">Pessoas</p>
                  {lead.people.length ? lead.people.map((p) => <p key={p.id}>{p.name}{p.roleTitle ? ` · ${p.roleTitle}` : ""}{p.extension ? ` · ramal ${p.extension}` : ""}</p>) : <p className="text-muted">Nenhuma pessoa cadastrada.</p>}
                  <p className="mb-1 mt-2 font-semibold">Visitas</p>
                  {lead.visits.length ? lead.visits.map((v) => <p key={v.at}>{v.code} · {fmtDate(v.at)}{v.canceled ? " (cancelada)" : ""}</p>) : <p className="text-muted">Nenhuma visita.</p>}
                  {lead.legacyVisit && <p className="mt-1">Planilha antiga: {lead.legacyVisit}</p>}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => <TagChip key={t.id} label={t.label} color={t.color} />)}
              </div>
              <div className="rounded-lg border border-line p-3 text-sm">
                <p className="mb-1 font-semibold">Representante mais próximo</p>
                {lead.rep ? <p>{lead.rep.repName ?? "—"} · {lead.rep.city}/{lead.rep.uf} · a ~{lead.rep.km} km{lead.rep.managerName ? ` · gestor ${lead.rep.managerName}` : ""}</p> : <p className="text-muted">Sem informação (cidade do lead não encontrada).</p>}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="display text-xl">Contatos</h2>
              <ul className="space-y-1.5">
                {[...phones, ...emails].map((c) => (
                  <li key={c.id} className={`flex items-center gap-2 rounded-lg bg-sunk px-3 py-2 text-sm ${c.wrong ? "opacity-60 line-through" : ""}`}>
                    {c.kind === "phone" ? <Phone size={15} aria-hidden /> : <Mail size={15} aria-hidden />}
                    <span className="flex-1 break-all">{c.kind === "phone" ? fmtPhone(c.value) : c.value}<span className="ml-2 text-xs text-muted">{c.origin === "import" ? "" : c.origin}</span></span>
                    <button type="button" aria-label="Copiar" onClick={() => copy(c.value, toast)}><Copy size={15} /></button>
                    <button type="button" aria-label={c.wrong ? "Desmarcar como errado" : "Marcar como errado"} title={c.wrong ? "Desmarcar como errado" : "Marcar como errado"} onClick={() => run(() => markWrongAction(lead.id, c.id, !c.wrong))}><Ban size={15} /></button>
                    <button type="button" aria-label="Remover" onClick={() => run(() => removeChannelAction(lead.id, c.id), "Contato removido.")}><Trash2 size={15} /></button>
                  </li>
                ))}
                {phones.length + emails.length === 0 && <li className="text-sm text-muted">Nenhum contato. Adicione abaixo ou use “Atualizar informações”.</li>}
              </ul>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = newValue.trim(); if (!v) return; run(() => addChannelAction(lead.id, v.includes("@") ? "email" : "phone", v)); setNewValue(""); }}>
                <input className={inputCls} placeholder="Novo telefone ou e-mail" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                <button type="submit" className={btnGhost} disabled={pending}><Plus size={15} aria-hidden /> Adicionar</button>
              </form>
            </section>
          </div>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <h2 className="display text-xl">E-mail</h2>
            {goodEmails.length === 0 ? <p className="text-sm text-muted">Este lead não tem e-mail válido. Adicione no passo Contatos ou pule.</p> : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">Modelo<select className={inputCls} value={tplId} onChange={(e) => setTplId(Number(e.target.value))}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                  <label className="text-sm">Enviar para<select className={inputCls} value={emailTo} onChange={(e) => setEmailTo(e.target.value)}>{goodEmails.map((e) => <option key={e.id} value={e.value}>{e.value}</option>)}</select></label>
                </div>
                {tpl && <div className="rounded-lg bg-sunk p-3 text-sm"><p className="font-semibold">{renderTemplate(tpl.subject, vars)}</p><p className="mt-2 whitespace-pre-wrap">{renderTemplate(tpl.body, vars)}</p></div>}
                {mail && <a href={mail} onClick={() => setUsed(new Set(used).add("email"))} className={btnPrimary}><ExternalLink size={16} aria-hidden /> Abrir e-mail</a>}
              </>
            )}
            <UsedToggle on={used.has("email")} onClick={() => toggle(used, "email", setUsed)} label="Usei e-mail neste lead" />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <h2 className="display text-xl">WhatsApp</h2>
            {goodPhones.length === 0 ? <p className="text-sm text-muted">Sem telefone válido.</p> : (
              <>
                <label className="block max-w-sm text-sm">Número<select className={inputCls} value={phoneSel} onChange={(e) => setPhoneSel(e.target.value)}>{goodPhones.map((p) => <option key={p.id} value={p.value}>{fmtPhone(p.value)}</option>)}</select></label>
                {wa && <a href={wa} target="_blank" rel="noreferrer" onClick={() => setUsed(new Set(used).add("whatsapp"))} className={btnPrimary}><MessageCircle size={16} aria-hidden /> Abrir no ChatPro</a>}
              </>
            )}
            <UsedToggle on={used.has("whatsapp")} onClick={() => toggle(used, "whatsapp", setUsed)} label="Usei WhatsApp neste lead" />
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <h2 className="display text-xl">Ligação</h2>
            <p className="text-sm text-muted">Copie o número e cole no VoCallPhone.</p>
            <ul className="space-y-1.5">
              {goodPhones.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-lg bg-sunk px-3 py-2"><span className="figure text-lg">{fmtPhone(p.value)}</span><button type="button" className={btnGhost} onClick={() => { void copy(p.value, toast); setUsed(new Set(used).add("ligacao")); }}><Copy size={15} aria-hidden /> Copiar</button></li>)}
              {goodPhones.length === 0 && <li className="text-sm text-muted">Sem telefone válido.</li>}
            </ul>
            <UsedToggle on={used.has("ligacao")} onClick={() => toggle(used, "ligacao", setUsed)} label="Usei ligação neste lead" />
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5">
            <h2 className="display text-xl">Resultado</h2>
            <Group title="Meios de contato usados">{MEIOS.map(([k, l]) => <TagChip key={k} small={false} label={l} color={groups.meio?.tags.find((t) => t.key === k)?.color ?? "#64748b"} on={used.has(k)} onClick={() => toggle(used, k, setUsed)} />)}</Group>
            <Group title="Temperatura">{groups.temperatura?.tags.map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={temperature === t.key} onClick={() => setTemperature(temperature === t.key ? null : t.key)} />)}</Group>
            <Group title="Qualificação">{groups.qualificacao?.tags.map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={qualification === t.key} onClick={() => setQualification(qualification === t.key ? null : (t.key as "qualificado"))} />)}</Group>
            <Group title="Situação">{groups.situacao?.tags.filter((t) => !t.autoOnly).map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={situations.has(t.key)} onClick={() => toggle(situations, t.key, setSituations)} />)}</Group>
            <div>
              <button type="button" className={btnGhost} onClick={() => setShowVisit(!showVisit)}>{showVisit ? "Sem agendamento" : "Agendar visita"}</button>
              {showVisit && <div className="mt-2 max-w-xs"><input className={inputCls} placeholder="Código da visita (V-12345)" value={visit} onChange={(e) => setVisit(e.target.value)} /><p className="mt-1 text-xs text-muted">Agendar visita qualifica o lead automaticamente.</p></div>}
            </div>
            <label className="block text-sm">Observação<textarea className={`${inputCls} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" disabled={pending} className={btnPrimary} onClick={() => save()}><Check size={17} aria-hidden /> Salvar e próximo</button>
              <button type="button" disabled={pending} className={btnGhost} onClick={() => save("sem_contato")}>Sem contato (salvar)</button>
              <button type="button" disabled={pending} className={`${btnGhost} text-danger`} onClick={() => run(async () => { const r = await discardAction(lead.id, "Descartado no atendimento"); if (r.ok) await startAction(); return r; })}><X size={16} aria-hidden /> Descartar</button>
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnGhost} disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft size={16} aria-hidden /> Voltar</button>
        {step < STEPS.length - 1 && <button type="button" className={btnPrimary} onClick={() => go(step + 1)}>Avançar <ChevronRight size={16} aria-hidden /></button>}
        <span className="flex-1" />
        <button type="button" className={btnGhost} disabled={pending} title="Esconde este lead só de você por 24 h e não conta na meta" onClick={() => run(async () => { const r = await skipAction(lead.id); if (r.ok) await startAction(); return r; })}><SkipForward size={16} aria-hidden /> Pular</button>
        <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => releaseAction(lead.id))}>Liberar e sair</button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-sm font-medium">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}
function UsedToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={`${btnGhost} ${on ? "border-accent bg-sunk" : ""}`}>{on ? <Check size={15} aria-hidden /> : null} {label}</button>;
}
