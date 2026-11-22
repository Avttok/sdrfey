"use client";

import { Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { AnnouncementCard } from "@/components/announcement-host";
import { useConfirm } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, inputCls, panelCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { ANN_EFFECTS, ANN_THEMES, effectOf, type AnnEffect, type AnnTheme } from "@/config/announcements";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/modules/announcements/actions";

export type AnnRow = { id: number; title: string; body: string; theme: AnnTheme; effect: AnnEffect; roles: string[]; active: boolean; expiresAt: string | null; createdAt: string };
type Draft = { id?: number; title: string; body: string; theme: AnnTheme; effect: AnnEffect; roles: string[]; active: boolean; hours: string };
const ROLES: [string, string][] = [["user", "Operadores SDR"], ["seller", "Vendedores SDR"], ["manager", "Gestão"], ["admin", "Adm"]];
const blank = (): Draft => ({ title: "", body: "", theme: "aviso", effect: "auto", roles: [], active: true, hours: "24" });

export function AnnouncementsAdmin({ rows }: { rows: AnnRow[] }) {
  const [d, setD] = useState<Draft>(blank());
  const { run, pending } = useRun();
  const { ask, dialog } = useConfirm(pending);
  const hours = d.hours.trim() ? Number(d.hours) : null;
  const send = () => run(() => saveAnnouncementAction({ ...d, hours: hours && Number.isFinite(hours) ? Math.round(hours) : null }), undefined, () => setD(blank()));
  const edit = (r: AnnRow) => { setD({ id: r.id, title: r.title, body: r.body, theme: r.theme, effect: r.effect, roles: r.roles, active: r.active, hours: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div className="space-y-5">
      <section className={`${panelCls} space-y-3 p-4`}>
        <h2 className="flex items-center gap-2 font-semibold"><Megaphone size={18} aria-hidden className="text-accent" /> {d.id ? "Editar aviso" : "Novo aviso para a equipe"}</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ANN_THEMES) as AnnTheme[]).map((k) => { const t = ANN_THEMES[k]; const Icon = t.icon; return <button key={k} type="button" aria-pressed={d.theme === k} onClick={() => setD({ ...d, theme: k })} className={`lift flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition ${d.theme === k ? "ring-2" : "opacity-80"}`} style={{ borderColor: t.color, ...(d.theme === k ? { background: `color-mix(in srgb, ${t.color} 14%, transparent)`, "--tw-ring-color": t.color } as React.CSSProperties : {}) }}><Icon size={16} aria-hidden style={{ color: t.color }} /><span><b className="block">{t.label}</b><span className="text-xs text-muted">{t.hint}</span></span></button>; })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Título<input className={inputCls} maxLength={90} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Ex.: Sistema em manutenção às 18h" /></label>
          <label className="text-sm sm:col-span-2">Texto (opcional)<textarea className={inputCls} rows={2} maxLength={400} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></label>
          <label className="text-sm">Efeito ao chegar<select className={inputCls} value={d.effect} onChange={(e) => setD({ ...d, effect: e.target.value as AnnEffect })}><option value="auto">Automático (do tipo)</option>{Object.entries(ANN_EFFECTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Fica no ar por (horas)<input className={inputCls} inputMode="numeric" value={d.hours} onChange={(e) => setD({ ...d, hours: e.target.value })} placeholder="vazio = até desligar" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Quem vê:</span>{ROLES.map(([k, l]) => <button key={k} type="button" aria-pressed={d.roles.includes(k)} onClick={() => setD({ ...d, roles: d.roles.includes(k) ? d.roles.filter((x) => x !== k) : [...d.roles, k] })} className={`rounded-full border px-3 py-1 transition ${d.roles.includes(k) ? "border-accent bg-accent/15 font-semibold text-accent" : "border-line bg-sunk/60 text-muted"}`}>{l}</button>)}<span className="text-xs text-muted">{d.roles.length ? "" : "(ninguém marcado = todos)"}</span></div>
        {d.title.trim() && <div className="space-y-1"><p className="text-xs font-semibold text-muted">Prévia</p><AnnouncementCard preview a={{ id: 0, title: d.title, body: d.body, theme: d.theme, effect: effectOf(d.theme, d.effect) }} /></div>}
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Publicar agora</label><span className="flex-1" /><button type="button" className={btnPrimary} disabled={pending || d.title.trim().length < 2} onClick={send}><Send size={15} aria-hidden /> {d.id ? "Salvar aviso" : "Publicar aviso"}</button>{d.id && <button type="button" className={btnGhost} onClick={() => setD(blank())}>Cancelar edição</button>}</div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Avisos criados</h2>
        <ul className="space-y-2">
          {rows.map((r) => { const t = ANN_THEMES[r.theme] ?? ANN_THEMES.aviso; const expired = r.expiresAt && new Date(r.expiresAt) < new Date(); return (
            <li key={r.id} className={`${panelCls} flex flex-wrap items-center gap-3 p-3 ${r.active && !expired ? "" : "opacity-60"}`}>
              <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: t.color }}><t.icon size={17} aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.title}</p><p className="text-xs text-muted">{t.label} · {r.roles.length ? r.roles.join(", ") : "todos"} · {expired ? "expirado" : r.active ? (r.expiresAt ? `até ${new Date(r.expiresAt).toLocaleString("pt-BR")}` : "no ar") : "desligado"}</p></div>
              <button type="button" className={btnGhost} disabled={pending} onClick={() => run(() => saveAnnouncementAction({ id: r.id, title: r.title, body: r.body, theme: r.theme, effect: r.effect, roles: r.roles, active: !r.active, hours: null }))}>{r.active ? "Desligar" : "Ligar"}</button>
              <button type="button" aria-label="Editar aviso" className={btnGhost} onClick={() => edit(r)}><Pencil size={14} /></button>
              <button type="button" aria-label="Excluir aviso" className={`${btnGhost} text-danger`} disabled={pending} onClick={() => ask({ title: "Excluir este aviso?", body: `"${r.title}" some para todos.`, label: "Sim, excluir", icon: Trash2, onConfirm: () => run(() => deleteAnnouncementAction(r.id)) })}><Trash2 size={14} /></button>
            </li>); })}
          {rows.length === 0 && <li className="text-sm text-muted"><Plus size={14} aria-hidden className="mr-1 inline" />Nenhum aviso ainda.</li>}
        </ul>
      </section>
      {dialog}
    </div>
  );
}
