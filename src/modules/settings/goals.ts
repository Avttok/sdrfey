import type { SettingKey } from "./get";

export type Goal = { on: boolean; qty: number };
export type Goals = { attended: Goal; scheduled: Goal };
type U = { dailyGoal: number | null; dailyGoalScheduled: number | null; goalAttendedOn: boolean | null; goalScheduledOn: boolean | null };

/** Metas valendo para uma pessoa: o que ela tem de próprio, senão a meta global. */
export function effectiveGoals(u: U, s: Record<SettingKey, number>): Goals {
  return {
    attended: { on: u.goalAttendedOn ?? s.goal_attended_on === 1, qty: u.dailyGoal ?? s.daily_goal },
    scheduled: { on: u.goalScheduledOn ?? s.goal_scheduled_on === 1, qty: u.dailyGoalScheduled ?? s.daily_goal_scheduled },
  };
}
