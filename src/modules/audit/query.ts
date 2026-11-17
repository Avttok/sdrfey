import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { auditLog, db, leads, users } from "@/db";
import { dayEnd, dayStart } from "@/lib/format";

export const ENTITY_LABEL: Record<string, string> = { lead: "Lead", visit: "Lead", user: "Usuário", tag: "Tag", setting: "Configuração", import: "Importação", rep: "Representante", template: "Modelo de e-mail", session: "Atendimento", goal: "Meta" };

export type AuditFilters = { from?: string; to?: string; user?: string; type?: string; q?: string; page: number; viewer?: { id: number; roles: string[] } };
export const AUDIT_PAGE = 50;

export function parseAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() || undefined : undefined);
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") ? one(k) : undefined);
  return { from: date("from"), to: date("to"), user: one("user"), type: one("type"), q: one("q"), page: Math.max(1, Number(one("page")) || 1) };
}

export async function listAudit(f: AuditFilters) {
  const c: SQL[] = [];
  if (f.from) c.push(gte(auditLog.at, dayStart(f.from)));
  if (f.to) c.push(lte(auditLog.at, dayEnd(f.to)));
  if (f.user === "sistema") c.push(sql`${auditLog.userId} is null`);
  else if (f.user && /^\d+$/.test(f.user)) c.push(eq(auditLog.userId, Number(f.user)));
  if (f.type) c.push(f.type === "lead" ? sql`${auditLog.entity} in ('lead','visit')` : eq(auditLog.entity, f.type));
  if (f.q) { const like = `%${f.q.replace(/[%_]/g, "")}%`; c.push(sql`(${auditLog.action} ilike ${like} or ${auditLog.field} ilike ${like} or ${auditLog.oldValue} ilike ${like} or ${auditLog.newValue} ilike ${like} or ${leads.company} ilike ${like})`); }
  if (f.viewer && !f.viewer.roles.includes("admin")) c.push(sql`(${auditLog.userId} is null or ${auditLog.userId} = ${f.viewer.id} or ${auditLog.userId} not in (select id from users where not in_metrics))`);
  const where = c.length ? and(...c) : undefined;
  const base = db.select({ id: auditLog.id, at: auditLog.at, entity: auditLog.entity, action: auditLog.action, field: auditLog.field, oldValue: auditLog.oldValue, newValue: auditLog.newValue, meta: auditLog.meta, leadId: auditLog.leadId, userId: auditLog.userId, userName: users.name, userAccent: users.accent, userRoles: users.roles, company: leads.company })
    .from(auditLog).leftJoin(users, eq(users.id, auditLog.userId)).leftJoin(leads, eq(leads.id, auditLog.leadId));
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLog).leftJoin(leads, eq(leads.id, auditLog.leadId)).where(where);
  const rows = await base.where(where).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(AUDIT_PAGE).offset((f.page - 1) * AUDIT_PAGE);
  return { total: n, rows, pages: Math.max(1, Math.ceil(n / AUDIT_PAGE)) };
}

type Row = Awaited<ReturnType<typeof listAudit>>["rows"][number];
export type AuditGroup = { key: string; rows: Row[] };

/**
 * Junta registros seguidos da mesma pessoa, no mesmo lead (ou mesmo tipo), feitos em até 10 minutos um do outro.
 * Assim "shuffler um lead" vira um bloco só, e cada alteração continua visível e revertível lá dentro.
 */
export function groupAudit(rows: Row[], gapMs = 10 * 60_000): AuditGroup[] {
  const out: AuditGroup[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const prev = last?.rows[last.rows.length - 1];
    const same = prev && prev.userId === r.userId && prev.entity === r.entity && prev.leadId === r.leadId && (r.leadId != null || prev.action === r.action) && prev.at.getTime() - r.at.getTime() <= gapMs;
    if (same) last.rows.push(r);
    else out.push({ key: String(r.id), rows: [r] });
  }
  return out;
}
