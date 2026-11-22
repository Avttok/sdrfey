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
  /** Metas opcionais por pessoa/dia: ligações feitas e leads convertidos (viraram negociação). Começam desligadas. */
  daily_goal_calls: 20,
  goal_calls_on: 0,
  daily_goal_converted: 2,
  goal_converted_on: 0,
  skip_hours: 24,
  sem_contato_days: 3,
  /** Dias até um lead já trabalhado (sem outra regra) poder ser sorteado de novo. */
  rework_days: 30,
  /** Dias parado para um lead quente ou uma visita pendente virar alerta no dashboard. */
  alert_days: 3,
  /** Período que o dashboard abre por padrão: 1 (hoje), 7 ou 30 dias. */
  dash_default_days: 1,
  /** 1 = contas com mais de um cargo veem as abas em grupos (SDR, Vendas, Gestor, Adm). */
  nav_group: 1,
  /** 1 = chat interno ligado para todos (botão flutuante). */
  chat_on: 1,
  /** 1 = consulta automática de CNPJ em segundo plano ligada (os shufflers não consultam sozinhos). */
  auto_enrich: 0,
  /** 1 = a equipe ganha moedas / pode gastar na loja. O Adm desliga para todos de uma vez. */
  coins_earn_on: 1,
  coins_spend_on: 1,
  /** Moedas pagas por feito (o Adm ajusta em Moedas e pontos). */
  coin_attended: 1,
  coin_visit: 5,
  coin_deal: 8,
  coin_quote: 3,
  coin_billed: 25,
  coin_shuffled: 1,
  /** Fila de distribuição dos leads encaminhados pelos SDR (1 = ligada). */
  seller_queue_on: 1,
  /** Avisos das negociações (kanban de vendas). */
  deal_new_untouched_hours: 2,
  deal_pool_hours: 1,
  deal_quote_chase_days: 2,
  deal_stale_days: 3,
  deal_followup_days: 2,
  /** Horas até repetir a consulta de um CNPJ que não respondeu. */
  enrich_retry_hours: 6,
  /** Limites dos arquivos enviados. */
  import_max_mb: 8,
  import_max_rows: 20000,
  pdf_max_mb: 5,
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

type Row = { key: string; value: unknown };
const g = globalThis as unknown as { __settingsCache?: { at: number; rows: Row[] } };
const TTL_MS = 5000;

/** Todas as configurações de uma vez, guardadas 5 segundos na memória: quase toda tela lê isso, e a tabela é minúscula. */
export async function settingRows(): Promise<Row[]> {
  const c = g.__settingsCache;
  if (c && Date.now() - c.at < TTL_MS) return c.rows;
  const rows = (await db.select({ key: settings.key, value: settings.value }).from(settings)) as Row[];
  g.__settingsCache = { at: Date.now(), rows };
  return rows;
}
/** Chame depois de gravar qualquer configuração, para esta instância enxergar a mudança na hora. */
export function invalidateSettings() { g.__settingsCache = undefined; }
export async function settingValue<T = unknown>(key: string): Promise<T | undefined> {
  return (await settingRows()).find((r) => r.key === key)?.value as T | undefined;
}

export async function getSettings(database: DbOrTx = db): Promise<Record<SettingKey, number>> {
  const rows = database === db ? await settingRows() : await database.select().from(settings);
  const out = { ...SETTING_DEFAULTS } as Record<SettingKey, number>;
  for (const r of rows) {
    if (r.key in out && typeof r.value === "number") out[r.key as SettingKey] = r.value;
  }
  return out;
}
