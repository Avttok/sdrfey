"use client";

import { Ban, CalendarCheck, Check, CircleSlash, Globe, Link2, MapPin, Pause, Trash2, Undo2, UserCheck, Users, Workflow } from "lucide-react";
import { useContext } from "react";
import { AvatarGlyph } from "@/components/avatar-glyph";
import { TagIcons } from "@/components/tag-chip";
import { TAG_ICONS } from "@/config/tag-icons";
import { inputCls } from "@/components/ui";

/** Cartão de tag: ligado fica colorido e levantado, desligado fica pontilhado e apagado. */
export function FlashTag({ label, color, on, onClick, icon, Comp, hint }: { label: string; color: string; on: boolean; onClick: () => void; icon?: string | null; /** Ícone próprio (em vez do ícone da tag). */ Comp?: typeof Check; /** Frase pequena sob o nome. */ hint?: string }) {
  const map = useContext(TagIcons);
  const Icon = Comp ?? TAG_ICONS[icon ?? map[label.toUpperCase()] ?? ""];
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} data-on={on}
      className="ft group relative flex min-h-24 flex-col items-start justify-between gap-2 overflow-hidden rounded-2xl border-2 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-[.97]"
      style={{ "--cor": color } as React.CSSProperties}>
      <span className="flex w-full items-center justify-between">
        <span className="ft-ico grid size-9 place-items-center rounded-xl transition-all duration-300">{Icon ? <Icon size={18} aria-hidden /> : <Check size={18} aria-hidden />}</span>
        <span className="ft-pill rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{on ? "Ligado" : "Desligado"}</span>
      </span>
      <span><span className="block text-sm font-bold uppercase leading-tight tracking-wide">{label}</span>{hint && <span className="mt-0.5 block text-[11px] font-normal normal-case leading-snug text-muted">{hint}</span>}</span>
      {on && <span aria-hidden className="ft-check absolute -right-1 -top-1 grid size-6 place-items-center rounded-bl-xl text-white" style={{ background: color }}><Check size={14} /></span>}
    </button>
  );
}

export function TagDeck({ title, hint, icon: I, children, count, total }: { title: string; hint?: string; icon?: typeof Workflow; children: React.ReactNode; count: number; total: number }) {
  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-grad-soft text-accent">{I ? <I size={15} aria-hidden /> : <Workflow size={15} aria-hidden />}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
        <span className="figure ml-auto rounded-full bg-sunk px-2 py-0.5 text-xs font-semibold text-muted">{count}/{total}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export type DestKey = "none" | "sellers" | "reps" | "visit" | "sdr";
const DEST_META: Record<DestKey, { icon: typeof Users; tone: string }> = {
  none: { icon: CircleSlash, tone: "#64748b" }, sellers: { icon: Users, tone: "#16a34a" }, reps: { icon: MapPin, tone: "#2563eb" }, visit: { icon: CalendarCheck, tone: "#16a34a" }, sdr: { icon: Undo2, tone: "#d97706" },
};

/** Botões grandes de destino do lead. */
export function DestPicker({ value, onChange, options }: { value: DestKey; onChange: (k: DestKey) => void; options: readonly (readonly [DestKey, string, string])[] }) {
  return (
    <div role="radiogroup" aria-label="Para onde vai o lead" className={`grid gap-3 ${options.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>
      {options.map(([k, t, d]) => {
        const M = DEST_META[k]; const on = value === k;
        return (
          <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange(k)} data-on={on} style={{ "--cor": M.tone } as React.CSSProperties}
            className="ft group relative flex min-h-28 items-center gap-4 overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-[.98]">
            <span className="ft-ico grid size-14 shrink-0 place-items-center rounded-2xl transition-all duration-300"><M.icon size={28} aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-bold leading-tight">{t}</span><span className="mt-0.5 block text-xs leading-snug text-muted">{d}</span></span>
            {on && <span aria-hidden className="ft-check absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-grad text-on-accent"><Check size={14} /></span>}
          </button>
        );
      })}
    </div>
  );
}

type Seller = { id: number; name: string; hex?: string };
const first = (n: string) => n.split(" ")[0];
const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

/** Fila dos vendedores: o próximo da vez aparece em destaque. Dá para trocar a pessoa manualmente. */
export function SellerQueue({ sellers, nextId, queueOn, value, onChange }: { sellers: Seller[]; nextId: number | null; queueOn: boolean; value: number | null; onChange: (id: number | null) => void }) {
  const ordered = [...sellers].sort((a, b) => a.id - b.id);
  const start = Math.max(0, ordered.findIndex((s) => s.id === nextId));
  const line = ordered.map((_, i) => ordered[(start + i) % ordered.length]);
  const target = value ?? (queueOn ? nextId : null);
  const t = ordered.find((s) => s.id === target);
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-sunk/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-grad text-on-accent"><UserCheck size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Quem vai atender</p>
          <p className="text-base font-bold">{t ? <>{first(t.name)} <span className="text-sm font-normal text-muted">{value ? "(escolhido por você)" : "é o próximo da fila"}</span></> : "O primeiro vendedor que assumir"}</p>
        </div>
        {value && <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10" onClick={() => onChange(null)}>Voltar para a fila</button>}
      </div>
      {ordered.length > 0 && (
        <ol className="no-sb flex items-start gap-1 overflow-x-auto px-1 pb-2 pt-1" aria-label="Ordem da fila">
          {line.map((s, i) => {
            const on = s.id === target;
            return (
              <li key={s.id} className="flex items-start gap-1">
                <button type="button" onClick={() => onChange(s.id === value ? null : s.id)} aria-pressed={on} title={`Escolher ${s.name}`}
                  className={`group flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 py-2 transition-all duration-300 ${on ? "border-accent bg-accent/10 shadow-lg shadow-accent/20" : "border-transparent opacity-70 hover:opacity-100"}`}>
                  <span className={`relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${on ? "ring-4 ring-accent/30" : ""}`} style={{ background: s.hex ?? "var(--accent)" }}>
                    <AvatarGlyph avatar={null} initials={initials(s.name)} size={16} />
                    {on && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-accent/30" />}
                  </span>
                  <span className="w-full truncate text-center text-xs font-semibold">{first(s.name)}</span>
                  <span className="text-[10px] font-medium text-muted">{i === 0 && queueOn && !value ? "agora" : `${i + 1}º`}</span>
                </button>
                {i < line.length - 1 && <span aria-hidden className="mt-7 text-line">›</span>}
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted">{queueOn ? "A fila gira sozinha: cada lead encaminhado vai para a próxima pessoa. Se precisar, toque em alguém para escolher." : "Sem fila ligada: o lead cai no grupo e o primeiro a assumir fica com ele. Toque em alguém para escolher."}</p>
    </div>
  );
}

/** Dados da visita: código, data e link do Salesforce (todos obrigatórios). */
export function VisitFields({ code, setCode, date, dateInput, link, setLink, isPublic, setPublic }: { code: string; setCode: (v: string) => void; date: string; dateInput: React.ReactNode; link: string; setLink: (v: string) => void; isPublic?: boolean; setPublic?: (v: boolean) => void }) {
  void date;
  const okLink = /^https:\/\/\S+$/i.test(link.trim());
  return (
    <div className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[12rem_12rem_1fr]">
      <label className="block text-sm"><span className="mb-1 block text-muted">Código da visita <span className="text-danger" aria-hidden>*</span></span><input className={inputCls} placeholder="V-12345" value={code} onChange={(e) => setCode(e.target.value)} aria-required /></label>
      <div className="block text-sm"><span className="mb-1 block text-muted">Data da visita <span className="text-danger" aria-hidden>*</span></span>{dateInput}</div>
      <label className="block text-sm"><span className="mb-1 flex items-center gap-1.5 text-muted"><Link2 size={13} aria-hidden /> Link da visita no Salesforce <span className="text-danger" aria-hidden>*</span></span>
        <input className={`${inputCls} ${link && !okLink ? "!border-danger" : ""}`} placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} aria-required aria-invalid={!!link && !okLink} />
        {link && !okLink && <span className="mt-1 block text-xs text-danger">O link precisa começar com https://</span>}
      </label>
      {setPublic && (
        <div className="sm:col-span-3"><div className="w-full sm:w-72"><FlashTag label="Visita pública" color="#0ea5e9" on={!!isPublic} onClick={() => setPublic(!isPublic)} Comp={Globe} hint="Ligada: todos veem na janela de Visitas. Desligada: só você, a gestão e quem pegar o lead." /></div></div>
      )}
    </div>
  );
}

/** Os três botões finais. */
export function FinalActions({ pending, onSave, onStop, onDiscard }: { pending: boolean; onSave: () => void; onStop: () => void; onDiscard: () => void }) {
  return (
    <div className="grid gap-3 border-t border-line pt-5 md:grid-cols-[1.5fr_1fr_1fr]">
      <button type="button" disabled={pending} onClick={onSave} className="sh-go group flex min-h-20 items-center gap-3.5 rounded-2xl bg-grad px-5 py-3.5 text-left text-on-accent shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 disabled:opacity-60">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/25"><Check size={24} aria-hidden /></span>
        <span><span className="block text-base font-extrabold uppercase tracking-wide">Salvar e próximo</span><span className="block text-xs opacity-85">Registra tudo e já sorteia outro lead</span></span>
      </button>
      <button type="button" disabled={pending} onClick={onStop} title="Salva, libera o lead e volta ao botão Shuffler" className="group flex min-h-20 items-center gap-3 rounded-2xl border-2 border-line bg-panel px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-accent disabled:opacity-60">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunk text-accent transition group-hover:bg-accent/15"><Pause size={20} aria-hidden /></span>
        <span><span className="block text-sm font-bold uppercase">Salvar e parar</span><span className="block text-xs text-muted">Faz uma pausa depois de salvar</span></span>
      </button>
      <button type="button" disabled={pending} onClick={onDiscard} className="group flex min-h-20 items-center gap-3 rounded-2xl border-2 border-danger/30 bg-danger/5 px-4 py-3.5 text-left text-danger transition hover:-translate-y-0.5 hover:border-danger hover:bg-danger/10 disabled:opacity-60">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10"><Trash2 size={20} aria-hidden /></span>
        <span><span className="block text-sm font-bold uppercase">Descartar lead</span><span className="block text-xs opacity-80">Tira o lead do sorteio</span></span>
      </button>
    </div>
  );
}

export { Ban };
