import { BadgeDollarSign, FileText, ListTodo, Mail, MessageCircle, PhoneCall, type LucideIcon } from "lucide-react";
import { TASK_KINDS, dueBucket, type TaskKind } from "@/config/tasks";

export const TASK_ICON: Record<TaskKind, LucideIcon> = { ligar: PhoneCall, email: Mail, whatsapp: MessageCircle, cotacao: FileText, pedido: BadgeDollarSign, outro: ListTodo };
export const TASK_HEX: Record<TaskKind, string> = { ligar: "#0ea5e9", email: "#ef4444", whatsapp: "#22c55e", cotacao: "#f59e0b", pedido: "#16a34a", outro: "#64748b" };

export function KindBadge({ kind, size = 14 }: { kind: TaskKind; size?: number }) {
  const Icon = TASK_ICON[kind] ?? ListTodo; const hex = TASK_HEX[kind] ?? "#64748b";
  return <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: hex }} title={TASK_KINDS[kind]?.label}><Icon size={size + 3} aria-hidden /></span>;
}

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });
const fmtHour = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Hoje, 09:00", "Amanhã, 09:00", "ter., 25/11 09:00" ou "Sem data"; atrasada em vermelho. */
export function DueChip({ due, done = false }: { due: string | null; done?: boolean }) {
  if (!due) return <span className="rounded-full bg-sunk px-2.5 py-0.5 text-xs font-semibold text-muted">Sem data</span>;
  const b = dueBucket(due); const d = new Date(due);
  const hour = fmtHour.format(d);
  const text = b === "hoje" ? `Hoje, ${hour}` : b === "amanha" ? `Amanhã, ${hour}` : b === "atrasada" ? `${fmtDay.format(d)}, ${hour}` : fmt.format(d).replace(",", "");
  const cls = done ? "bg-sunk text-muted" : b === "atrasada" ? "bg-danger/15 text-danger" : b === "hoje" ? "bg-warn/20 text-warn" : "bg-accent/12 text-accent";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{!done && b === "atrasada" ? "Atrasada · " : ""}{text}</span>;
}
