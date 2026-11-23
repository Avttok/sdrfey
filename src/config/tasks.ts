import type { ScriptNode } from "@/config/scripts";

/** Tarefas: o que o script deixa combinado para depois (ligar de novo, enviar e-mail, enviar a cotação…). Sem banco: o navegador e o servidor usam. */
export type TaskKind = "ligar" | "email" | "whatsapp" | "cotacao" | "pedido" | "outro";
export const TASK_KEYS: TaskKind[] = ["ligar", "email", "whatsapp", "cotacao", "pedido", "outro"];
export const TASK_KINDS: Record<TaskKind, { label: string; short: string }> = {
  ligar: { label: "Ligar", short: "Ligação" },
  email: { label: "Enviar e-mail", short: "E-mail" },
  whatsapp: { label: "Enviar WhatsApp", short: "WhatsApp" },
  cotacao: { label: "Enviar cotação", short: "Cotação" },
  pedido: { label: "Abrir pedido", short: "Pedido" },
  outro: { label: "Outra tarefa", short: "Outra" },
};
export type TaskArea = "sdr" | "vendas";

/** Uma tarefa que um passo ou uma resposta do script gera. `days` = daqui a quantos dias (0 = hoje). */
export type ScriptTask = { kind: TaskKind; title: string; days: number };
export type TaskDraft = ScriptTask & { key: string };

/**
 * Tarefas que o caminho percorrido gerou. Valem as tarefas da resposta escolhida em cada passo; se nenhuma resposta
 * declarou tarefas (nem vazia), vale o padrão do passo final. Duas tarefas do mesmo tipo viram uma só (a mais recente).
 */
export function draftsFromSteps(nodes: ScriptNode[], steps: { id: string; answer: string | null }[]): TaskDraft[] {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const found: ScriptTask[] = [];
  let declared = false;
  for (const s of steps) {
    const n = by.get(s.id);
    const op = n?.options.find((o) => o.label === s.answer);
    if (op?.tasks) { declared = true; found.push(...op.tasks); }
  }
  const last = steps.length ? by.get(steps[steps.length - 1].id) : undefined;
  if (last?.type === "fim" && last.tasks && !declared) found.push(...last.tasks);
  const out = new Map<TaskKind, ScriptTask>();
  for (const t of found) { out.delete(t.kind); out.set(t.kind, t); }
  return [...out.values()].map((t) => ({ ...t, key: t.kind }));
}

const BRT = "America/Sao_Paulo";
/** Dia (aaaa-mm-dd) no horário de Brasília. */
export function brDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BRT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** Daqui a `days` dias, às 9h de Brasília. Sábado e domingo passam para segunda. */
export function dueFromDays(days: number, now: Date = new Date()): Date {
  const [y, m, d] = brDay(now).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + Math.max(0, Math.round(days)), 12, 0)); // 12h UTC = 9h em Brasília
  const wd = t.getUTCDay();
  if (days > 0) { if (wd === 6) t.setUTCDate(t.getUTCDate() + 2); else if (wd === 0) t.setUTCDate(t.getUTCDate() + 1); }
  return t;
}

/** Em que grupo da tela a tarefa cai. */
export function dueBucket(due: Date | string | null, now: Date = new Date()): "atrasada" | "hoje" | "amanha" | "semana" | "depois" | "sem_data" {
  if (!due) return "sem_data";
  const day = brDay(new Date(due)); const today = brDay(now);
  if (day < today) return "atrasada";
  if (day === today) return "hoje";
  const tomorrow = brDay(new Date(now.getTime() + 86_400_000));
  if (day === tomorrow) return "amanha";
  const week = brDay(new Date(now.getTime() + 7 * 86_400_000));
  return day <= week ? "semana" : "depois";
}

/** Valor para <input type="datetime-local"> no horário de Brasília. */
export function toLocalInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: BRT, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(dt);
  return p.replace(" ", "T");
}
/** O contrário: texto do campo datetime-local (horário de Brasília) para data. */
export function fromLocalInput(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
