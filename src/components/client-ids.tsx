"use client";

import { Check, Copy, ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import { EoxMenu } from "@/components/eox-menu";
import { EoxIcon, SalesforceIcon } from "@/components/brand-icons";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { useRun } from "@/components/use-run";
import { saveLeadIdsAction } from "@/modules/deals/actions";

type Props = { leadId: number; eoxId: string | null; eoxCode: string | null; sfId: string | null; eoxUrl: string | null; canEdit?: boolean; /** Link do perfil no Salesforce, quando o lead tem. */ sfUrl?: string | null };

/** Ids do cliente nas outras ferramentas: o da EOX abre o cadastro; o do Salesforce e o código só se copiam. */
export function ClientIds({ leadId, eoxId, eoxCode, sfId, eoxUrl, canEdit = true, compact = false, sfUrl = null }: Props & { compact?: boolean }) {
  const toast = useToast();
  const { run, pending } = useRun();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ eoxId: eoxId ?? "", eoxCode: eoxCode ?? "", sfId: sfId ?? "" });
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast("info", `Copiado: ${v}`); } catch { toast("warn", "Não consegui copiar."); } };
  const chip = compact ? "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition" : "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition";

  if (edit) {
    return (
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(() => saveLeadIdsAction(leadId, f), undefined, () => setEdit(false)); }}>
        <label className="text-xs text-muted">Código EOX<input className={inputCls} inputMode="numeric" placeholder="1293925" value={f.eoxId} onChange={(e) => setF({ ...f, eoxId: e.target.value })} /><span className="mt-0.5 block">o número depois de <code>record=</code> (abre o perfil e qualifica)</span></label>
        <label className="text-xs text-muted">ID EOX<input className={inputCls} placeholder="117805" value={f.eoxCode} onChange={(e) => setF({ ...f, eoxCode: e.target.value })} /></label>
        <label className="text-xs text-muted">Id Salesforce<input className={inputCls} placeholder="15 ou 18 caracteres" value={f.sfId} onChange={(e) => setF({ ...f, sfId: e.target.value })} /></label>
        <div className="flex gap-2 sm:col-span-3"><button className={btnPrimary} disabled={pending}><Check size={15} aria-hidden /> Salvar</button><button type="button" className={btnGhost} onClick={() => setEdit(false)}>Cancelar</button></div>
      </form>
    );
  }
  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {eoxUrl && eoxId
        ? <EoxMenu url={eoxUrl} size={compact ? "sm" : "md"} />
        : <span className={`${chip} border-dashed border-line text-muted`} title="Ainda sem o cadastro da EOX"><EoxIcon size={compact ? 12 : 15} /> EOX</span>}
      {sfUrl
        ? <a href={sfUrl} target="_blank" rel="noopener noreferrer" style={{ background: "#0070d2" }} className={`${chip} border-transparent text-white hover:brightness-110`} title="Abrir no Salesforce"><SalesforceIcon size={compact ? 13 : 16} /> Salesforce <ExternalLink size={compact ? 11 : 13} aria-hidden /></a>
        : sfId
          ? <button type="button" onClick={() => copy(sfId)} className={`${chip} border-transparent text-white hover:brightness-110`} style={{ background: "#0070d2" }} title="Copiar o Id do Salesforce"><SalesforceIcon size={compact ? 13 : 16} /> Salesforce <Copy size={compact ? 11 : 13} aria-hidden /></button>
          : <span className={`${chip} border-dashed border-line text-muted`} title="Ainda sem o Id do Salesforce"><SalesforceIcon size={compact ? 12 : 15} /> Salesforce</span>}
      {canEdit && <button type="button" onClick={() => setEdit(true)} aria-label="Editar Ids" title="Editar Ids (EOX e Salesforce)" className={`${btnGhost} !min-h-9 !px-2.5`}><Pencil size={14} aria-hidden /></button>}
    </div>
  );
}
