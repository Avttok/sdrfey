"use client";

import { Check, MessageCircle, UserPlus } from "lucide-react";
import { useTransition } from "react";
import { inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { captureContactAction, type CapturedPerson } from "@/modules/leads/capture";

/**
 * “Conversando atualmente com”: o nome de quem está na linha. É o nome que o roteiro usa nas perguntas.
 * Escolher alguém já cadastrado liga a pessoa ao roteiro; um nome novo pode ser guardado no lead com um toque.
 */
export function TalkingTo({ value, people, knownId, leadId, onChange, onSaved }: { value: string; people: { id: number; name: string }[]; knownId: number | null; leadId: number; onChange: (v: string) => void; onSaved: (p: CapturedPerson) => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const typed = value.trim();
  const save = () => start(async () => {
    const r = await captureContactAction(leadId, { name: typed });
    if (!r.ok || !r.person) { toast("bad", r.message ?? "Não foi possível guardar."); return; }
    onSaved(r.person);
    toast("ok", `${r.person.name} guardado(a) no lead.`);
  });
  return (
    <section className="rounded-2xl border border-line bg-panel p-3" aria-label="Com quem você está falando">
      <label className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-xl bg-grad text-on-accent"><MessageCircle size={16} aria-hidden /></span>Conversando atualmente com</span>
        <input list="talking-people" className={`${inputCls} min-w-48 flex-1`} value={value} maxLength={80} autoComplete="off" onChange={(e) => onChange(e.target.value)} placeholder="Digite o nome de quem atendeu" />
        <datalist id="talking-people">{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        {typed && knownId == null && (
          <button type="button" disabled={pending} onClick={save} className="inline-flex items-center gap-1.5 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60"><UserPlus size={15} aria-hidden /> Guardar no lead</button>
        )}
        {typed && knownId != null && <span className="inline-flex items-center gap-1 text-xs font-medium text-ok"><Check size={14} aria-hidden /> já está no lead</span>}
      </label>
      <p className="mt-1.5 text-xs text-muted">{typed ? <>O roteiro passa a chamar a pessoa de <b className="text-ink">{typed.split(/\s+/)[0]}</b>.</> : "Assim que souber o nome, escreva aqui: as perguntas do roteiro passam a usar o nome."}</p>
    </section>
  );
}
