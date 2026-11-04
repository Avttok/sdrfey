import { auditLog, type Db } from "@/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export type AuditEntry = {
  /** Quem fez. Nulo = o sistema (automático / BOT). */
  userId?: number | null;
  leadId?: number | null;
  entity: "lead" | "user" | "tag" | "setting" | "import" | "visit";
  action: string;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  meta?: unknown;
};

function asText(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/** Grava um ou vários registros no histórico. Use dentro da mesma transação da alteração. */
export async function logAudit(db: DbOrTx, entries: AuditEntry | AuditEntry[]): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  const rows = list.map((e) => ({
    userId: e.userId ?? null,
    leadId: e.leadId ?? null,
    entity: e.entity,
    action: e.action,
    field: e.field ?? null,
    oldValue: asText(e.oldValue),
    newValue: asText(e.newValue),
    meta: e.meta ?? null,
  }));
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(auditLog).values(rows.slice(i, i + 1000));
  }
}

/** Compara dois objetos e devolve um registro de "de → para" para cada campo que mudou. */
export function diffToAudit<T extends Record<string, unknown>>(
  base: Omit<AuditEntry, "field" | "oldValue" | "newValue" | "action"> & { action?: string },
  before: T,
  after: Partial<T>,
  fieldLabels: Partial<Record<keyof T, string>> = {},
): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (const key of Object.keys(after) as (keyof T)[]) {
    const a = asText(before[key]);
    const b = asText(after[key]);
    if (a === b) continue;
    out.push({
      ...base,
      action: base.action ?? "alterou",
      field: fieldLabels[key] ?? String(key),
      oldValue: a,
      newValue: b,
    });
  }
  return out;
}
