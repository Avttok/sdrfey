"use client";

import { Check, MessageCircle, UserPlus } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";
import { inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { captureContactAction, type CapturedPerson } from "@/modules/leads/capture";

/**
 * “Conversando atualmente com”: o nome de quem está na linha. É o nome que o roteiro usa nas perguntas.
 * Escolher alguém já cadastrado liga a pessoa ao roteiro; um nome novo pode ser guardado no lead com um toque.
 */
export function TalkingTo({ value, people, knownId, leadId, onChange, onEnter, onSaved }: { value: string; people: { id: number; name: string }[]; knownId: number | null; leadId: number; onChange: (v: string) => void; /** Enter com nome preenchido: segue o roteiro */ onEnter?: () => void; onSaved: (p: CapturedPerson) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const typed = value.trim();
  const ref = useRef<HTMLInputElement>(null);
  // aparece junto com a pergunta do nome: o cursor já cai no campo, sem rolar a tela
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const save = () => start(async () => {
    const r = await captureContactAction(leadId, { name: typed });
    if (!r.ok || !r.person) { toast("bad", r.message ?? "Não foi possível guardar."); return; }
    onSaved(r.person);
    toast("ok", `${r.person.name} guardado(a) no lead.`);
  });
  return (
    <section className="card-in rounded-2xl border-2 border-accent/60 bg-accent/5 p-3.5 shadow-md" aria-label="Com quem você está falando">
      <label className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-xl bg-grad text-on-accent"><MessageCircle size={16} aria-hidden /></span>Conversando atualmente com</span>
        <input ref={ref} list="talking-people" enterKeyHint="next" className={`${inputCls} min-w-48 flex-1 !text-base`} value={value} maxLength={80} autoComplete="off" onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && typed) { e.preventDefault(); onEnter?.(); } }} placeholder="Digite o nome de quem atendeu" />
        <datalist id="talking-people">{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        {typed && knownId == null && (
          <button type="button" disabled={pending} onClick={save} className="inline-flex items-center gap-1.5 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60"><UserPlus size={15} aria-hidden /> Guardar no lead</button>
        )}
        {typed && knownId != null && <span className="inline-flex items-center gap-1 text-xs font-medium text-ok"><Check size={14} aria-hidden /> já está no lead</span>}
      </label>
      <p className="mt-1.5 text-xs text-muted">{typed ? <>O roteiro passa a chamar a pessoa de <b className="text-ink">{typed.split(/\s+/)[0]}</b>.</> : "Escreva o nome e aperte Enter (ou toque em “Disse ou confirmou o nome”). As próximas perguntas já usam o nome."}</p>
    </section>
  );
}
