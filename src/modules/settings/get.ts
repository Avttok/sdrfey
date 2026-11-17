import { db, settings } from "@/db";
import type { DbOrTx } from "@/modules/audit/log";

/** Valores padrão: valem até o Adm mudar algo em Parâmetros. */
export const SETTING_DEFAULTS = {
  lock_minutes: 30,
  daily_goal: 35,
  /** Meta de agendados por pessoa/dia, e se cada meta está ligada (1) ou desligada (0). */
  daily_goal_scheduled: 5,
  goal_attended_on: 1,
  goal_scheduled_on: 1,
  skip_hours: 24,
  sem_contato_days: 3,
  /** Dias até um lead já trabalhado (sem outra regra) poder ser sorteado de novo. */
  rework_days: 30,
  /** Dias parado para um lead quente ou uma visita pendente virar alerta no dashboard. */
  alert_days: 3,
  /** Período que o dashboard abre por padrão: 1 (hoje), 7 ou 30 dias. */
  dash_default_days: 1,
  /** 1 = contas com mais de um cargo veem as abas em grupos (SDR, Vendedor, Gestor, Adm). */
  nav_group: 1,
  /** 1 = chat interno ligado para todos (botão flutuante). */
  chat_on: 1,
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(database: DbOrTx = db): Promise<Record<SettingKey, number>> {
  const rows = await database.select().from(settings);
  const out = { ...SETTING_DEFAULTS } as Record<SettingKey, number>;
  for (const r of rows) {
    if (r.key in out && typeof r.value === "number") out[r.key as SettingKey] = r.value;
  }
  return out;
}
