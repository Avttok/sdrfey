"use client";

import { ClientIds } from "@/components/client-ids";
import { SocialLink, type SocialKind } from "@/components/brand-icons";

export type LeadLinksData = { id: number; eoxId: string | null; eoxCode: string | null; sfId: string | null; eoxUrl: string | null; site?: string | null; instagram?: string | null; facebook?: string | null; linkedin?: string | null };

const toUrl = (v: string | null | undefined) => { const t = (v ?? "").trim(); if (!t || /\s/.test(t)) return null; if (/^https?:\/\//i.test(t)) return t; return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t) ? `https://${t}` : null; };

/** Atalhos do lead (EOX, Salesforce, site e redes): só aparece o que o lead tem salvo; sem botão vazio. Serve para pesquisar durante a ligação. */
export function LeadLinks({ lead, compact = true, className = "" }: { lead: LeadLinksData; compact?: boolean; className?: string }) {
  const net = ([["site", lead.site], ["instagram", lead.instagram], ["facebook", lead.facebook], ["linkedin", lead.linkedin]] as [string, string | null | undefined][])
    .map(([k, v]) => [k, toUrl(v)] as const).filter((x): x is [string, string] => !!x[1]);
  const hasIds = !!(lead.eoxUrl && lead.eoxId) || !!lead.sfId;
  if (!hasIds && !net.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {hasIds && <ClientIds leadId={lead.id} eoxId={lead.eoxId} eoxCode={lead.eoxCode} sfId={lead.sfId} eoxUrl={lead.eoxUrl} canEdit={false} compact={compact} menu={false} />}
      {net.map(([k, u]) => <SocialLink key={k} kind={k as SocialKind} href={u} />)}
    </div>
  );
}
