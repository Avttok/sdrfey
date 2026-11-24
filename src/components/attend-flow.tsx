"use client";

import { callNumber } from "@/components/call-number";
import { flushTouches, pendingTouches, trackTouch, useTouchScope, type TouchDone } from "@/lib/touch-bus";
import { Timer, UserRound, Flag, Ban, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, Mail, MessageCircle, Pause, Phone, Send, Plus, RotateCcw, History, SkipForward, ScrollText, Square, TriangleAlert, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ConfirmDialog, useConfirm } from "@/components/confirm-dialog";
import { DateInput } from "@/components/date-input";
import { GoalBar } from "@/components/goal-bar";
import { CopyVal } from "@/components/copy-val";
import { useVocall } from "@/components/vocall-provider";
import { ProductHints } from "@/components/product-hints";
import type { Reco } from "@/modules/recommendations/data";
import { LeadKnowledge, ReviewToggle, useLeadFacts } from "@/components/lead-facts";
import type { Knowledge } from "@/modules/facts/queries";
import { ScriptPicker } from "@/components/script-picker";
import { RunTasks } from "@/components/run-tasks";
import { saveScriptRunAction } from "@/modules/scripts/runs";
import type { ScriptRun } from "@/components/script-player";
import { TalkingTo } from "@/components/talking-to";
import { LiveContacts } from "@/components/live-contacts";
import { renamePersonAction, type CapturedChannel, type CapturedPerson } from "@/modules/leads/capture";
import { guessSegment, type ScriptDoc, type ScriptGoal } from "@/config/scripts";
import { LeadInfoPanel } from "@/components/lead-info-panel";
import { TagChip } from "@/components/tag-chip";
import { DestPicker, FinalActions, FlashTag, SellerQueue, TagDeck, VisitFields } from "@/components/attend-final";
import { useBusyWhile, useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { chatproUrl, cleanRole, fmtCnpj, fmtDate, fmtDateTime, fmtMoney, fmtPhone } from "@/lib/format";
import { finishSalesShuffleAction, saveSalesShuffleAction, startSalesShuffleAction } from "@/modules/sales/actions";
import { addChannelAction, discardAction, heartbeatAction, markWrongAction, releaseAction, removeChannelAction, resetLeadAction, saveAction, skipAction, startAction, startedAction } from "@/modules/leads/actions";
import { htmlToText, mailtoLink, renderHtml, renderTemplate } from "@/modules/email/render";
import type { LeadView, TagCatalog } from "@/modules/leads/view";
import type { Goals } from "@/modules/settings/goals";

export type PreviousAttendance = { by: string; at: string; channels: string[]; note: string | null };
type Template = { id: number; name: string; subject: string; body: string; bodyHtml: string | null };
const STEPS = ["Perfil", "E-mail", "WhatsApp", "Ligação", "Finalizar"] as const;
const STEP_ICON = [UserRound, Mail, MessageCircle, Phone, Flag] as const;
const STEP_HINT = ["Conheça a empresa e confira os contatos", "Envie o e-mail com o modelo certo", "Chame no WhatsApp com um toque", "Copie o número e ligue", "Registre o resultado e siga em frente"] as const;

/** Título de cada etapa: ícone, nome e uma linha de ajuda. */
function StepTitle({ i }: { i: number }) {
  const I = STEP_ICON[i];
  return (
    <div className="step-title flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grad text-on-accent shadow-md shadow-accent/25"><I size={20} aria-hidden /></span>
      <div className="min-w-0 flex-1"><h2 className="display text-xl leading-tight">{STEPS[i]}</h2><p className="text-xs text-muted">{STEP_HINT[i]}</p></div>
      <span className="figure shrink-0 rounded-full bg-accent/12 px-3 py-1 text-xs font-bold text-accent">Etapa {i + 1} de {STEPS.length}</span>
    </div>
  );
}

/** Quanto tempo já se passou neste lead. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <span className="figure">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

export const copy = async (text: string, toast: ReturnType<typeof useToast>) => {
  try {
    await navigator.clipboard.writeText(text);
    toast("info", `Copiado: ${text}`);
  } catch {
    toast("warn", "Não consegui copiar. Selecione e copie manualmente.");
  }
};

/** Leads que a pessoa deixou de propósito (Parar/Pular/Descartar). Fica fora do componente porque a tela pode remontar durante o redirecionamento. */
const LEFT = new Set<number>();

export function AttendFlow({ knowledge, autoEnrichOn = false, lead, catalog, templates, myName, showMap, previous, doneToday, scheduledToday, goals, sellers, sales, queue, scripts: scriptsIn = [], roteiroOff = false, recos = [], scriptGoal }: { roteiroOff?: boolean; /** Dados já guardados do lead, o catálogo de campos e as outras unidades. */ knowledge: Knowledge; /** Categoria do roteiro que combina com a situação do lead. */ scriptGoal?: ScriptGoal; /** Produtos para oferecer, por tipo de cliente. */ recos?: Reco[]; /** Scripts de ligação que a pessoa pode usar (do time e dela). */ scripts?: ScriptDoc[]; /** Fila de distribuição aos vendedores: ligada? e quem é o próximo. */ queue?: { on: boolean; nextId: number | null }; /** Consulta automática de CNPJ ligada pelo Adm: o shuffler não consulta sozinho. */ autoEnrichOn?: boolean; /** Modo vendedor (lead inativo): mesmo fluxo, destinos diferentes no fim. */ sales?: { shuffleId: number }; sellers: { id: number; name: string }[]; lead: LeadView; catalog: TagCatalog; templates: Template[]; myName: string; showMap: boolean; previous: PreviousAttendance | null; doneToday: number; scheduledToday: number; goals: Goals }) {
  const scripts = roteiroOff ? [] : scriptsIn;
  const toast = useToast();
  const vocall = useVocall();
  const [pending, start] = useTransition();
  const openedAt = useRef(Date.now());
  useBusyWhile(pending);
  const { ask, dialog } = useConfirm(pending);
  const [step, setStep] = useState(0);
    const [used, setUsed] = useState<Set<string>>(new Set());
  const [temperature, setTemperature] = useState<string | null>(lead.tags.find((t) => t.groupKey === "temperatura")?.key ?? null);
  const [qualification, setQualification] = useState<"qualificado" | "desqualificado" | null>((lead.tags.find((t) => t.groupKey === "qualificacao")?.key as never) ?? null);
  const [situations, setSituations] = useState<Set<string>>(new Set(lead.tags.filter((t) => t.groupKey === "situacao").map((t) => t.key)));
  const [note, setNote] = useState(lead.notes ?? "");
  const [visit, setVisit] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitLink, setVisitLink] = useState("");
  const [visitPublic, setVisitPublic] = useState(false);
  const dir = useRef<"fwd" | "back">("fwd");
  /** Para onde o lead vai ao final: ninguém, vendedores (negociação imediata) ou representante (visita). */
  const [dest, setDest] = useState<"none" | "sellers" | "reps" | "visit" | "sdr">("none");
  const [sellerId, setSellerId] = useState<number | null>(null);
  const showVisit = dest === "reps" || dest === "sellers" || dest === "visit";
  const home = sales ? "/shuffler-vendas" : "/atender";
  const nextLead = () => (sales ? startSalesShuffleAction() : startAction());
  /** Sair do lead de propósito (Parar, Pular, Descartar): o batimento não pode tratar isso como inatividade. */
  /** Atendimento concluído ou deixado de propósito: apaga o que estava guardado para retomar. */
  const clearSaved = () => { try { const p = `${sales ? "v" : "s"}${lead.id}`; localStorage.removeItem(`fey:attend:${p}`); localStorage.removeItem(`fey:pick:${p}`); for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith(`fey:trail:${p}:`)) localStorage.removeItem(k); } } catch { /* sem armazenamento */ } };
  const leaving = { get current() { return LEFT.has(lead.id); } };
  const leave = async <R extends { ok: boolean }>(fn: () => Promise<R>): Promise<R> => {
    LEFT.add(lead.id);
    let r: R; try { r = await fn(); } catch (e) { clearSaved(); throw e; }
    if (!r.ok) LEFT.delete(lead.id); else clearSaved();
    return r; // se lançar (redirect do servidor ao parar), segue "saindo": a tela já está trocando
  };
  const skipThis = () => (sales ? finishSalesShuffleAction(sales.shuffleId, "skipped", "") : skipAction(lead.id));
  const releaseThis = () => (sales ? finishSalesShuffleAction(sales.shuffleId, "released", "").then(async (r) => { if (r.ok) { router.replace("/shuffler-vendas"); router.refresh(); } return r; }) : releaseAction(lead.id));
  const discardThis = () => (sales ? finishSalesShuffleAction(sales.shuffleId, "no_interest", "Descartado no atendimento") : discardAction(lead.id, "Descartado no atendimento"));
  const saveThis = (p: ReturnType<typeof payload>) => (sales ? saveSalesShuffleAction(sales.shuffleId, p as never, (dest === "visit" || dest === "sdr" ? dest : "none")) : saveAction(p as never)).then((r) => { if (r.ok) clearSaved(); return r; });
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
  const seek = () => run(() => leave(async () => { const r = await skipThis(); if (r.ok) await nextLead(); return r; }));

  /** Contatos anotados durante a ligação (já salvos no lead; entram na hora na lista, sem recarregar). */
  const [extraPeople, setExtraPeople] = useState<CapturedPerson[]>([]);
  const [extraChannels, setExtraChannels] = useState<CapturedChannel[]>([]);
  const [talkingId, setTalkingId] = useState<number | null>(null);
  /** Nome digitado em “Conversando agora com”; vazio/nulo = segue a pessoa escolhida nos telefones. */
  const [spoken, setSpoken] = useState<string | null>(null);
  const [contactSignal, setContactSignal] = useState(0);
  const [renamed, setRenamed] = useState<Record<number, string>>({});
  const allPeople = [...lead.people, ...extraPeople.filter((p) => !lead.people.some((x) => x.id === p.id))].map((p) => (renamed[p.id] ? { ...p, name: renamed[p.id] } : p));
  const allChannels = [...lead.channels, ...extraChannels.filter((c) => !lead.channels.some((x) => x.kind === c.kind && x.value === c.value))];
  const phones = allChannels.filter((c) => c.kind === "phone");
  const emails = allChannels.filter((c) => c.kind === "email");
  const goodPhones = phones.filter((p) => !p.wrong);
  const goodEmails = emails.filter((e) => !e.wrong);
  /** Etapas que fazem sentido para este lead: sem e-mail válido some "E-mail"; sem telefone válido somem "WhatsApp" e "Ligação". */
  const visible = [0, ...(goodEmails.length ? [1] : []), ...(goodPhones.length ? [2, 3] : []), 4];
  const nextStep = (from: number) => visible.find((i) => i > from) ?? from;
  const prevStep = (from: number) => [...visible].reverse().find((i) => i < from) ?? from;
  useEffect(() => { if (!visible.includes(step)) setStep(prevStep(step)); /* uma etapa pode sumir (ex.: último telefone marcado como errado) */ }, [visible.join(), step]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => Object.fromEntries(catalog.map((g) => [g.key, g])), [catalog]);

  const saving = useRef(false);
  /* batimento a cada 30 s: mantém o lead com você e mostra que está online */
  useEffect(() => {
    let last = Date.now(); // última vez que a pessoa mexeu na tela: só isso renova o prazo do lead
    const mark = () => { last = Date.now(); };
    const evs = ["pointerdown", "keydown", "input", "wheel", "touchstart"] as const;
    for (const e of evs) document.addEventListener(e, mark, { passive: true, capture: true });
    let gone = false;
    const beat = async () => {
      if (gone) return;
      const held = await heartbeatAction(lead.id, `Atendendo ${lead.company}`, Date.now() - last < 45_000).catch(() => true);
      if (held || gone || saving.current || leaving.current) return; // salvando, parando ou pulando: o lead sai de você de propósito, não é inatividade
      gone = true;
      toast("warn", "Este lead foi liberado por inatividade. Use o Shuffler para pegar outro.");
      router.replace(home); router.refresh();
    };
    void beat();
    const t = setInterval(() => void beat(), 30_000);
    const vis = () => { if (!document.hidden) void beat(); };
    document.addEventListener("visibilitychange", vis);
    return () => { gone = true; clearInterval(t); document.removeEventListener("visibilitychange", vis); for (const e of evs) document.removeEventListener(e, mark, { capture: true }); };
  }, [lead.id, lead.company]); // eslint-disable-line react-hooks/exhaustive-deps

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
  /**
   * As tags de E-mail, WhatsApp e Ligação só ligam quando TODOS os contatos do canal foram feitos e qualificados
   * (cada resposta do painel de resultado conta um contato). Ligar/desligar a tag também traz as perguntas pendentes.
   */
  const [done, setDone] = useState<Record<string, Set<string>>>({ email: new Set(), whatsapp: new Set(), ligacao: new Set() });
  const keyOf = (ch: string, v: string) => (ch === "email" ? v.trim().toLowerCase() : v.replace(/\D/g, "").slice(-8));
  const CH_OF: Record<string, "email" | "whatsapp" | "call"> = { email: "email", whatsapp: "whatsapp", ligacao: "call" };
  const targetsOf = (k: string): string[] => (k === "email" ? goodEmails.map((e) => e.value) : k === "whatsapp" ? (goodPhones.filter((p) => p.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").length === 11).length ? goodPhones.filter((p) => p.value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").length === 11) : goodPhones).map((p) => p.value) : goodPhones.map((p) => p.value));
  const missingOf = (k: string, d = done) => targetsOf(k).filter((v) => !d[k]?.has(keyOf(k, v)));
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<TouchDone>).detail;
      if (d.leadId !== lead.id) return;
      const k = d.channel === "call" ? "ligacao" : d.channel;
      setDone((cur) => {
        const next = { ...cur, [k]: new Set(cur[k]).add(keyOf(k, d.target)) };
        if (missingOf(k, next).length === 0) setUsed((u) => new Set(u).add(k));
        return next;
      });
    };
    window.addEventListener("fey:touch-done", on);
    return () => window.removeEventListener("fey:touch-done", on);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleUsed = (key: string) => {
    // sem obrigação: qualquer meio de contato pode ser marcado ou desmarcado à vontade
    toggle(used, key, setUsed);
  };
  /** Canal que cada etapa do shuffler cuida (E-mail, WhatsApp, Ligação); a de Finalizar aceita os três (tags dos meios de contato). */
  const STEP_CHANNEL: Record<number, "email" | "whatsapp" | "call" | undefined> = { 1: "email", 2: "whatsapp", 3: "call" };
  useTouchScope(lead.id, step === 4 ? ["email", "whatsapp", "call"] : []); // as perguntas "como foi?" só aparecem na última etapa, depois de dar tempo ao retorno
  const goRef = useRef<(n: number) => void>(() => {});
  const go = (n: number) => {
    if (step === 0 && n > 0) void startedAction(lead.id);
    const to = Math.min(Math.max(n, 0), STEPS.length - 1);
    dir.current = to >= step ? "fwd" : "back";
    setStep(to);
  };
  goRef.current = go;

  /** Recarregou a página no meio do atendimento: guarda no navegador o que já foi preenchido e volta de onde parou. */
  const saveKey = `fey:attend:${sales ? "v" : "s"}${lead.id}`;
  const restored = useRef(false);
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(saveKey) ?? "null") as { at: number; step: number; used: string[]; temperature: string | null; qualification: "qualificado" | "desqualificado" | null; situations: string[]; note: string; visit: string; visitDate: string; visitLink: string; visitPublic: boolean; dest: "none" | "sellers" | "reps" | "visit" | "sdr"; sellerId: number | null } | null;
      if (j && Date.now() - j.at < 12 * 3_600_000) {
        setStep(Math.min(Math.max(Number(j.step) || 0, 0), STEPS.length - 1)); setUsed(new Set(j.used ?? [])); setTemperature(j.temperature ?? null); setQualification(j.qualification ?? null);
        setSituations(new Set(j.situations ?? [])); setNote(j.note ?? ""); setVisit(j.visit ?? ""); setVisitDate(j.visitDate ?? ""); setVisitLink(j.visitLink ?? ""); setVisitPublic(!!j.visitPublic); setDest(j.dest ?? "none"); setSellerId(j.sellerId ?? null);
      }
    } catch { /* sem armazenamento */ }
    restored.current = true;
  }, [saveKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!restored.current) return;
    try { localStorage.setItem(saveKey, JSON.stringify({ at: Date.now(), step, used: [...used], temperature, qualification, situations: [...situations], note, visit, visitDate, visitLink, visitPublic, dest, sellerId })); } catch { /* sem armazenamento */ }
  }, [saveKey, step, used, temperature, qualification, situations, note, visit, visitDate, visitLink, visitPublic, dest, sellerId]);

  const tpl = templates.find((t) => t.id === tplId);
  /** Telefone em uso na ligação: se ele tem um contato indexado, o roteiro fala com essa pessoa. */
  const [callId, setCallId] = useState<number | null>(null);
  const callPhone = goodPhones.find((p) => p.id === callId) ?? null;
  const callPerson = (talkingId ? allPeople.find((x) => x.id === talkingId) : null) ?? (callPhone?.personId ? allPeople.find((x) => x.id === callPhone.personId) : null) ?? allPeople[0] ?? null;
  const talkingTo = (spoken ?? callPerson?.name ?? "").trim();
  const talkingKnownId = allPeople.find((x) => x.name.trim().toLowerCase() === talkingTo.toLowerCase())?.id ?? null;
  /** Corrige o nome de quem fala; se for contato guardado e a pessoa pediu, corrige lá também. */
  const renameSpeaker = (n: string, also: boolean) => {
    const id = talkingKnownId;
    setSpoken(n);
    if (also && id != null) void renamePersonAction(lead.id, id, n).then((r) => { if (r.ok) { setRenamed((m) => ({ ...m, [id]: n })); setSpoken(null); toast("ok", "Nome corrigido."); } else toast("bad", r.message ?? "Não foi possível corrigir."); }).catch(() => toast("bad", "Não foi possível corrigir."));
  };
  const facts = useLeadFacts({ leadId: lead.id, defs: knowledge.defs, initial: knowledge.facts, isTest: lead.isTest, personId: callPerson?.id ?? null });
  const vars = { meu_nome: myName.split(" ")[0], empresa: lead.tradeName ?? lead.company, cidade: lead.city, representante: lead.rep?.repName, contato: talkingTo.split(/\s+/)[0] || undefined };
  /** Guarda o andamento do roteiro no lead (em segundo plano, com pausa curta para não salvar a cada toque). */
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepRun = (r: ScriptRun) => {
    if (runTimer.current) clearTimeout(runTimer.current);
    runTimer.current = setTimeout(() => { void saveScriptRunAction(lead.id, { ...r, isTest: lead.isTest }, sales ? "vendas" : "sdr").catch(() => {}); }, r.finished ? 100 : 1200);
  };
  /** Respostas do roteiro que trazem anotação entram na observação, sem repetir. */
  /** Cada transferência traz uma pessoa nova: o campo esvazia para o nome dela e o de quem falou antes fica na observação. Voltar um passo devolve o nome. */
  const beforeTransfer = useRef<{ name: string; id: number | null }[]>([]);
  const onScriptStep = (nodeId: string, path: string[]) => {
    const n = path.filter((x) => x === "transferido").length; // quantas pessoas já foram passadas na linha
    const stack = beforeTransfer.current;
    if (nodeId === "transferido" && stack.length < n) {
      const prev = (spoken ?? callPerson?.name ?? "").trim();
      stack.push({ name: prev, id: talkingId });
      if (prev) addNote(`Falou antes com ${prev}`);
      setSpoken(""); setTalkingId(null);
    } else if (stack.length > n) {
      const b = stack[n]; stack.length = n;
      setSpoken(b.name || null); setTalkingId(b.id);
    }
  };
  const addNote = (t: string) => setNote((c) => (c.includes(t) ? c : `${c ? `${c.replace(/\s+$/, "")}\n` : ""}• ${t}`));
  const mail = tpl && (emailTo || goodEmails[0]?.value) ? mailtoLink(emailTo || goodEmails[0].value, renderTemplate(tpl.subject, vars), renderTemplate(tpl.body, vars)) : null;

  /** Copia o corpo formatado e abre o e-mail já com destinatário e assunto; só falta colar (Ctrl+V). */
  const copyAndOpen = async () => {
    await copyFormatted();
    const to = emailTo || goodEmails[0]?.value;
    if (to) void trackTouch({ leadId: lead.id, channel: "email", target: to, label: lead.tradeName ?? lead.company, defer: true });
    if (tpl && to) window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(renderTemplate(tpl.subject, vars))}`;
  };

  /** Antes de salvar: encaminhar exige visita preenchida (o servidor confere de novo). */
  const linkOk = /^https:\/\/\S+$/i.test(visitLink.trim());
  const visitMissing = showVisit && (!visit.trim() || !visitDate || !linkOk);
  const payload = () => ({ leadId: lead.id, channels: [...used], temperature, qualification, situations: [...situations], note, visitCode: showVisit ? visit : null, visitDate: showVisit ? visitDate : null, visitLink: showVisit ? visitLink || null : null, visitPublic: showVisit ? visitPublic : false, handoff: { to: dest, sellerId: dest === "sellers" ? sellerId : null, note: null } });
  /** Salva e sorteia o próximo lead. */
  const blocked = () => { if (!visitMissing) return false; toast("warn", "Para encaminhar o lead, preencha o código, a data e o link da visita no Salesforce (começando com https://)."); return true; };
  const save = () => blocked() || run(async () => {
    saving.current = true;
    const r = await saveThis(payload()).catch(() => ({ ok: false as const, message: "Não foi possível salvar." }));
    if (!r.ok) saving.current = false;
    if (r.ok) await nextLead();
    return r;
  });
  /** Salva, libera o lead e volta à tela do botão Shuffler (pausa: o lead não fica contando tempo). */
  const saveAndStop = () => blocked() || run(async () => {
    saving.current = true;
    const r = await saveThis(payload()).catch(() => ({ ok: false as const, message: "Não foi possível salvar." }));
    if (!r.ok) saving.current = false;
    if (r.ok) { router.replace(home); router.refresh(); }
    return r;
  });
  const copyFormatted = async () => {
    if (!tpl) return;
    const html = tpl.bodyHtml ? renderHtml(tpl.bodyHtml, vars) : null;
    try {
      if (html && typeof ClipboardItem !== "undefined") await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([htmlToText(html)], { type: "text/plain" }) })]);
      else await navigator.clipboard.writeText(html ? htmlToText(html) : renderTemplate(tpl.body, vars));
      toast("ok", html ? "E-mail formatado copiado. Cole no corpo da mensagem (Ctrl+V)." : "Texto copiado.");
    } catch { toast("warn", "Não consegui copiar. Tente de novo."); }
  };
  const resetNow = () => run(async () => {
    const r = await resetLeadAction(lead.id);
    if (r.ok) { setUsed(new Set()); setTemperature(null); setQualification(null); setSituations(new Set()); setNote(""); setVisit(""); setVisitDate(""); setVisitLink(""); setVisitPublic(false); setDest("none"); setSellerId(null); setConfirmReset(false); setStep(0); router.refresh(); }
    return r;
  });
  const discardNow = () => run(() => leave(async () => { const r = await discardThis(); if (r.ok) await nextLead(); return r; }));

  const resetDiscard = (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <span className="mr-auto text-xs font-medium uppercase tracking-wide text-muted">Este lead não serve?</span>
      <button type="button" disabled={pending} className={btnGhost} onClick={() => ask({ title: "Resetar este lead?", body: "Apaga as tags, a observação e as interações deste atendimento. Os dados da empresa continuam.", label: "Sim, resetar", icon: RotateCcw, onConfirm: resetNow })}><RotateCcw size={16} aria-hidden /> Resetar lead</button>
      <button type="button" disabled={pending} className={`${btnGhost} text-danger`} onClick={() => ask({ title: "Descartar este lead?", body: "Ele sai do sorteio e você recebe o próximo.", label: "Sim, descartar", icon: X, onConfirm: discardNow })}><X size={16} aria-hidden /> Descartar lead</button>
    </div>
  );

  return (
    <div className="spawn-in space-y-5">
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
        onCancel={() => setStatusAck(lead.id)} onConfirm={seek}>
        <b className="text-ink">{lead.company}</b> não está com a situação ATIVA na Receita, então provavelmente não consegue negociar. Quer atender mesmo assim ou procurar um novo lead? Se buscar outro, este some só para você por 24 h e não conta na meta.
      </ConfirmDialog>
      {/* topo: empresa, metas do dia e passos */}
      <header className={`${panelCls} fx-rise relative overflow-hidden p-5 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/15 blur-2xl" /><div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-accent/10 blur-3xl" />
        {step !== 4 && <div className="relative flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent"><span className="inline-flex items-center gap-1.5"><Building2 size={14} aria-hidden /> Lead sorteado</span><span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 normal-case tracking-normal" title="Tempo neste lead"><Timer size={12} aria-hidden /><Elapsed since={openedAt.current} /></span></p>
            <h1 className="display mt-1 text-2xl sm:text-3xl">{lead.tradeName ?? lead.company}</h1>
            <p className="mt-1 text-sm text-muted">{fmtCnpj(lead.cnpj)}{lead.city ? ` · ${lead.city}/${lead.uf}` : ""}{lead.isTest ? " · MODO TESTE" : ""}</p>
          </div>
          <div className="grid w-full max-w-sm gap-3 sm:w-72">
            {!sales && goals.attended.on && <GoalBar label="Atendidos hoje" value={doneToday} qty={goals.attended.qty} />}
            {!sales && goals.scheduled.on && <GoalBar label="Agendados hoje" value={scheduledToday} qty={goals.scheduled.qty} alt />}
          </div>
        </div>}
        <ol className={`relative flex items-center ${step !== 4 ? "mt-6" : ""}`} aria-label="Passos do atendimento">
          {visible.map((i, pos) => { const st = STEPS[i]; const SI = STEP_ICON[i]; const cur = i === step; const done = i < step; return (
            <li key={st} className={`flex items-center ${pos < visible.length - 1 ? "flex-1" : ""}`}>
              <button type="button" onClick={() => go(i)} aria-current={cur ? "step" : undefined} className="group flex flex-col items-center gap-1.5">
                <span className={`relative grid size-11 place-items-center rounded-2xl text-sm font-bold transition-all duration-300 ${cur ? "-translate-y-0.5 scale-110 bg-grad text-on-accent shadow-lg shadow-accent/40" : done ? "bg-accent/20 text-accent" : "bg-sunk text-muted group-hover:-translate-y-0.5 group-hover:bg-line"}`}>
                  {cur && <span aria-hidden className="step-ping absolute inset-0 rounded-2xl" />}
                  {done ? <Check size={18} aria-hidden /> : <SI size={18} aria-hidden />}
                </span>
                <span className={`text-xs font-semibold transition-colors ${cur ? "text-ink" : "text-muted"}`}>{st}</span>
              </button>
              {pos < visible.length - 1 && <span aria-hidden className="relative mx-2 mb-5 h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="absolute inset-y-0 left-0 rounded-full bg-grad transition-[width] duration-700 ease-out" style={{ width: i < step ? "100%" : "0%" }} /></span>}
            </li>
          ); })}
        </ol>
      </header>

      <div key={step} className={`${panelCls} stagger p-5 sm:p-6 ${dir.current === "fwd" ? "step-fwd" : "step-back"}`}>
        {step === 0 && (
          <div className="space-y-6">
            <LeadInfoPanel lead={lead} wide showMap={showMap} autoSearch={!autoEnrichOn} />
            <ProductHints recos={recos} />
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
                    <button type="button" aria-label="Remover" onClick={() => ask({ title: "Remover este contato?", body: `${c.kind === "phone" ? fmtPhone(c.value) : c.value} será removido do cadastro do lead.`, label: "Sim, remover", icon: Trash2, onConfirm: () => run(() => removeChannelAction(lead.id, c.id), "Contato removido.") })}><Trash2 size={15} /></button>
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

        {step > 0 && step !== 4 && step !== 3 && (
          <LeadGlance
            chips={[
              { k: "Empresa", v: <b>{lead.tradeName ?? lead.company}</b> },
              { k: "Situação", v: lead.registrationStatus ? <b className={lead.registrationStatus.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{lead.registrationStatus.toUpperCase()}</b> : <span className="text-warn">Sem informação</span> },
              { k: "Cidade", v: lead.city ? `${lead.city}/${lead.uf}` : <span className="text-warn">Sem informação</span> },
              { k: "Contato", v: goodPhones[0] ? <CopyVal text={goodPhones[0].value}>{fmtPhone(goodPhones[0].value)}</CopyVal> : goodEmails[0] ? <CopyVal>{goodEmails[0].value}</CopyVal> : <span className="text-warn">Sem contato</span> },
            ]}>
<Info label="Empresa"><b>{lead.tradeName ?? lead.company}</b></Info>
            <Info label="CNPJ"><CopyVal text={lead.cnpj}>{fmtCnpj(lead.cnpj)}</CopyVal></Info>
            <Info label="Situação">{lead.registrationStatus ? <b className={lead.registrationStatus.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{lead.registrationStatus.toUpperCase()}</b> : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Cidade">{lead.city ? (`${lead.city}/${lead.uf}`) : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Sócios" wide>{lead.info?.partners.length ? <ul className="space-y-0.5">{lead.info.partners.map((p, i) => <li key={i}><b>{p.name}</b>{cleanRole(p.role) ? <span className="text-muted"> · {cleanRole(p.role)}</span> : null}</li>)}</ul> : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Atividade" wide>{lead.info?.activity ? (`${lead.info.cnae ? `${lead.info.cnae} - ` : ""}${lead.info.activity}`) : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Representante">{lead.rep ? (`${lead.rep.repName ?? "—"} · ${lead.rep.km} km`) : <span className="text-warn">Sem informação</span>}</Info>
            <Info label="Contato principal">{goodPhones[0] ? <CopyVal text={goodPhones[0].value}>{fmtPhone(goodPhones[0].value)}</CopyVal> : goodEmails[0] ? <CopyVal>{goodEmails[0].value}</CopyVal> : <span className="text-warn">Sem contato</span>}</Info>
          </LeadGlance>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <StepTitle i={1} />
            {goodEmails.length === 0 ? <p className="text-sm text-muted">Este lead não tem e-mail válido. Adicione no passo Contatos ou pule.</p> : (
              <>
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="grid gap-3">
                  <label className="text-sm">Modelo<select className={inputCls} value={tplId} onChange={(e) => setTplId(Number(e.target.value))}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                      <label className="text-sm">Enviar para<select className={inputCls} value={emailTo} onChange={(e) => setEmailTo(e.target.value)}>{goodEmails.map((e) => <option key={e.id} value={e.value}>{e.value}</option>)}</select></label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={btnPrimary} onClick={copyAndOpen}><Send size={16} aria-hidden /> Copiar e abrir e-mail</button>
                      <button type="button" className={btnGhost} onClick={copyFormatted}><Copy size={16} aria-hidden /> Só copiar</button>
                      {mail && <a href={mail} onClick={() => { const to = emailTo || goodEmails[0]?.value; if (to) void trackTouch({ leadId: lead.id, channel: "email", target: to, label: lead.tradeName ?? lead.company, defer: true }); }} className={btnGhost}><ExternalLink size={16} aria-hidden /> Abrir com texto simples</a>}
                    </div>
                    <p className="text-xs text-muted">“Copiar e abrir e-mail” copia o corpo formatado (negrito, cores e imagens) e abre o e-mail com destinatário e assunto prontos: é só colar com Ctrl+V.</p>
                  </div>
                  {tpl && <EmailPreview subject={renderTemplate(tpl.subject, vars)} html={tpl.bodyHtml ? renderHtml(tpl.bodyHtml, vars) : null} text={renderTemplate(tpl.body, vars)} />}
                </div>
              </>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <StepTitle i={2} />
            <ul className="space-y-1.5">
              {goodPhones.map((p) => (
                <li key={p.id} className="lift flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-sunk/60 px-4 py-3"><span aria-hidden className="grid size-10 place-items-center rounded-xl bg-ok/15 text-ok"><MessageCircle size={18} /></span>
                  <span className="flex-1"><CopyVal text={p.value}><span className="figure text-lg">{fmtPhone(p.value)}</span></CopyVal>{done.whatsapp?.has(keyOf("whatsapp", p.value)) && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok"><Check size={12} aria-hidden /> registrado</span>}</span>
                  <a href={chatproUrl(p.value)} target="_blank" rel="noreferrer" onClick={() => { void trackTouch({ leadId: lead.id, channel: "whatsapp", target: p.value, label: lead.tradeName ?? lead.company, personId: p.personId ?? null, defer: true }); }} className={btnPrimary}><MessageCircle size={16} aria-hidden /> Abrir no ChatPro</a>
                </li>
              ))}
              {goodPhones.length === 0 && <li className="text-sm text-muted">Sem telefone válido.</li>}
            </ul>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <StepTitle i={3} />
            {/* Espaço de trabalho: tudo da ligação cabe numa tela, sem subir nem descer. À esquerda a ficha e os contatos; à direita o roteiro. */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start">
              <div className="order-2 space-y-3 lg:order-1">
            <ul className="grid gap-2">
              {goodPhones.map((p) => {
                const who = p.personId ? allPeople.find((x) => x.id === p.personId) : null;
                const on = callPhone?.id === p.id;
                return (
                  <li key={p.id} className={`lift flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 px-3 py-2.5 transition ${on ? "border-accent bg-accent/10" : "border-line bg-sunk/60"}`}>
                    <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-accent text-on-accent" : "bg-accent/15 text-accent"}`}><Phone size={18} /></span>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setCallId(on ? null : p.id); setSpoken(null); if (!on && p.personId) setTalkingId(p.personId); }} title="Usar este número no roteiro" aria-pressed={on}>
                      <span className="figure block text-lg leading-tight">{fmtPhone(p.value)}</span>
                      <span className="block truncate text-xs text-muted">{who ? <><UserRound size={11} aria-hidden className="mr-0.5 inline" />{who.name}{who.roleTitle ? ` · ${who.roleTitle}` : ""}</> : "Sem contato indexado"}</span>
                    </button>
                    <button type="button" disabled={vocall.configured && vocall.ready === false} className={`${btnPrimary} disabled:opacity-50`} onClick={() => { setCallId(p.id); void callNumber(p.value, lead.tradeName ?? lead.company, toast, vocall, lead, p.personId ?? null); }}><Phone size={15} aria-hidden /> Ligar</button>
                    <button type="button" className={btnGhost} aria-label="Copiar número" onClick={() => { void copy(p.value, toast); void trackTouch({ leadId: lead.id, channel: "call", target: p.value, label: lead.tradeName ?? lead.company, personId: p.personId ?? null, defer: true }); }}><Copy size={15} aria-hidden /> Copiar</button>
                  </li>
                );
              })}
              {goodPhones.length === 0 && <li className="text-sm text-muted">Sem telefone válido.</li>}
            </ul>
                <div className="grid gap-x-5 gap-y-2 rounded-2xl bg-sunk p-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
                  <Info label="Empresa"><b>{lead.tradeName ?? lead.company}</b>{lead.tradeName && lead.company !== lead.tradeName && <span className="block truncate text-[11px] text-muted">{lead.company}</span>}</Info>
                  <Info label="CNPJ"><CopyVal text={lead.cnpj}>{fmtCnpj(lead.cnpj)}</CopyVal></Info>
                  <Info label="Cidade">{lead.city ? `${lead.city}/${lead.uf}` : <span className="text-warn">Sem informação</span>}</Info>
                  <Info label="Situação">{lead.registrationStatus ? <b className={lead.registrationStatus.toUpperCase() === "ATIVA" ? "text-ok" : "text-danger"}>{lead.registrationStatus.toUpperCase()}</b> : <span className="text-warn">Sem informação</span>}</Info>
                  <Info label="Sócios" wide>{lead.info?.partners.length ? <ul className="flex flex-wrap gap-x-3 gap-y-0.5">{lead.info.partners.map((q, i) => <li key={i}><b>{q.name}</b>{cleanRole(q.role) ? <span className="text-muted"> · {cleanRole(q.role)}</span> : null}</li>)}</ul> : <span className="text-warn">Sem informação</span>}</Info>
                  <Info label="Atividade" wide>{lead.info?.activity ? `${lead.info.cnae ? `${lead.info.cnae} - ` : ""}${lead.info.activity}` : <span className="text-warn">Sem informação</span>}</Info>
                </div>
                <LiveContacts onNote={addNote} openSignal={contactSignal} leadId={lead.id} people={allPeople} channels={allChannels} talkingId={callPerson?.id ?? null} onTalking={(id) => { setTalkingId(id); setSpoken(null); }} onSaved={(p, ch) => { setExtraPeople((l) => [...l.filter((x) => x.id !== p.id), p]); setExtraChannels((l) => [...l, ...ch]); }} />
                <ProductHints recos={recos} />
              </div>
              <div className="order-1 space-y-3 lg:order-2">
                <p className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-accent"><ScrollText size={14} aria-hidden /> Roteiro da ligação <span className="font-normal normal-case tracking-normal text-muted">· leia a fala, escute e toque no que o lead respondeu</span></p>
                <div className="space-y-3">
                {scripts.length > 0
                  ? <ScriptPicker persistKey={`${sales ? "v" : "s"}${lead.id}`} hideNoteBox key={lead.id} area={sales ? "vendas" : "sdr"} onRename={renameSpeaker} savedPerson={talkingKnownId != null} facts={facts} scripts={scripts} goal={scriptGoal ?? (sales ? "vendas" : "sdr")} segmentHint={guessSegment(lead.tradeName, lead.company, lead.info?.activity)} extra={(nid, pick) => (nid === "abertura" || nid === "nome" || nid === "transferido") ? (
                  <TalkingTo value={spoken ?? callPerson?.name ?? ""} people={allPeople} knownId={allPeople.find((x) => x.name.trim().toLowerCase() === talkingTo.toLowerCase())?.id ?? null} leadId={lead.id}
                  onChange={(v) => { setSpoken(v); const m = allPeople.find((x) => x.name.trim().toLowerCase() === v.trim().toLowerCase()); if (m) setTalkingId(m.id); }}
                  onEnter={() => pick(0)} onSaved={(p) => { setExtraPeople((l) => [...l.filter((x) => x.id !== p.id), p]); setTalkingId(p.id); setSpoken(null); }} />
                ) : null} vars={{ empresa: vars.empresa, contato: vars.contato, contatoCompleto: talkingTo || null, cidade: vars.cidade, meunome: vars.meu_nome }} onNote={addNote} onRun={keepRun} onStep={onScriptStep} endExtra={lead.isTest ? undefined : ({ runId }) => <RunTasks runId={runId} area={sales ? "vendas" : "sdr"} />} />
                  : <p className="text-sm text-muted">{roteiroOff ? "O roteiro está desligado para você (o Adm pode ligar em Ligações ou Permissões)." : "Ainda não há roteiros. O Adm pode criar em Scripts."}</p>}
                <div className="flex flex-wrap items-center gap-2"><ReviewToggle facts={facts} /></div>
                <LeadKnowledge facts={facts} units={knowledge.units} goalIsSales={!!sales} />
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-6">
            <StepTitle i={4} />
            {([
              ["meio", "Meios de contato usados", "marque todos que usou", used.size, Phone, (g: TagCatalog[number]) => g.tags.filter((t) => !t.autoOnly).map((t) => <FlashTag key={t.key} label={t.label} color={t.color} on={used.has(t.key)} onClick={() => toggleUsed(t.key)} />)],
              ["temperatura", "Temperatura do lead", "escolha 1", temperature ? 1 : 0, Flag, (g: TagCatalog[number]) => g.tags.map((t) => <FlashTag key={t.key} label={t.label} color={t.color} on={temperature === t.key} onClick={() => setTemperature(temperature === t.key ? null : t.key)} />)],
              ["qualificacao", "Qualificação", "escolha 1", qualification ? 1 : 0, Check, (g: TagCatalog[number]) => g.tags.map((t) => <FlashTag key={t.key} label={t.label} color={t.color} on={qualification === t.key} onClick={() => setQualification(qualification === t.key ? null : (t.key as "qualificado"))} />)],
              ["situacao", "Situação", "marque o que se aplica", situations.size, TriangleAlert, (g: TagCatalog[number]) => g.tags.filter((t) => !t.autoOnly).map((t) => <FlashTag key={t.key} label={t.label} color={t.color} on={situations.has(t.key)} onClick={() => toggle(situations, t.key, setSituations)} />)],
            ] as const).map(([k, title, hint, n, GI, render]) => {
              const g = groups[k];
              if (!g) return null;
              const cards = render(g);
              return <TagDeck key={k} title={g.name ?? title} hint={hint} icon={GI} count={n} total={cards.length}>{cards}</TagDeck>;
            })}
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><Send size={16} aria-hidden className="text-accent" /> {sales ? "O que fazer com este lead?" : "Encaminhar este lead"}</p>
              <DestPicker value={dest} onChange={setDest} options={sales
                ? ([["none", "Só salvar", "Registra o que você fez e segue sem encaminhar"], ["visit", "Agendar visita e levar ao meu painel", "A negociação abre no seu painel Novo; exige visita marcada"], ["sdr", "Devolver à fila dos SDR", "Volta a ser prospecção e entra no Shuffler dos SDR"]] as const)
                : ([["none", "Sem encaminhamento", "Só registrar o atendimento"], ["sellers", "Vendedores SDR", "Negociação imediata; o vendedor entra na visita pelo Salesforce e confirma"], ["reps", "Representante", "Agenda uma visita (leva dias para confirmar)"]] as const)} />
              {!sales && dest === "sellers" && <SellerQueue sellers={sellers} nextId={queue?.nextId ?? null} queueOn={!!queue?.on} value={sellerId} onChange={setSellerId} />}
              {showVisit && <VisitFields code={visit} setCode={setVisit} date={visitDate} dateInput={<DateInput label="Data da visita" value={visitDate} onChange={setVisitDate} />} link={visitLink} setLink={setVisitLink} isPublic={visitPublic} setPublic={setVisitPublic} />}
              {showVisit && !sales && <p className="text-xs text-muted">{dest === "sellers" ? "Obrigatório: o lead só vai para os vendedores com a visita registrada (código, data e link do Salesforce)." : "Obrigatório: o lead só vai para o representante com a visita registrada (código, data e link). Agendar qualifica o lead e guarda o representante mais próximo e a distância."}</p>}
            </div>
            <label className="block text-sm font-medium">Observação<textarea className={`${inputCls} mt-1 min-h-24 font-normal`} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <FinalActions pending={pending} onSave={save} onStop={saveAndStop} onDiscard={() => ask({ title: "Descartar este lead?", body: "Ele sai do sorteio e você recebe o próximo.", label: "Sim, descartar", icon: X, onConfirm: discardNow })} />
          </section>
        )}
      </div>

      <div className="sticky bottom-3 z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel/90 p-3 shadow-lg backdrop-blur lg:mx-[4.75rem]">
        <button type="button" className={`${btnPrimary} !bg-grad-danger !text-white`} disabled={pending} onClick={() => run(() => leave(releaseThis))}><Square size={15} aria-hidden /> Parar</button>
        <button type="button" className={btnGhost} disabled={pending} title="Esconde este lead só de você por 24 h e não conta na meta" onClick={() => ask({ title: "Pular este lead?", body: "Ele fica escondido só de você por 24 h e não conta na meta. Você recebe o próximo.", label: "Sim, pular", tone: "warn", icon: SkipForward, onConfirm: seek })}><SkipForward size={16} aria-hidden /> Pular lead</button>
        <span className="flex-1" />
        {step > 0 && <button type="button" className={btnGhost} onClick={() => go(prevStep(step))}><ChevronLeft size={16} aria-hidden /> Voltar</button>}
        {step < STEPS.length - 1 && <button type="button" className={btnPrimary} onClick={() => go(nextStep(step))}>Avançar <ChevronRight size={16} aria-hidden /></button>}
      </div>
      {dialog}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-sm font-medium">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>;
}
function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><p className="text-xs text-muted">{label}</p><div className="mt-0.5">{children}</div></div>;
}


/** Prévia do e-mail: mostra só um pedaço e deixa expandir/minimizar com animação. */
const MAIL_COLLAPSED = 200;
function EmailPreview({ subject, html, text }: { subject: string; html: string | null; text: string }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = inner.current; if (!el) return;
    const m = () => setFull(el.scrollHeight);
    m();
    const ro = new ResizeObserver(m); ro.observe(el);
    return () => ro.disconnect();
  }, [html, text]);
  useEffect(() => setOpen(false), [subject]);
  const big = full > MAIL_COLLAPSED + 40;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white text-sm text-neutral-900 shadow-sm">
      <p className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 font-semibold"><FileText size={14} aria-hidden /> <span className="min-w-0 truncate">{subject}</span></p>
      <div className="relative">
        <div className="overflow-hidden transition-[max-height] duration-500 ease-out" style={{ maxHeight: big ? (open ? full : MAIL_COLLAPSED) : undefined }}>
          <div ref={inner} className="p-4">
            {html
              ? <div className="leading-relaxed [&_a]:text-blue-700 [&_a]:underline [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: html }} />
              : <p className="whitespace-pre-wrap leading-relaxed">{text}</p>}
          </div>
        </div>
        {big && <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent transition-opacity duration-300 ${open ? "opacity-0" : "opacity-100"}`} />}
      </div>
      {big && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-center gap-1.5 border-t border-neutral-200 bg-neutral-50 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100">
          <ChevronDown size={14} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden /> {open ? "Minimizar e-mail" : "Expandir e-mail completo"}
        </button>
      )}
    </div>
  );
}

/** Resumo do lead nas etapas: o essencial em bolhas e, se quiser, o cadastro completo (abre e fecha com animação). */
function LeadGlance({ chips, children }: { chips: { k: string; v: React.ReactNode }[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-sunk/60">
      <div className="flex flex-wrap items-center gap-2 p-3">
        {chips.map((c) => <span key={c.k} className="inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-sm shadow-sm ring-1 ring-line"><span className="text-xs text-muted">{c.k}</span>{c.v}</span>)}
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-accent hover:bg-accent/10">
          {open ? "Ver menos" : "Ver tudo"} <ChevronDown size={13} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden"><div className="grid gap-x-6 gap-y-3 border-t border-line p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">{children}</div></div>
      </div>
    </div>
  );
}
