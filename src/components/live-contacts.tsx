"use client";

import { AtSign, Check, NotebookPen, Phone, Plus, UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ObservationForm } from "@/components/script-extras";
import { fmtPhone } from "@/lib/format";
import { captureContactAction, type CapturedChannel, type CapturedPerson } from "@/modules/leads/capture";

type Person = { id: number; name: string; roleTitle: string | null };
type Channel = { id: number; personId: number | null; kind: "phone" | "email"; value: string; wrong: boolean };

const CARGOS = ["Dono(a) / sócio(a)", "Comprador(a)", "Gerente", "Compras", "Financeiro", "Almoxarifado", "Recepção", "Mecânico(a)"];

/**
 * Contatos "ao vivo": enquanto a ligação acontece o operador anota nome, cargo, e-mail e telefones de quem aparece.
 * Tudo é salvo no lead na hora (some nada se a ligação cair) e a pessoa passa a ser quem o roteiro chama pelo nome.
 */
export function LiveContacts({ onNote, leadId, people, channels, talkingId, onTalking, onSaved, openSignal }: { /** Anota uma observação livre no lead (aparece como botão ao lado de Anotar contato). */ onNote?: (text: string) => void; /** Muda quando alguém pede para abrir o formulário (botão ao lado do roteiro). */ openSignal?: number; leadId: number; people: Person[]; channels: Channel[]; talkingId: number | null; onTalking: (id: number | null) => void; onSaved: (p: CapturedPerson, ch: CapturedChannel[]) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const box = useRef<HTMLElement>(null);
  useEffect(() => { if (!openSignal) return; setOpen(true); box.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [openSignal]);
  const [target, setTarget] = useState<number | "new">("new");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phones, setPhones] = useState<string[]>([""]);

  const reset = () => { setName(""); setRole(""); setEmail(""); setPhones([""]); setTarget("new"); };
  const save = () => start(async () => {
    const r = await captureContactAction(leadId, { personId: target === "new" ? null : target, name, roleTitle: role, email, phones: phones.filter((p) => p.trim()) });
    if (!r.ok || !r.person) { toast("bad", r.message ?? "Não foi possível anotar."); return; }
    onSaved(r.person, r.channels ?? []);
    onTalking(r.person.id);
    toast("ok", `${r.person.name} anotado(a) no lead.`);
    reset(); setOpen(false);
  });
  const canSave = target === "new" ? name.trim().length > 0 : !!(email.trim() || phones.some((p) => p.trim()) || role.trim());

  return (
    <section ref={box} className="rounded-2xl border border-line bg-panel p-3" aria-label="Contatos desta ligação">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><UserRound size={16} aria-hidden /></span>
        <div className="min-w-0 flex-1 leading-snug"><h3 className="text-sm font-bold">Contatos da ligação</h3><p className="text-xs text-muted">Anote quem aparecer: nome, cargo, e-mail e telefone. Salva no lead na hora.</p></div>
      </div>
      <div className={`mt-2.5 grid gap-2 ${onNote ? "grid-cols-2" : ""}`}>
        {onNote && <button type="button" className={`${btnPrimary} w-full !px-2 whitespace-nowrap`} onClick={() => setObsOpen(!obsOpen)} aria-expanded={obsOpen}><NotebookPen size={15} aria-hidden /> Anotar observação</button>}
        <button type="button" className={`${open ? btnGhost : btnPrimary} w-full !px-2 whitespace-nowrap`} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? <><X size={15} aria-hidden /> Fechar</> : <><UserPlus size={15} aria-hidden /> Anotar contato</>}</button>
      </div>
      {onNote && obsOpen && <div className="mt-3"><ObservationForm onAdd={(t) => { onNote(t); toast("ok", "Observação anotada."); }} onClose={() => setObsOpen(false)} /></div>}

      {people.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {people.map((p) => {
            const mine = channels.filter((c) => c.personId === p.id && !c.wrong); const on = talkingId === p.id;
            return (
              <li key={p.id} className={`rounded-xl border-2 p-2.5 transition ${on ? "border-accent bg-accent/10" : "border-line bg-sunk/60"}`}>
                <button type="button" aria-pressed={on} onClick={() => onTalking(on ? null : p.id)} className="flex w-full items-center gap-2 text-left" title="Falar com esta pessoa no roteiro">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? "bg-accent text-on-accent" : "bg-sunk text-muted"}`}>{p.name.trim()[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><b className="block break-words text-sm">{p.name}</b><span className="block break-words text-xs text-muted">{p.roleTitle ?? "Sem cargo"}</span></span>
                  {on && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-on-accent"><Check size={11} aria-hidden /> No roteiro</span>}
                </button>
                {mine.length > 0 && <p className="mt-1.5 flex flex-wrap gap-1 text-xs">{mine.map((c) => <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5">{c.kind === "phone" ? <Phone size={11} aria-hidden /> : <AtSign size={11} aria-hidden />}{c.kind === "phone" ? fmtPhone(c.value) : c.value}</span>)}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-sunk p-3">
          {people.length > 0 && (
            <label className="block text-xs font-semibold text-muted">Anotar para
              <select className={`${inputCls} mt-1`} value={String(target)} onChange={(e) => setTarget(e.target.value === "new" ? "new" : Number(e.target.value))}>
                <option value="new">Uma pessoa nova</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.roleTitle ? ` · ${p.roleTitle}` : ""}</option>)}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {target === "new" && <label className="block text-xs font-semibold text-muted">Nome<input className={`${inputCls} mt-1`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Carlos Silva" autoComplete="off" /></label>}
            <label className="block text-xs font-semibold text-muted">Cargo
              <input className={`${inputCls} mt-1`} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: Comprador" autoComplete="off" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Cargos comuns">{CARGOS.map((c) => <button key={c} type="button" onClick={() => setRole(c)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${role === c ? "border-accent bg-accent/15 text-accent" : "border-line bg-panel text-muted hover:text-ink"}`}>{c}</button>)}</div>
          <label className="block text-xs font-semibold text-muted">E-mail<input type="email" className={`${inputCls} mt-1`} value={email} maxLength={160} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" autoComplete="off" /></label>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted">Telefone ou WhatsApp (DDD + número)</p>
            {phones.map((p, i) => (
              <div key={i} className="flex gap-1.5">
                <input inputMode="tel" className={`${inputCls} min-w-0 flex-1`} value={p} maxLength={20} onChange={(e) => setPhones(phones.map((x, j) => (j === i ? e.target.value : x)))} placeholder="(42) 99999-9999" aria-label={`Telefone ${i + 1}`} autoComplete="off" />
                {phones.length > 1 && <button type="button" className={`${btnGhost} text-danger`} aria-label="Remover telefone" onClick={() => setPhones(phones.filter((_, j) => j !== i))}><X size={14} /></button>}
              </div>
            ))}
            {phones.length < 5 && <button type="button" className={btnGhost} onClick={() => setPhones([...phones, ""])}><Plus size={14} aria-hidden /> Outro telefone</button>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => { reset(); setOpen(false); }}>Cancelar</button>
            <button type="button" className={btnPrimary} disabled={pending || !canSave} onClick={save}><Check size={15} aria-hidden /> {pending ? "Salvando…" : "Salvar contato"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
