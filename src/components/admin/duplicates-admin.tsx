"use client";

import { ArrowRight, Check, CircleHelp, Mail, Merge, Phone, ShieldCheck, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { afterMerge, channelsOf, pickKeeper, type DupPerson, type DupSet } from "@/config/contact-merge";
import { useToast } from "@/components/toast";
import { btnGhost, panelCls } from "@/components/ui";
import { mergeSetAction, mergeSureSetsAction } from "@/modules/facts/contacts";

const WHY: Record<DupSet["reasons"][number], string> = { telefone: "mesmo telefone", email: "mesmo e-mail", nome: "mesmo nome", "nome parecido": "nome parecido" };
const setKey = (s: DupSet) => s.people.map((p) => p.id).join("-");
const fmtPhone = (v: string) => (v.length === 11 ? `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}` : v.length === 10 ? `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}` : v);

function Person({ p, role, onKeep, busy }: { p: DupPerson; role: "fica" | "junta"; onKeep: () => void; busy: boolean }) {
  const keep = role === "fica";
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 rounded-xl border-2 p-3 text-sm ${keep ? "border-ok bg-ok/5" : "border-dashed border-line bg-sunk/40"}`}>
      <div className="flex items-start gap-2">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${keep ? "bg-ok text-white" : "bg-line text-muted"}`}>{keep ? <><Star size={11} aria-hidden /> Fica</> : <>Será juntado</>}</span>
        {!keep && <button type="button" disabled={busy} onClick={onKeep} className="ml-auto text-xs font-semibold text-accent hover:underline disabled:opacity-50">Manter este</button>}
      </div>
      <p className="break-words text-base font-bold leading-tight">{p.name}</p>
      {p.roleTitle && <p className="text-xs text-muted">{p.roleTitle}</p>}
      <div className="space-y-1 text-xs">
        {p.phones.length === 0 && p.emails.length === 0 ? <p className="text-warn">Sem telefone nem e-mail</p> : null}
        {p.phones.map((x) => <p key={x} className="flex items-center gap-1.5"><Phone size={12} aria-hidden className="shrink-0 text-muted" />{fmtPhone(x)}</p>)}
        {p.emails.map((x) => <p key={x} className="flex items-center gap-1.5 break-all"><Mail size={12} aria-hidden className="shrink-0 text-muted" />{x}</p>)}
      </div>
      <p className="text-[11px] text-muted">{p.facts} {p.facts === 1 ? "dado guardado" : "dados guardados"}</p>
    </div>
  );
}

/** Contatos repetidos: cada cartão mostra quem fica, quem será juntado e o que sobra depois, sem recarregar a página. */
export function DuplicatesAdmin({ sets: initial }: { sets: DupSet[] }) {
  const toast = useToast();
  const [sets, setSets] = useState(initial);
  const [prefer, setPrefer] = useState(true);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem("merge_prefer_contact"); if (v !== null) setPrefer(v === "1"); } catch { /* sem armazenamento */ } }, []);
  const togglePrefer = (v: boolean) => { setPrefer(v); setPick({}); try { localStorage.setItem("merge_prefer_contact", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
  const keeperOf = (s: DupSet) => { const k = pick[setKey(s)]; return k && s.people.some((p) => p.id === k) ? k : pickKeeper(s.people, prefer); };
  const nSure = useMemo(() => sets.filter((s) => s.sure).length, [sets]);
  const remove = (key: string) => setSets((l) => l.filter((x) => setKey(x) !== key));

  async function mergeOne(s: DupSet) {
    const key = setKey(s); const keep = keeperOf(s); setBusy(key);
    const r = await mergeSetAction(keep, s.people.filter((p) => p.id !== keep).map((p) => p.id)).catch(() => ({ ok: false, message: "Não consegui juntar agora. Tente de novo." }));
    setBusy(null);
    if (r.ok) { toast("ok", r.message ?? "Contatos juntados."); remove(key); } else toast("bad", r.message ?? "Não foi possível juntar.");
  }
  async function mergeAllSure() {
    if (!sure) { setSure(true); return; }
    setBusy("all"); setSure(false);
    const r = await mergeSureSetsAction(prefer).catch(() => null);
    setBusy(null);
    if (!r) return toast("bad", "Não consegui juntar agora. Tente de novo.");
    toast(r.ok ? "ok" : "bad", r.message ?? "Pronto.");
    setSets((l) => l.filter((s) => !s.sure));
  }

  if (!sets.length) return <p className={`${panelCls} p-5 text-sm text-muted`}>Nenhum contato repetido por aqui. Tudo certo!</p>;
  return (
    <div className="space-y-4">
      <section className={`${panelCls} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm"><b>{sets.length}</b> {sets.length === 1 ? "grupo" : "grupos"} de contatos repetidos, <b className="text-ok">{nSure}</b> com certeza (mesmo telefone, e-mail ou nome) e <b className="text-warn">{sets.length - nSure}</b> para você conferir.</p>
          {nSure > 0 && (
            <span className="flex items-center gap-2">
              {sure && <button type="button" className={btnGhost} onClick={() => setSure(false)}>Cancelar</button>}
              <button type="button" disabled={busy !== null} onClick={() => void mergeAllSure()} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white transition disabled:opacity-60 ${sure ? "bg-warn" : "bg-grad shadow"}`}>
                <Merge size={15} aria-hidden /> {busy === "all" ? "Juntando…" : sure ? `Confirmar: juntar ${nSure} ${nSure === 1 ? "grupo" : "grupos"}` : `Juntar os ${nSure} com certeza`}
              </button>
            </span>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-sunk/60 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" checked={prefer} onChange={(e) => togglePrefer(e.target.checked)} />
          <span><b>Manter sempre quem tem telefone ou e-mail.</b> <span className="text-muted">Os contatos moram dentro das empresas, então fica o que tem meio de contato e o outro é juntado nele. Desligado, fica o que tem mais dados e o nome mais completo. Você pode trocar quem fica em cada grupo.</span></span>
        </label>
      </section>

      {sets.map((s) => {
        const key = setKey(s); const keep = keeperOf(s); const keeper = s.people.find((p) => p.id === keep)!; const rest = s.people.filter((p) => p.id !== keep);
        const after = afterMerge(s.people); const none = s.people.every((p) => channelsOf(p) === 0);
        return (
          <section key={key} className={`${panelCls} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="min-w-0 flex-1 truncate text-base font-extrabold">{s.company}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.sure ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>{s.sure ? <ShieldCheck size={13} aria-hidden /> : <CircleHelp size={13} aria-hidden />}{s.sure ? "Com certeza" : "Confira"} · {s.reasons.map((r) => WHY[r]).join(", ")}</span>
              <Link className="text-xs font-semibold text-accent hover:underline" href={`/leads/${s.leadId}`}>abrir lead</Link>
            </div>
            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
              <div className="grid flex-[2] gap-2 sm:grid-cols-2">{rest.map((p) => <Person key={p.id} p={p} role="junta" busy={busy !== null} onKeep={() => setPick((m) => ({ ...m, [key]: p.id }))} />)}</div>
              <ArrowRight aria-hidden className="mx-auto shrink-0 rotate-90 text-muted md:rotate-0" />
              <div className="flex-1"><Person p={keeper} role="fica" busy={busy !== null} onKeep={() => {}} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-muted">{none ? "Nenhum deles tem telefone ou e-mail guardado." : <>Depois de juntar, <b className="text-ink">{keeper.name}</b> terá <b className="text-ink">{after.phones}</b> {after.phones === 1 ? "telefone" : "telefones"}, <b className="text-ink">{after.emails}</b> {after.emails === 1 ? "e-mail" : "e-mails"} e <b className="text-ink">{after.facts}</b> dados.</>}</p>
              <button type="button" className={btnGhost} disabled={busy !== null} onClick={() => remove(key)} title="Esconde até recarregar a página. Nada é alterado."><X size={14} aria-hidden /> Não são a mesma pessoa</button>
              <button type="button" disabled={busy !== null} onClick={() => void mergeOne(s)} className="inline-flex items-center gap-1.5 rounded-xl bg-grad px-3.5 py-2 text-sm font-bold text-white shadow transition disabled:opacity-60"><Check size={15} aria-hidden /> {busy === key ? "Juntando…" : `Juntar em ${keeper.name.split(" ")[0]}`}</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
