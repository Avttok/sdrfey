import "server-only";
import { eq } from "drizzle-orm";
import { buildRe, replaceDeep, esc } from "@/lib/term-replace";
import { announcements, db, emailTemplates, scripts, tagGroups, tags, termSwaps, type Db } from "@/db";
import { logAudit } from "@/modules/audit/log";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type SwapOpts = { from: string; to: string; matchCase: boolean; wholeWord: boolean };
type Row = { id: string | number; value: unknown };
type Target = { key: string; label: string; load: () => Promise<Row[]>; save: (tx: Tx, id: string | number, value: unknown) => Promise<void> };

const str = (v: unknown) => (v == null ? "" : String(v));

/**
 * Onde o Glossário procura textos já gravados. O histórico de auditoria fica de fora de propósito: ele é o retrato do que aconteceu.
 * Para incluir um campo novo, acrescente uma linha aqui (como carregar e como salvar).
 */
export const TARGETS: Target[] = [
  { key: "tags.label", label: "Tags · nome", load: async () => (await db.select({ id: tags.id, v: tags.label }).from(tags)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(tags).set({ label: str(v) }).where(eq(tags.id, Number(id))); } },
  { key: "tag_groups.name", label: "Tags · nome do grupo", load: async () => (await db.select({ id: tagGroups.key, v: tagGroups.name }).from(tagGroups)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(tagGroups).set({ name: str(v) }).where(eq(tagGroups.key, String(id))); } },
  { key: "email_templates.name", label: "Modelos de e-mail · nome", load: async () => (await db.select({ id: emailTemplates.id, v: emailTemplates.name }).from(emailTemplates)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(emailTemplates).set({ name: str(v) }).where(eq(emailTemplates.id, Number(id))); } },
  { key: "email_templates.subject", label: "Modelos de e-mail · assunto", load: async () => (await db.select({ id: emailTemplates.id, v: emailTemplates.subject }).from(emailTemplates)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(emailTemplates).set({ subject: str(v) }).where(eq(emailTemplates.id, Number(id))); } },
  { key: "email_templates.body", label: "Modelos de e-mail · texto", load: async () => (await db.select({ id: emailTemplates.id, v: emailTemplates.body }).from(emailTemplates)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(emailTemplates).set({ body: str(v) }).where(eq(emailTemplates.id, Number(id))); } },
  { key: "email_templates.body_html", label: "Modelos de e-mail · texto formatado", load: async () => (await db.select({ id: emailTemplates.id, v: emailTemplates.bodyHtml }).from(emailTemplates)).filter((r) => r.v).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(emailTemplates).set({ bodyHtml: str(v) }).where(eq(emailTemplates.id, Number(id))); } },
  { key: "scripts.title", label: "Roteiros · título", load: async () => (await db.select({ id: scripts.id, v: scripts.title }).from(scripts)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(scripts).set({ title: str(v) }).where(eq(scripts.id, Number(id))); } },
  { key: "scripts.summary", label: "Roteiros · resumo", load: async () => (await db.select({ id: scripts.id, v: scripts.summary }).from(scripts)).filter((r) => r.v).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(scripts).set({ summary: str(v) }).where(eq(scripts.id, Number(id))); } },
  { key: "scripts.nodes", label: "Roteiros · falas e respostas", load: async () => (await db.select({ id: scripts.id, v: scripts.nodes }).from(scripts)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(scripts).set({ nodes: v }).where(eq(scripts.id, Number(id))); } },
  { key: "announcements.title", label: "Avisos globais · título", load: async () => (await db.select({ id: announcements.id, v: announcements.title }).from(announcements)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(announcements).set({ title: str(v) }).where(eq(announcements.id, Number(id))); } },
  { key: "announcements.body", label: "Avisos globais · texto", load: async () => (await db.select({ id: announcements.id, v: announcements.body }).from(announcements)).map((r) => ({ id: r.id, value: r.v })), save: async (tx, id, v) => { await tx.update(announcements).set({ body: str(v) }).where(eq(announcements.id, Number(id))); } },
];
export const TARGET_BY_KEY = new Map(TARGETS.map((t) => [t.key, t]));
export const MAX_ROWS = 3000;

const firstText = (v: unknown): string => (typeof v === "string" ? v : v && typeof v === "object" ? Object.values(v).map(firstText).find(Boolean) ?? "" : "");
function snippet(text: string, re: RegExp): string {
  const m = new RegExp(re.source, re.flags.replace("g", "")).exec(text);
  if (!m) return text.slice(0, 80);
  const a = Math.max(0, m.index - 30), b = Math.min(text.length, m.index + m[0].length + 30);
  return `${a > 0 ? "…" : ""}${text.slice(a, b)}${b < text.length ? "…" : ""}`;
}
/** Acha o trecho do primeiro texto que contém o termo (para a prévia). */
function findText(v: unknown, re: RegExp): string {
  if (typeof v === "string") return new RegExp(re.source, re.flags.replace("g", "")).test(v) ? v : "";
  if (Array.isArray(v)) { for (const x of v) { const f = findText(x, re); if (f) return f; } return ""; }
  if (v && typeof v === "object") { for (const x of Object.values(v)) { const f = findText(x, re); if (f) return f; } }
  return "";
}

export type SwapPreview = { total: number; rows: number; targets: { key: string; label: string; rows: number; hits: number; samples: { id: string | number; before: string; after: string }[] }[] };

export async function previewSwap(o: SwapOpts): Promise<{ preview: SwapPreview; changes: { t: string; id: string | number; old: unknown; neu: unknown }[] }> {
  const re = buildRe(o);
  const out: SwapPreview = { total: 0, rows: 0, targets: [] };
  const changes: { t: string; id: string | number; old: unknown; neu: unknown }[] = [];
  for (const t of TARGETS) {
    const rows = await t.load();
    let n = 0, hits = 0;
    const samples: SwapPreview["targets"][number]["samples"] = [];
    for (const r of rows) {
      const { value, n: h } = replaceDeep(r.value, re, o.to);
      if (!h) continue;
      n++; hits += h;
      changes.push({ t: t.key, id: r.id, old: r.value, neu: value });
      if (samples.length < 3) { const b = findText(r.value, re) || firstText(r.value); samples.push({ id: r.id, before: snippet(b, re), after: snippet(b.replace(re, () => o.to), new RegExp(esc(o.to || "\u0000"), "i")) }); }
    }
    if (n) { out.targets.push({ key: t.key, label: t.label, rows: n, hits, samples }); out.total += hits; out.rows += n; }
  }
  return { preview: out, changes };
}

type Change = { t: string; id: string | number; old: unknown; neu: unknown };

/** Grava a troca numa transação só: altera as linhas, guarda o antes/depois (para desfazer) e registra no histórico. */
export async function commitSwap(userId: number, o: SwapOpts, changes: Change[], preview: SwapPreview) {
  await db.transaction(async (tx) => {
    for (const c of changes) await TARGET_BY_KEY.get(c.t)?.save(tx, c.id, c.neu);
    await tx.insert(termSwaps).values({ userId, from: o.from, to: o.to, matchCase: o.matchCase, wholeWord: o.wholeWord, changes, rows: changes.length });
    await logAudit(tx, { userId, entity: "setting", action: "trocou termo no banco", field: o.from, newValue: o.to, meta: { linhas: changes.length, trocas: preview.total, onde: preview.targets.map((t) => `${t.label}: ${t.rows}`) } });
  });
}

/** Desfaz: só volta a linha que continua exatamente como a troca deixou (se alguém editou depois, ela fica como está). */
export async function revertSwap(userId: number, swap: { id: number; from: string; to: string; changes: Change[] }): Promise<{ restored: number; skipped: number }> {
  return db.transaction(async (tx) => {
    let restored = 0, skipped = 0;
    const cache = new Map<string, Map<string, unknown>>();
    for (const c of swap.changes) {
      const t = TARGET_BY_KEY.get(c.t);
      if (!t) { skipped++; continue; }
      if (!cache.has(c.t)) cache.set(c.t, new Map((await t.load()).map((r) => [String(r.id), r.value])));
      const cur = cache.get(c.t)!.get(String(c.id));
      if (JSON.stringify(cur) === JSON.stringify(c.neu)) { await t.save(tx, c.id, c.old); restored++; } else skipped++;
    }
    await tx.update(termSwaps).set({ undoneAt: new Date() }).where(eq(termSwaps.id, swap.id));
    await logAudit(tx, { userId, entity: "setting", action: "desfez troca de termo", field: swap.from, newValue: swap.to, meta: { restored, skipped } });
    return { restored, skipped };
  });
}
