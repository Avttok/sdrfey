"use client";

import { Ban, Building2, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, Mail, MessageCircle, Pause, Phone, Send, Plus, RotateCcw, History, SkipForward, Square, TriangleAlert, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DateInput } from "@/components/date-input";
import { GoalBar } from "@/components/goal-bar";
import { CopyVal } from "@/components/copy-val";
import { LeadInfoPanel } from "@/components/lead-info-panel";
import { TagChip } from "@/components/tag-chip";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { chatproUrl, cleanRole, fmtCnpj, fmtDate, fmtDateTime, fmtMoney, fmtPhone } from "@/lib/format";
import { addChannelAction, discardAction, heartbeatAction, markWrongAction, releaseAction, removeChannelAction, resetLeadAction, saveAction, skipAction, startAction, startedAction } from "@/modules/leads/actions";
import { htmlToText, mailtoLink, renderHtml, renderTemplate } from "@/modules/email/render";
import type { LeadView, TagCatalog } from "@/modules/leads/view";
import type { Goals } from "@/modules/settings/goals";

export type PreviousAttendance = { by: string; at: string; channels: string[]; note: string | null };
type Template = { id: number; name: string; subject: string; body: string; bodyHtml: string | null };
const STEPS = ["Perfil", "E-mail", "WhatsApp", "Ligação", "Finalizar"] as const;

const copy = async (text: string, toast: ReturnType<typeof useToast>) => {
  try {
    await navigator.clipboard.writeText(text);
    toast("info", `Copiado: ${text}`);
  } catch {
    toast("warn", "Não consegui copiar. Selecione e copie manualmente.");
  }
};

export function AttendFlow({ lead, catalog, templates, myName, showMap, previous, doneToday, scheduledToday, goals, sellers }: { sellers: { id: number; name: string }[]; lead: LeadView; catalog: TagCatalog; templates: Template[]; myName: string; showMap: boolean; previous: PreviousAttendance | null; doneToday: number; scheduledToday: number; goals: Goals }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  useBusyWhile(pending);
  const [step, setStep] = useState(0);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [temperature, setTemperature] = useState<string | null>(lead.tags.find((t) => t.groupKey === "temperatura")?.key ?? null);
  const [qualification, setQualification] = useState<"qualificado" | "desqualificado" | null>((lead.tags.find((t) => t.groupKey === "qualificacao")?.key as never) ?? null);
  const [situations, setSituations] = useState<Set<string>>(new Set(lead.tags.filter((t) => t.groupKey === "situacao").map((t) => t.key)));
  const [note, setNote] = useState(lead.notes ?? "");
  const [visit, setVisit] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitLink, setVisitLink] = useState("");
  const dir = useRef<"fwd" | "back">("fwd");
  /** Para onde o lead vai ao final: ninguém, vendedores (negociação imediata) ou representante (visita). */
  const [dest, setDest] = useState<"none" | "sellers" | "reps">("none");
  const [sellerId, setSellerId] = useState<number | null>(null);
  const showVisit = dest === "reps";
  const [newValue, setNewValue] = useState("");
  const [tplId, setTplId] = useState(templates[0]?.id ?? 0);
  const [emailTo, setEmailTo] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();
  /** Lead com situação cadastral diferente de ATIVA: pergunta antes de seguir (uma vez por lead). */
  const [statusAck, setStatusAck] = useState<number | null>(null);
  const status = lead.registrationStatus?.trim().toUpperCase() ?? null;
  /** Lead que outra pessoa (ou você) já atendeu: mostra quem, quando e o resultado antes de seguir. */
  const [priorAck, setPriorAck] = useState<number | null>(null);
  const priorOpen = !!previous && priorAck !== lead.id;
  const inactive = !priorOpen && !!status && status !== "ATIVA" && statusAck !== lead.id;
  const seek = () => run(async () => { const r = await skipAction(lead.id); if (r.ok) await startAction(); return r; });

  const phones = lead.channels.filter((c) => c.kind === "phone");
  const emails = lead.channels.filter((c) => c.kind === "email");
  const goodPhones = phones.filter((p) => !p.wrong);
  const goodEmails = emails.filter((e) => !e.wrong);
  /** Etapas que fazem sentido para este lead: sem e-mail válido some "E-mail"; sem telefone válido somem "WhatsApp" e "Ligação". */
  const visible = [0, ...(goodEmails.length ? [1] : []), ...(goodPhones.length ? [2, 3] : []), 4];
  const nextStep = (from: number) => visible.find((i) => i > from) ?? from;
  const prevStep = (from: number) => [...visible].reverse().find((i) => i < from) ?? from;
  useEffect(() => { if (!visible.includes(step)) setStep(prevStep(step)); /* uma etapa pode sumir (ex.: último telefone marcado como errado) */ }, [visible.join(), step]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => Object.fromEntries(catalog.map((g) => [g.key, g])), [catalog]);

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
    const to = Math.min(Math.max(n, 0), STEPS.length - 1);
    dir.current = to >= step ? "fwd" : "back";
    setStep(to);
  };

  const tpl = templates.find((t) => t.id === tplId);
  const vars = { meu_nome: myName.split(" ")[0], empresa: lead.tradeName ?? lead.company, cidade: lead.city, representante: lead.rep?.repName, contato: lead.people[0]?.name?.split(" ")[0] };
  const mail = tpl && (emailTo || goodEmails[0]?.value) ? mailtoLink(emailTo || goodEmails[0].value, renderTemplate(tpl.subject, vars), renderTemplate(tpl.body, vars)) : null;

  /** Copia o corpo formatado e abre o e-mail já com destinatário e assunto; só falta colar (Ctrl+V). */
  const copyAndOpen = async () => {
    await copyFormatted();
    const to = emailTo || goodEmails[0]?.value;
    if (tpl && to) window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(renderTemplate(tpl.subject, vars))}`;
  };

  const payload = () => ({ leadId: lead.id, channels: [...used], temperature, qualification, situations: [...situations], note, visitCode: showVisit ? visit : null, visitDate: showVisit ? visitDate : null, visitLink: showVisit ? visitLink || null : null, handoff: { to: dest, sellerId: dest === "sellers" ? sellerId : null, note: null } });
  /** Salva e sorteia o próximo lead. */
  const save = () => run(async () => {
    const r = await saveAction(payload());
    if (r.ok) await startAction();
    return r;
  });
  /** Salva, libera o lead e volta à tela do botão Shuffler (pausa: o lead não fica contando tempo). */
  const saveAndStop = () => run(async () => {
    const r = await saveAction(payload());
    if (r.ok) { router.replace("/atender"); router.refresh(); }
    return r;
  });
  const copyFormatted = async () => {
    if (!tpl) return;
    const html = tpl.bodyHtml ? renderHtml(tpl.bodyHtml, vars) : null;
    try {
      if (html && typeof ClipboardItem !== "undefined") await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([htmlToText(html)], { type: "text/plain" }) })]);
      else await navigator.clipboard.writeText(html ? htmlToText(html) : renderTemplate(tpl.body, vars));
      setUsed(new Set(used).add("email"));
      toast("ok", html ? "E-mail formatado copiado. Cole no corpo da mensagem (Ctrl+V)." : "Texto copiado.");
    } catch { toast("warn", "Não consegui copiar. Tente de novo."); }
  };
  const resetNow = () => run(async () => {
    const r = await resetLeadAction(lead.id);
    if (r.ok) { setUsed(new Set()); setTemperature(null); setQualification(null); setSituations(new Set()); setNote(""); setVisit(""); setVisitDate(""); setVisitLink(""); setDest("none"); setSellerId(null); setConfirmReset(false); setStep(0); router.refresh(); }
    return r;
  });
  const discardNow = () => run(async () => { const r = await discardAction(lead.id, "Descartado no atendimento"); if (r.ok) await startAction(); return r; });

  const resetDiscard = (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <span className="mr-auto text-xs font-medium uppercase tracking-wide text-muted">Este lead não serve?</span>
      {confirmReset ? (
        <span className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/50 px-3 py-1.5 text-sm">
          <span className="font-medium text-danger">Apagar tags, observação e interações? Os dados da empresa continuam.</span>
          <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={resetNow}>Sim, resetar</button>
          <button type="button" className={btnGhost} onClick={() => setConfirmReset(false)}>Cancelar</button>
        </span>
      ) : <button type="button" disabled={pending} className={btnGhost} onClick={() => { setConfirmReset(true); setConfirmDiscard(false); }}><RotateCcw size={16} aria-hidden /> Resetar lead</button>}
      {confirmDiscard ? (
        <span className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/50 px-3 py-1.5 text-sm">
          <span className="font-medium text-danger">Descartar este lead? Ele sai do sorteio.</span>
          <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={discardNow}>Sim, descartar</button>
          <button type="button" className={btnGhost} onClick={() => setConfirmDiscard(false)}>Cancelar</button>
        </span>
      ) : <button type="button" disabled={pending} className={`${btnGhost} text-danger`} onClick={() => { setConfirmDiscard(true); setConfirmReset(false); }}><X size={16} aria-hidden /> Descartar lead</button>}
    </div>
  );

  return (
    <div className="space-y-5">
      <ConfirmDialog open={priorOpen} tone="warn" icon={History} busy={pending} title="Este lead já foi atendido" confirmLabel="Buscar outro lead" cancelLabel="Atender mesmo assim"
        onCancel={() => setPriorAck(lead.id)} onConfirm={seek}>
        {previous && (
          <div className="space-y-3">
            <p><b className="text-ink">{previous.by}</b> atendeu <b className="text-ink">{lead.company}</b> em <b className="text-ink">{fmtDateTime(previous.at)}</b>{previous.channels.length ? <> por <b className="text-ink">{previous.channels.map((k) => groups.meio?.tags.find((t) => t.key === k)?.label ?? k).join(", ")}</b></> : null}.</p>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide">Resultado</p>
              {lead.tags.filter((t) => ["temperatura", "qualificacao", "situacao", "agenda"].includes(t.groupKey)).length
                ? <div className="flex flex-wrap gap-1.5">{lead.tags.filter((t) => ["temperatura", "qualificacao", "situacao", "agenda"].includes(t.groupKey)).map((t) => <TagChip key={t.id} label={t.label} color={t.color} />)}</div>
                : <p>Nenhuma tag de resultado foi marcada.</p>}
              {previous.note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-sunk px-3 py-2 text-ink">{previous.note}</p>}
            </div>
            <p>Quer atender mesmo assim ou procurar um novo lead? Se buscar outro, este some só para você por 24 h e não conta na meta.</p>
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={inactive} tone="warn" icon={TriangleAlert} busy={pending} title={`Situação cadastral: ${status}`} confirmLabel="Buscar outro lead" cancelLabel="Atender mesmo assim"
        onCancel={() => setStatusAck(lead.id)} onConfirm={() => run(async () => { const r = await skipAction(lead.id); if (r.ok) await startAction(); return r; })}>
        <b className="text-ink">{lead.company}</b> não está com a situação ATIVA na Receita, então provavelmente não consegue negociar. Quer atender mesmo assim ou procurar um novo lead? Se buscar outro, este some só para você por 24 h e não conta na meta.
      </ConfirmDialog>
      {/* topo: empresa, metas do dia e passos */}
      <header className={`${panelCls} relative overflow-hidden p-5 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent"><Building2 size={14} aria-hidden /> Lead sorteado</p>
            <h1 className="display mt-1 text-2xl sm:text-3xl">{lead.tradeName ?? lead.company}</h1>
            <p className="mt-1 text-sm text-muted">{fmtCnpj(lead.cnpj)}{lead.city ? ` · ${lead.city}/${lead.uf}` : ""}{lead.isTest ? " · MODO TESTE" : ""}</p>
          </div>
          <div className="grid w-full max-w-sm gap-3 sm:w-72">
            {goals.attended.on && <GoalBar label="Atendidos hoje" value={doneToday} qty={goals.attended.qty} />}
            {goals.scheduled.on && <GoalBar label="Agendados hoje" value={scheduledToday} qty={goals.scheduled.qty} alt />}
          </div>
        </div>
        <ol className="relative mt-5 flex items-center" aria-label="Passos do atendimento">
          {visible.map((i, pos) => { const st = STEPS[i]; return (
            <li key={st} className={`flex items-center ${pos < visible.length - 1 ? "flex-1" : ""}`}>
              <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className="group flex flex-col items-center gap-1">
                <span className={`grid size-9 place-items-center rounded-full text-sm font-bold transition-all ${i === step ? "scale-110 bg-grad text-on-accent shadow-lg shadow-accent/30" : i < step ? "bg-accent/20 text-accent" : "bg-sunk text-muted group-hover:bg-line"}`}>{i < step ? <Check size={16} aria-hidden /> : pos + 1}</span>
                <span className={`text-xs font-medium ${i === step ? "text-ink" : "text-muted"}`}>{st}</span>
              </button>
              {pos < visible.length - 1 && <span aria-hidden className="relative mx-1 mb-5 h-1 flex-1 overflow-hidden rounded-full bg-line"><span className="absolute inset-y-0 left-0 rounded-full bg-grad transition-[width] duration-500 ease-out" style={{ width: i < step ? "100%" : "0%" }} /></span>}
            </li>
          ); })}
        </ol>
      </header>

      <div key={step} className={`${panelCls} p-5 sm:p-6 ${dir.current === "fwd" ? "step-fwd" : "step-back"}`}>
        {step === 0 && (
          <div className="space-y-6">
            <LeadInfoPanel lead={lead} wide showMap={showMap} />
            <div className="grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
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
            <section className="space-y-2">
              <h2 className="display text-xl">Tags do lead</h2>
              {lead.tags.length ? <div className="flex flex-wrap gap-1.5">{lead.tags.map((t) => <TagChip key={t.id} label={t.label} color={t.color} />)}</div> : <p className="text-sm text-muted">Nenhuma tag ainda.</p>}
            </section>
            </div>
            {resetDiscard}
          </div>
        )}

        {step > 0 && (
          <div className="mb-5 grid gap-x-6 gap-y-3 rounded-xl bg-sunk p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Empresa"><b>{lead.tradeName ?? lead.company}</b></Info>
            <Info label="CNPJ"><CopyVal text={lead.cnpj}>{fmtCnpj(lead.cnpj)}</CopyVal></Info>
            <Info label="Situação">{lead.registrationStatus ? <b className={lead.registrationStatus.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{lead.registrationStatus.toUpperCase()}</b> : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Cidade">{lead.city ? (`${lead.city}/${lead.uf}`) : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Sócios" wide>{lead.info?.partners.length ? <ul className="space-y-0.5">{lead.info.partners.map((p, i) => <li key={i}><b>{p.name}</b>{cleanRole(p.role) ? <span className="text-muted"> · {cleanRole(p.role)}</span> : null}</li>)}</ul> : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Atividade" wide>{lead.info?.activity ? (`${lead.info.cnae ? `${lead.info.cnae} - ` : ""}${lead.info.activity}`) : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Representante">{lead.rep ? (`${lead.rep.repName ?? "—"} · ${lead.rep.km} km`) : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Contato principal">{goodPhones[0] ? <CopyVal text={goodPhones[0].value}>{fmtPhone(goodPhones[0].value)}</CopyVal> : goodEmails[0] ? <CopyVal>{goodEmails[0].value}</CopyVal> : <span className="text-warn">Sem contato</span>}</Info>
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
                {tpl && (
                  <div className="rounded-xl border border-line bg-white p-4 text-sm text-neutral-900">
                    <p className="flex items-center gap-1.5 border-b border-neutral-200 pb-2 font-semibold"><FileText size={14} aria-hidden /> {renderTemplate(tpl.subject, vars)}</p>
                    {tpl.bodyHtml
                      ? <div className="mt-3 leading-relaxed [&_a]:text-blue-700 [&_a]:underline [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: renderHtml(tpl.bodyHtml, vars) }} />
                      : <p className="mt-3 whitespace-pre-wrap">{renderTemplate(tpl.body, vars)}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnPrimary} onClick={copyAndOpen}><Send size={16} aria-hidden /> Copiar e abrir e-mail</button>
                  <button type="button" className={btnGhost} onClick={copyFormatted}><Copy size={16} aria-hidden /> Só copiar</button>
                  {mail && <a href={mail} onClick={() => setUsed(new Set(used).add("email"))} className={btnGhost}><ExternalLink size={16} aria-hidden /> Abrir com texto simples</a>}
                </div>
                <p className="text-xs text-muted">“Copiar e abrir e-mail” copia o corpo formatado (negrito, cores e imagens) e abre o e-mail com destinatário e assunto prontos: é só colar com Ctrl+V.</p>
              </>
            )}
            <UsedToggle on={used.has("email")} onClick={() => toggle(used, "email", setUsed)} label="Email Enviado" />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <h2 className="display text-xl">WhatsApp</h2>
            <ul className="space-y-1.5">
              {goodPhones.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-sunk px-3 py-2">
                  <span className="flex-1"><CopyVal text={p.value}><span className="figure text-lg">{fmtPhone(p.value)}</span></CopyVal></span>
                  <a href={chatproUrl(p.value)} target="_blank" rel="noreferrer" onClick={() => setUsed(new Set(used).add("whatsapp"))} className={btnPrimary}><MessageCircle size={16} aria-hidden /> Abrir no ChatPro</a>
                </li>
              ))}
              {goodPhones.length === 0 && <li className="text-sm text-muted">Sem telefone válido.</li>}
            </ul>
            <UsedToggle on={used.has("whatsapp")} onClick={() => toggle(used, "whatsapp", setUsed)} label="WhatsApp Enviado" />
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
            <UsedToggle on={used.has("ligacao")} onClick={() => toggle(used, "ligacao", setUsed)} label="Ligação feita" />
          </section>
        )}

        {step === 4 && (
          <section className="space-y-5">
            <h2 className="display text-xl">Finalizar</h2>
            <Group title={groups.meio?.name ?? "Meios de contato usados"}>{groups.meio?.tags.filter((t) => !t.autoOnly).map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={used.has(t.key)} onClick={() => toggle(used, t.key, setUsed)} />)}</Group>
            <Group title={groups.temperatura?.name ?? "Temperatura"}>{groups.temperatura?.tags.map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={temperature === t.key} onClick={() => setTemperature(temperature === t.key ? null : t.key)} />)}</Group>
            <Group title={groups.qualificacao?.name ?? "Qualificação"}>{groups.qualificacao?.tags.map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={qualification === t.key} onClick={() => setQualification(qualification === t.key ? null : (t.key as "qualificado"))} />)}</Group>
            <Group title={groups.situacao?.name ?? "Situação"}>{groups.situacao?.tags.filter((t) => !t.autoOnly).map((t) => <TagChip key={t.key} small={false} label={t.label} color={t.color} on={situations.has(t.key)} onClick={() => toggle(situations, t.key, setSituations)} />)}</Group>
            <div className="space-y-3">
              <p className="text-sm font-medium">Encaminhar este lead</p>
              <div role="radiogroup" aria-label="Encaminhar lead" className="grid gap-2 sm:grid-cols-3">
                {([["none", "Sem encaminhamento", "Só registrar o atendimento"], ["sellers", "Vendedores", "Negociação imediata: o vendedor liga e fecha"], ["reps", "Representante", "Agenda uma visita (leva dias para confirmar)"]] as const).map(([k, t, d]) => (
                  <button key={k} type="button" role="radio" aria-checked={dest === k} onClick={() => setDest(k)} className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${dest === k ? "border-accent bg-accent/10" : "border-line hover:bg-sunk"}`}>
                    <span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted">{d}</span>
                  </button>
                ))}
              </div>
              {dest === "sellers" && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block min-w-60 text-sm"><span className="mb-1 block text-muted">Quem vai atender</span>
                    <select className={inputCls} value={sellerId ?? ""} onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Grupo dos vendedores (o primeiro a assumir)</option>
                      {sellers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select></label>
                  <p className="min-w-60 flex-1 text-xs text-muted">Qualifica o lead, cria a negociação na hora e avisa os vendedores. A observação abaixo vai junto para eles.</p>
                </div>
              )}
              {dest === "reps" && (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block w-48 text-sm"><span className="mb-1 block text-muted">Código da visita</span><input className={inputCls} placeholder="V-12345" value={visit} onChange={(e) => setVisit(e.target.value)} /></label>
                  <div className="block w-48 text-sm"><span className="mb-1 block text-muted">Data da visita</span><DateInput label="Data da visita" value={visitDate} onChange={setVisitDate} /></div>
                  <label className="block min-w-60 flex-1 text-sm"><span className="mb-1 block text-muted">Link da visita (Salesforce, opcional)</span><input className={inputCls} placeholder="https://…" value={visitLink} onChange={(e) => setVisitLink(e.target.value)} /></label>
                  <p className="w-full text-xs text-muted">Agendar visita qualifica o lead automaticamente e guarda o representante mais próximo e a distância.</p>
                </div>
              )}
            </div>
            <label className="block text-sm">Observação<textarea className={`${inputCls} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line pt-5">
              <button type="button" disabled={pending} className={btnPrimary} onClick={save}><Check size={17} aria-hidden /> SALVAR E PRÓXIMO</button>
              <button type="button" disabled={pending} className={btnGhost} onClick={saveAndStop} title="Salva, libera o lead e volta ao botão Shuffler"><Pause size={16} aria-hidden /> SALVAR E PARAR</button>
              {confirmDiscard ? (
                <span className="flex flex-wrap items-center gap-2 rounded-lg border border-danger/50 px-3 py-1.5 text-sm">
                  <span className="font-medium text-danger">Descartar este lead? Ele sai do sorteio.</span>
                  <button type="button" disabled={pending} className={`${btnGhost} !border-danger !bg-danger !text-white`} onClick={discardNow}>Sim, descartar</button>
                  <button type="button" className={btnGhost} onClick={() => setConfirmDiscard(false)}>Cancelar</button>
                </span>
              ) : <button type="button" disabled={pending} className={`${btnGhost} text-danger`} onClick={() => setConfirmDiscard(true)}><X size={16} aria-hidden /> DESCARTAR LEAD</button>}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnGhost} disabled={step === 0} onClick={() => go(prevStep(step))}><ChevronLeft size={16} aria-hidden /> Voltar</button>
        {step < STEPS.length - 1 && <button type="button" className={btnPrimary} onClick={() => go(nextStep(step))}>Avançar <ChevronRight size={16} aria-hidden /></button>}
        <span className="flex-1" />
        <button type="button" className={btnGhost} disabled={pending} title="Esconde este lead só de você por 24 h e não conta na meta" onClick={() => run(async () => { const r = await skipAction(lead.id); if (r.ok) await startAction(); return r; })}><SkipForward size={16} aria-hidden /> Pular</button>
        <button type="button" className={`${btnPrimary} !bg-grad-danger !text-white`} disabled={pending} onClick={() => run(() => releaseAction(lead.id))}><Square size={15} aria-hidden /> Parar atendimento</button>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-sm font-medium">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}
function UsedToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <label className="mt-6 flex w-fit cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-sunk px-3.5 py-2.5 text-sm font-medium">
      <input type="checkbox" checked={on} onChange={onClick} className="size-5 cursor-pointer" />
      {label}
    </label>
  );
}

function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><p className="text-xs text-muted">{label}</p><div className="mt-0.5">{children}</div></div>;
}
