import type { SettingKey } from "./get";

/** Metas diárias do SDR. `attended`/`scheduled` têm coluna própria; `calls`/`converted` ficam em users.goals_extra. */
export const SDR_KINDS = [
  { k: "attended", label: "Atendidos", title: "Meta de atendidos", sub: "Leads atendidos e salvos por dia, por pessoa", today: "Atendidos hoje", qty: "daily_goal", on: "goal_attended_on" },
  { k: "scheduled", label: "Agendados", title: "Meta de agendados", sub: "Visitas agendadas e negociações abertas por dia, por pessoa", today: "Agendados hoje", qty: "daily_goal_scheduled", on: "goal_scheduled_on" },
  { k: "calls", label: "Ligações", title: "Meta de ligações", sub: "Ligações registradas por dia, por pessoa", today: "Ligações hoje", qty: "daily_goal_calls", on: "goal_calls_on" },
  { k: "converted", label: "Convertidos", title: "Meta de convertidos", sub: "Leads convertidos (viraram negociação) por dia, por pessoa", today: "Convertidos hoje", qty: "daily_goal_converted", on: "goal_converted_on" },
] as const satisfies readonly { k: string; label: string; title: string; sub: string; today: string; qty: SettingKey; on: SettingKey }[];
export type GoalKind = (typeof SDR_KINDS)[number]["k"];

export type Goal = { on: boolean; qty: number };
export type Goals = Record<GoalKind, Goal>;
type U = { dailyGoal: number | null; dailyGoalScheduled: number | null; goalAttendedOn: boolean | null; goalScheduledOn: boolean | null; goalsExtra?: Record<string, number> | null };

/** Ajustes próprios de uma pessoa, no mesmo formato para as quatro metas (null = segue a global). */
export function ownGoals(u: U): Record<GoalKind, { on: boolean | null; qty: number | null }> {
  const x = u.goalsExtra ?? {};
  const flag = (v: number | undefined) => (v === undefined ? null : v === 1);
  return {
    attended: { on: u.goalAttendedOn, qty: u.dailyGoal },
    scheduled: { on: u.goalScheduledOn, qty: u.dailyGoalScheduled },
    calls: { on: flag(x.calls_on), qty: x.calls ?? null },
    converted: { on: flag(x.converted_on), qty: x.converted ?? null },
  };
}
/** "Desligar todas as metas desta pessoa". */
export const goalsOff = (u: Pick<U, "goalsExtra">) => u.goalsExtra?.off_all === 1;

/** Metas valendo para uma pessoa: o que ela tem de próprio, senão a meta global; "desligar todas" vence tudo. */
export function effectiveGoals(u: U, s: Record<SettingKey, number>): Goals {
  const own = ownGoals(u), off = goalsOff(u);
  return Object.fromEntries(SDR_KINDS.map((d) => [d.k, { on: !off && (own[d.k].on ?? s[d.on] === 1), qty: own[d.k].qty ?? s[d.qty] }])) as Goals;
}
