import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Role } from "@/config/roles";

const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────── Usuários ───────────── */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  roles: text("roles").array().$type<Role[]>().notNull().default(sql`ARRAY['user']::text[]`),
  /** Chave da cor escolhida (ver config/theme.ts). Nulo = cor padrão do cargo. */
  accent: text("accent"),
  /** Ícone de perfil escolhido (chave de config/avatars.ts). Nulo = iniciais do nome. */
  avatar: text("avatar"),
  /** Padrão do banner do perfil (chave de config/banners.ts). Nulo = padrão. */
  banner: text("banner"),
  /** Já passou uma vez pela tela de personalização do perfil. */
  profileDone: boolean("profile_done").notNull().default(false),
  /** Adm: bloqueia esta pessoa de ganhar moedas / de gastar moedas na loja. */
  coinsEarnBlocked: boolean("coins_earn_blocked").notNull().default(false),
  coinsSpendBlocked: boolean("coins_spend_blocked").notNull().default(false),
  /** Barra de navegação: "top" (horizontal) ou "side" (vertical à esquerda). */
  navLayout: text("nav_layout").notNull().default("top"),
  /** Ligação pelo VocallAgent (EOX): código do agente e ramal desta pessoa. */
  vocallAgentId: text("vocall_agent_id"),
  vocallRamal: text("vocall_ramal"),
  /** Ordem preferida dos itens do menu (hrefs). Vazio = ordem padrão. */
  navOrder: text("nav_order").array().notNull().default(sql`ARRAY[]::text[]`),
  /** Barra lateral recolhida (só ícones). */
  navCollapsed: boolean("nav_collapsed").notNull().default(false),
  /** Como mostrar o local do lead: "map" (mapa do Google) ou "link" (só o link Google Maps). */
  mapMode: text("map_mode").notNull().default("map"),
  /** Fonte preferida (ver config/fonts.ts). */
  font: text("font").notNull().default("archivo"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  active: boolean("active").notNull().default(true),
  /** Gestor responsável. Nulo = visível para todos os gestores. */
  managerId: integer("manager_id"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  /** Aumente para derrubar todas as sessões abertas do usuário. */
  sessionVersion: integer("session_version").notNull().default(1),
  /** Aparece nas métricas (Dashboard, Metas, ranking). Desmarque para contas só administrativas. */
  inMetrics: boolean("in_metrics").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** Meta diária própria. Nulo = usa a meta global. */
  dailyGoal: integer("daily_goal"),
  /** Meta de agendados por dia (nulo = meta global). */
  dailyGoalScheduled: integer("daily_goal_scheduled"),
  /** Metas próprias do vendedor (campos ausentes = meta global). Ver config/seller-goals.ts. */
  /** @deprecated substituídas por sellerGoals (não usadas). */
  sellerGoalContacts: integer("seller_goal_contacts"),
  sellerGoalSales: integer("seller_goal_sales"),
  sellerGoals: jsonb("seller_goals").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  /** Liga/desliga cada meta só para esta pessoa (nulo = segue a global). */
  goalAttendedOn: boolean("goal_attended_on"),
  goalScheduledOn: boolean("goal_scheduled_on"),
  /** Metas extras do SDR (ligações, convertidos) e "desligar todas": calls, calls_on, converted, converted_on, off_all (ausente = herda a global). */
  goalsExtra: jsonb("goals_extra").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  /** Permissão dada pelo Adm: pode alterar metas da equipe. */
  canManageGoals: boolean("can_manage_goals").notNull().default(false),
  /** Ajustes do Adm só para esta pessoa (abas, blocos do painel...). Vazio = usa o padrão do cargo. */
  permissions: jsonb("permissions").$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: now(),
});

/* ───────────── Tags (grupos e valores) ───────────── */

export const tagGroups = pgTable("tag_groups", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  /** Só uma tag do grupo por lead (ex.: temperatura). */
  exclusive: boolean("exclusive").notNull().default(false),
  /** Quem aplica: 'manual', 'auto' ou 'both'. */
  mode: text("mode").$type<"manual" | "auto" | "both">().notNull().default("manual"),
  sort: integer("sort").notNull().default(0),
});

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    groupKey: text("group_key")
      .notNull()
      .references(() => tagGroups.key, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    color: text("color").notNull().default("#64748b"),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /** Lead com essa tag sai do sorteio. */
    blocksSorting: boolean("blocks_sorting").notNull().default(false),
    /** Dias até o lead voltar ao sorteio depois de receber essa tag. Nulo = não volta sozinho. */
    cooldownDays: integer("cooldown_days"),
    /** Só o sistema aplica (ex.: BOT). */
    autoOnly: boolean("auto_only").notNull().default(false),
    /** Ícone da bolha (chave de config/tag-icons). Nulo = o padrão da tag. */
    icon: text("icon"),
    createdAt: now(),
  },
  (t) => [uniqueIndex("tags_group_key_uq").on(t.groupKey, t.key)],
);

/* ───────────── Leads ───────────── */

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    /** Somente os 14 dígitos. */
    cnpj: text("cnpj").notNull().unique(),
    company: text("company").notNull(),
    sapCode: text("sap_code"),
    contactName: text("contact_name"),
    roleTitle: text("role_title"),
    /** Telefones só com dígitos, com DDD. */
    phones: text("phones").array().notNull().default(sql`ARRAY[]::text[]`),
    email: text("email"),
    /** Endereço e dados fiscais, completados por cotações e consultas. */
    address: text("address"),
    neighborhood: text("neighborhood"),
    zip: text("zip"),
    stateReg: text("state_reg"),
    notes: text("notes"),
    /** Texto da coluna VISITA da planilha antiga. */
    legacyVisit: text("legacy_visit"),
    /** Link do perfil do cliente no Salesforce e no CRM (EOX). */
    salesforceUrl: text("salesforce_url"),
    eoxUrl: text("eox_url"),

    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    lockedBy: integer("locked_by").references(() => users.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    timesServed: integer("times_served").notNull().default(0),
    timesWorked: integer("times_worked").notNull().default(0),
    lastServedAt: timestamp("last_served_at", { withTimezone: true }),
    /** Nulo ou no passado = pode ser sorteado. */
    nextEligibleAt: timestamp("next_eligible_at", { withTimezone: true }),

    /** Dados da consulta de CNPJ. */
    city: text("city"),
    uf: text("uf"),
    registrationStatus: text("registration_status"),
    cnpjData: jsonb("cnpj_data"),
    /** Respostas cruas de cada serviço de consulta, guardadas separadas. */
    brasilApiData: jsonb("brasilapi_data"),
    receitaWsData: jsonb("receitaws_data"),
    tradeName: text("trade_name"),
    /** Achados da internet pela consulta: site e Instagram do estabelecimento. */
    site: text("site"),
    instagram: text("instagram"),
    /** Lead de teste (modo teste): nunca entra nas métricas reais. */
    isTest: boolean("is_test").notNull().default(false),
    /** Data combinada para voltar a falar com o lead. */
    returnAt: timestamp("return_at", { withTimezone: true }),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    /** Última tentativa de consulta automática de CNPJ (deu certo ou não): evita insistir no mesmo lead que falha. */
    enrichTriedAt: timestamp("enrich_tried_at", { withTimezone: true }),

    source: text("source"),
    /** Lote de importação que criou o lead (permite desfazer o lote). */
    importBatchId: integer("import_batch_id"),
    /** 'prospect' = lead novo (Shuffler Prospecção). 'inativo' = já cadastrado na Fey (EOX/Salesforce), trabalhado pelos vendedores no Shuffler Vendas. */
    kind: text("kind").$type<"prospect" | "inativo">().notNull().default("prospect"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_kind_idx").on(t.kind),
    index("leads_eligible_idx").on(t.nextEligibleAt),
    index("leads_locked_idx").on(t.lockedBy),
    index("leads_owner_idx").on(t.ownerId),
    index("leads_unenriched_idx").on(t.id).where(sql`not is_test and enriched_at is null`),
    index("leads_uf_idx").on(t.uf),
    // Busca por trecho do nome (ilike '%x%') usa índice de trigramas em vez de varrer a tabela.
    index("leads_company_trgm").using("gin", sql`${t.company} gin_trgm_ops`),
    index("leads_trade_trgm").using("gin", sql`${t.tradeName} gin_trgm_ops`),
    index("leads_city_trgm").using("gin", sql`${t.city} gin_trgm_ops`),
    index("leads_updated_idx").on(t.updatedAt.desc(), t.id.desc()),
    index("leads_return_idx").on(t.returnAt).where(sql`return_at is not null`),
    index("leads_batch_idx").on(t.importBatchId).where(sql`import_batch_id is not null`),
    index("leads_sort_idx").on(t.nextEligibleAt).where(sql`not is_test and locked_by is null`),
  ],
);

export const leadTags = pgTable(
  "lead_tags",
  {
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    appliedBy: integer("applied_by").references(() => users.id, { onDelete: "set null" }),
    source: text("source").$type<"manual" | "auto" | "import">().notNull().default("manual"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.leadId, t.tagId] }), index("lead_tags_tag_idx").on(t.tagId)],
);

/** Visitas de representante agendadas (código vem do Salesforce, ex.: V-12345). */
export const visits = pgTable(
  "visits",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    note: text("note"),
    /** Dia em que a visita vai acontecer (a data em que foi agendada é createdAt). */
    visitDate: date("visit_date"),
    /** Link da visita gerado no Salesforce (opcional). */
    link: text("link"),
    /** Representante mais próximo no momento do agendamento (cópia: não muda se a lista de representantes mudar). */
    repName: text("rep_name"),
    repSap: text("rep_sap"),
    repCity: text("rep_city"),
    repKm: integer("rep_km"),
    /** "rep" = visita de representante; "seller" = visita dos Vendedores SDR (o vendedor entra pelo Salesforce e confirma). */
    kind: text("kind").$type<"rep" | "seller">().notNull().default("rep"),
    /** Vendedor escolhido para a visita (kind = seller); vazio = grupo dos vendedores. */
    sellerId: integer("seller_id").references(() => users.id, { onDelete: "set null" }),
    /** Pública: aparece para todos os usuários, de qualquer cargo, na janela de Visitas. */
    isPublic: boolean("is_public").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    /** Visita de representante leva dias para ser confirmada: pendente → confirmada → realizada (ou cancelada). */
    status: text("status").$type<"pendente" | "confirmada" | "realizada" | "cancelada">().notNull().default("pendente"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: integer("confirmed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [index("visits_lead_idx").on(t.leadId), index("visits_user_idx").on(t.userId, t.createdAt), index("visits_rep_idx").on(t.repSap), index("visits_code_trgm").using("gin", sql`${t.code} gin_trgm_ops`), index("visits_pending_idx").on(t.createdAt).where(sql`status = 'pendente' and canceled_at is null`)],
);

/* ───────────── Representantes e cidades ───────────── */

export const reps = pgTable("reps", {
  id: serial("id").primaryKey(),
  sapCode: text("sap_code").notNull().unique(),
  esc: integer("esc"),
  managerName: text("manager_name"),
  team: text("team"),
  cnpj: text("cnpj"),
  address: text("address"),
  cep: text("cep"),
  city: text("city"),
  uf: text("uf"),
  repName: text("rep_name"),
  active: boolean("active").notNull().default(true),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  createdAt: now(),
});

export const cities = pgTable(
  "cities",
  {
    ibge: integer("ibge").primaryKey(),
    name: text("name").notNull(),
    /** Nome sem acento e em minúsculas, para busca. */
    nameNorm: text("name_norm").notNull(),
    uf: text("uf").notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
  },
  (t) => [index("cities_lookup_idx").on(t.nameNorm, t.uf)],
);

/* ───────────── Configurações e auditoria ───────────── */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
});

/**
 * Registro de TUDO que muda no sistema: quem, quando, o quê e de → para.
 * userId nulo = alteração automática do sistema (BOT).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    userId: integer("user_id"),
    leadId: integer("lead_id"),
    /** 'lead' | 'user' | 'tag' | 'setting' | 'import' ... */
    entity: text("entity").notNull(),
    action: text("action").notNull(),
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    meta: jsonb("meta"),
  },
  (t) => [
    index("audit_at_idx").on(t.at),
    index("audit_lead_idx").on(t.leadId),
    index("audit_user_idx").on(t.userId),
    index("audit_entity_idx").on(t.entity, t.at),
  ],
);

/* ───────────── Contatos do lead: pessoas e canais ───────────── */

export const leadPeople = pgTable(
  "lead_people",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleTitle: text("role_title"),
    extension: text("extension"),
    notes: text("notes"),
    createdAt: now(),
  },
  (t) => [index("lead_people_lead_idx").on(t.leadId), index("lead_people_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`)],
);

/** Telefones e e-mails. Pertencem à empresa (personId nulo) ou a uma pessoa. */
export const leadChannels = pgTable(
  "lead_channels",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    personId: integer("person_id").references(() => leadPeople.id, { onDelete: "set null" }),
    kind: text("kind").$type<"phone" | "email">().notNull(),
    /** Telefone só com dígitos; e-mail em minúsculas. */
    value: text("value").notNull(),
    label: text("label"),
    origin: text("origin").$type<"import" | "manual" | "brasilapi" | "receitaws" | "site" | "google">().notNull().default("manual"),
    wrong: boolean("wrong").notNull().default(false),
    createdAt: now(),
  },
  (t) => [uniqueIndex("lead_channels_uq").on(t.leadId, t.kind, t.value), index("lead_channels_value_idx").on(t.value), index("lead_channels_value_trgm").using("gin", sql`${t.value} gin_trgm_ops`)],
);

/* ───────────── Atendimento ───────────── */

/** Histórico de cada consulta de CNPJ (automática, em lote ou manual): alimenta a tela "Consulta de CNPJ" do Adm. */
export const enrichLog = pgTable(
  "enrich_log",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** lote | cron | manual | auto | novo */
    origin: text("origin").notNull(),
    ok: boolean("ok").notNull(),
    ms: integer("ms").notNull().default(0),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status"),
    phones: integer("phones").notNull().default(0),
    emails: integer("emails").notNull().default(0),
    why: text("why"),
  },
  (t) => [index("enrich_log_at_idx").on(t.at), index("enrich_log_lead_idx").on(t.leadId)],
);

/** Cada contato feito com um lead (ligação, WhatsApp, e-mail...). */
export const interactions = pgTable(
  "interactions",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Chave da tag do grupo "meio". */
    channel: text("channel").notNull(),
    note: text("note"),
    isTest: boolean("is_test").notNull().default(false),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("interactions_at_idx").on(t.at), index("interactions_user_idx").on(t.userId), index("interactions_lead_idx").on(t.leadId, t.at)],
);

/** Uma passada do usuário por um lead: base do tempo médio e da meta. */
export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    shownAt: timestamp("shown_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    /** 'saved' | 'skipped' | 'abandoned' | 'released' */
    outcome: text("outcome"),
    isTest: boolean("is_test").notNull().default(false),
  },
  (t) => [index("sessions_user_idx").on(t.userId, t.savedAt), index("sessions_saved_idx").on(t.savedAt), index("sessions_lead_idx").on(t.leadId, t.userId, t.shownAt)],
);

/** Andamento do roteiro numa ligação: o caminho percorrido, as respostas do lead e as anotações. Aparece no perfil do lead para todos. */
export type CallScriptStep = { id: string; title: string; mood: string; say: string; answer: string | null; kind: "ok" | "objecao" | "neutro" | null };
export const callScripts = pgTable(
  "call_scripts",
  {
    id: serial("id").primaryKey(),
    /** Gerado no navegador ao começar o roteiro: reenviar atualiza a mesma linha. */
    runId: text("run_id").notNull(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scriptId: integer("script_id"),
    scriptTitle: text("script_title").notNull(),
    goal: text("goal").notNull(),
    segment: text("segment").notNull(),
    contactName: text("contact_name"),
    steps: jsonb("steps").$type<CallScriptStep[]>().notNull(),
    notes: jsonb("notes").$type<string[]>().notNull().default([]),
    outcome: text("outcome"),
    finished: boolean("finished").notNull().default(false),
    isTest: boolean("is_test").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("call_scripts_run_uq").on(t.runId), index("call_scripts_lead_idx").on(t.leadId, t.startedAt)],
);

/** Lead pulado: some só para esse usuário até `until`. */
export const leadSkips = pgTable(
  "lead_skips",
  {
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    until: timestamp("until", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.leadId, t.userId] })],
);

/** Quem está online (batimento a cada ~30 s; online se < 90 s). */
export const presence = pgTable("presence", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  activity: text("activity"),
  leadId: integer("lead_id"),
});

/** Fotos comprimidas da tela de quem está sendo observado no Ao vivo: no máximo 10 por pessoa, até 5 minutos. */
export const liveSnaps = pgTable("live_snaps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  image: text("image").notNull(),
  path: text("path"),
  createdAt: now(),
}, (t) => [index("live_snaps_user_idx").on(t.userId, t.id)]);
/** Quem o Adm está olhando agora (a licença vale poucos segundos e é renovada enquanto a janela estiver aberta). */
export const liveWatch = pgTable("live_watch", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  until: timestamp("until", { withTimezone: true }).notNull(),
});

/** Modelos de e-mail gerenciados pelo Adm. Variáveis: {meu_nome} {empresa} {contato|fallback} {cidade} {representante}. */
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  /** Versão com formatação (negrito, cores, imagens). Vazio = só texto. */
  bodyHtml: text("body_html"),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  /** Vazio = modelo global (do Adm, todos usam). Preenchido = modelo pessoal de quem criou. */
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: now(),
});

/** Scripts de ligação: árvore de passos. Global (Adm) ou pessoal. `nodes` é validado em modules/scripts/schema.ts. */
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  /** Vazio = script global. */
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "cascade" }),
  /** Modelos que vêm de fábrica têm uma chave fixa (para não duplicar ao semear). */
  seedKey: text("seed_key").unique(),
  title: text("title").notNull(),
  segment: text("segment").notNull().default("geral"),
  goal: text("goal").$type<"sdr" | "vendas" | "retorno" | "fidelizar">().notNull().default("sdr"),
  summary: text("summary"),
  nodes: jsonb("nodes").$type<unknown>().notNull(),
  startId: text("start_id").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────── Vendas: lead repassado a um vendedor ───────────── */

export const DEAL_STAGES = ["novo", "contato", "cotacao", "negociacao", "ganho", "perdido"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

/**
 * Negociação: nasce quando o SDR repassa um lead aos vendedores. Sem `sellerId` ela está no grupo
 * (qualquer vendedor pode assumir); o SDR também pode já indicar um vendedor.
 */
export const deals = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    /** SDR que repassou. */
    sdrId: integer("sdr_id").references(() => users.id, { onDelete: "set null" }),
    sellerId: integer("seller_id").references(() => users.id, { onDelete: "set null" }),
    stage: text("stage").$type<DealStage>().notNull().default("novo"),
    handoffNote: text("handoff_note"),
    /** Valor da cotação / venda em centavos. */
    valueCents: integer("value_cents"),
    quoteSentAt: timestamp("quote_sent_at", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    /** Próximo passo combinado (gera aviso quando vence). */
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    nextActionNote: text("next_action_note"),
    lostReason: text("lost_reason"),
    /** Dados comerciais, preenchidos pelo vendedor (ou lidos do PDF da cotação). */
    freight: text("freight").$type<"CIF" | "FOB" | "RED">(),
    sapCode: text("sap_code"),
    orderNumber: text("order_number"),
    quoteNumber: text("quote_number"),
    quoteDate: date("quote_date"),
    /** Dia em que a venda foi fechada (pode ser corrigido à mão). */
    closedOn: date("closed_on"),
    /** Valor fechado em centavos. `valueCents` é o valor da cotação. */
    closedValueCents: integer("closed_value_cents"),
    /** Valor real (após impostos): é o que conta na meta do vendedor. */
    realValueCents: integer("real_value_cents"),
    /** Valor sem impostos da última cotação (espelho). */
    netValueCents: integer("net_value_cents"),
    /** Peso (kg) da última cotação; espelhado pelas cotações. */
    weightKg: numeric("weight_kg", { precision: 12, scale: 2, mode: "number" }),
    paymentTerms: text("payment_terms"),
    /** Cor que o vendedor escolheu para reconhecer o cliente (#rrggbb). */
    color: text("color"),
    /** Cliente inativo que voltou a comprar (conta na meta de reativados). */
    isReactivation: boolean("is_reactivation").notNull().default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    isTest: boolean("is_test").notNull().default(false),
    /** Negociação importada que ainda espera a consulta de CNPJ: não aparece no kanban até ser consultada. */
    importPending: boolean("import_pending").notNull().default(false),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deals_lead_idx").on(t.leadId, t.createdAt),
    index("deals_seller_idx").on(t.sellerId, t.stage),
    index("deals_sdr_idx").on(t.sdrId),
    index("deals_updated_idx").on(t.updatedAt),
    index("deals_claimed_idx").on(t.claimedAt),
    uniqueIndex("deals_one_open_per_lead").on(t.leadId).where(sql`stage not in ('ganho','perdido')`),
  ],
);

/** Cada passo da negociação: contato, cotação, anotação, mudança de etapa... */
export const dealEvents = pgTable(
  "deal_events",
  {
    id: serial("id").primaryKey(),
    dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** criado | assumido | ligacao | whatsapp | email | cotacao | nota | etapa | retorno | ganho | perdido | reaberto */
    kind: text("kind").notNull(),
    note: text("note"),
    valueCents: integer("value_cents"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deal_events_deal_idx").on(t.dealId, t.at), index("deal_events_at_idx").on(t.at), index("deal_events_user_idx").on(t.userId, t.at)],
);

/** Cada cotação enviada ao cliente (uma negociação pode ter várias). Os valores da última ficam espelhados na negociação. */
export const dealQuotes = pgTable(
  "deal_quotes",
  {
    id: serial("id").primaryKey(),
    dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
    number: text("number"),
    quoteDate: date("quote_date"),
    /** Total com impostos (IPI e frete). */
    totalCents: integer("total_cents"),
    /** Total dos produtos, sem IPI. */
    productsCents: integer("products_cents"),
    ipiCents: integer("ipi_cents"),
    /** ICMS embutido nos preços dos itens. */
    icmsCents: integer("icms_cents"),
    /** ICMS % digitado nesta cotação (vence a regra do Adm). Vazio = vale a regra. */
    icmsPct: doublePrecision("icms_pct"),
    /** Valor sem impostos: total − IPI − ICMS. É o que vale para o vendedor. */
    netCents: integer("net_cents"),
    freightCents: integer("freight_cents"),
    /** Peso total da cotação em kg (vem do PDF: "Peso Total"). */
    weightKg: numeric("weight_kg", { precision: 12, scale: 2, mode: "number" }),
    freight: text("freight").$type<"CIF" | "FOB" | "RED">(),
    paymentTerms: text("payment_terms"),
    validityDays: integer("validity_days"),
    note: text("note"),
    /** Link da cotação no Salesforce. */
    link: text("link"),
    /** Como a cotação terminou: 'faturado' (virou a venda) ou 'perdido'. Nulo = ainda em aberto. */
    outcome: text("outcome").$type<"faturado" | "perdido">(),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deal_quotes_deal_idx").on(t.dealId), uniqueIndex("deal_quotes_number_uq").on(t.dealId, t.number).where(sql`number is not null`)],
);

/** Condições de pagamento: preenchidas sozinhas pelos PDFs lidos; o Adm edita a lista. */
export const paymentTerms = pgTable("payment_terms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: now(),
});

/** Catálogo de produtos: cresce a cada item lido ou digitado nas cotações. */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    description: text("description").notNull(),
    kind: text("kind"),
    unit: text("unit"),
    /** Último preço unitário visto (centavos). */
    lastUnitCents: integer("last_unit_cents"),
    /** Peso de uma unidade vendida, em kg (opcional; o Adm preenche no catálogo). */
    weightKg: numeric("weight_kg", { precision: 12, scale: 4, mode: "number" }),
    seenCount: integer("seen_count").notNull().default(1),
    /** Outros códigos do mesmo produto, usados por outras empresas/distribuidores: o cliente pode trazer qualquer um deles. */
    altCodes: text("alt_codes").array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_desc_idx").on(t.description)],
);

/** Itens lidos da cotação (produto, descrição, tipo, quantidade e valores). O PDF em si não é guardado. */
export const dealQuoteItems = pgTable(
  "deal_quote_items",
  {
    id: serial("id").primaryKey(),
    dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
    quoteNumber: text("quote_number"),
    /** Cotação a que o item pertence. */
    quoteId: integer("quote_id").references(() => dealQuotes.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    productCode: text("product_code").notNull(),
    /** Código/observação do cliente que vem junto (ex.: "CLASSE 8 POLIDA"). */
    clientRef: text("client_ref"),
    description: text("description").notNull(),
    /** Tipo do item: primeira palavra da descrição (PARAFUSO, PORCA, ARRUELA…). */
    kind: text("kind"),
    qty: numeric("qty", { precision: 12, scale: 2, mode: "number" }).notNull(),
    packQty: numeric("pack_qty", { precision: 12, scale: 2, mode: "number" }),
    unit: text("unit"),
    icmsCents: integer("icms_cents"),
    ipiCents: integer("ipi_cents"),
    unitCents: integer("unit_cents"),
    totalCents: integer("total_cents"),
  },
  (t) => [index("deal_quote_items_deal_idx").on(t.dealId), index("deal_quote_items_quote_idx").on(t.quoteId)],
);

/** Chat interno. Canais: geral, user (SDR), seller (vendedores), manager (gestores). */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    channel: text("channel").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull().default(""),
    /** Item compartilhado: lead (cliente), deal (negociação) ou quote (cotação). */
    shareKind: text("share_kind").$type<"lead" | "deal" | "quote">(),
    shareId: integer("share_id"),
    shareLabel: text("share_label"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index("chat_messages_channel_idx").on(t.channel, t.id), index("chat_messages_user_idx").on(t.userId)],
);

/** Até onde cada pessoa já leu em cada canal (para o aviso de não lidas). */
export const chatReads = pgTable(
  "chat_reads",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    lastId: integer("last_id").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channel] })],
);

/** Reações às mensagens do chat (um emoji por pessoa e mensagem). */
export const chatReactions = pgTable(
  "chat_reactions",
  {
    messageId: integer("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] }), index("chat_reactions_user_idx").on(t.userId)],
);

/** Passagens do vendedor pelo Shuffler Vendas (leads inativos). Separado do atendimento do SDR para não misturar métricas. */
export const sellerShuffles = pgTable(
  "seller_shuffles",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    shownAt: timestamp("shown_at", { withTimezone: true }).notNull().defaultNow(),
    /** 'deal' | 'no_answer' | 'no_interest' | 'skipped' | 'released' ; nulo = em aberto. */
    outcome: text("outcome"),
    note: text("note"),
    dealId: integer("deal_id"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    isTest: boolean("is_test").notNull().default(false),
  },
  (t) => [index("seller_shuffles_user_idx").on(t.userId, t.doneAt), index("seller_shuffles_lead_idx").on(t.leadId)],
);

/** Conquistas dadas ou bloqueadas à mão pelo Adm. Sem linha = vale a estatística. */
export const achievementOverrides = pgTable(
  "achievement_overrides",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    granted: boolean("granted").notNull(),
    by: integer("by").references(() => users.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/* ───────────── Moedas e loja ───────────── */

/** Extrato de moedas. `ref` identifica a origem (ex.: "att:123"), o que impede pagar duas vezes pelo mesmo feito. */
export const coinLedger = pgTable(
  "coin_ledger",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    ref: text("ref"),
    createdAt: now(),
  },
  (t) => [uniqueIndex("coin_ledger_ref_idx").on(t.userId, t.ref), index("coin_ledger_user_idx").on(t.userId, t.id)],
);

/** Itens da loja que a pessoa já comprou. */
export const shopPurchases = pgTable(
  "shop_purchases",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    price: integer("price").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemKey] })],
);

/** O que a pessoa está usando no chat: { font, color, effect, bubble } com chaves de itens comprados. */
export const chatStyles = pgTable("chat_styles", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  equipped: jsonb("equipped").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
});

/** Marcações com @usuario no chat. `notifiedAt` nulo = a pessoa ainda não recebeu o aviso na tela. */
export const chatMentions = pgTable(
  "chat_mentions",
  {
    messageId: integer("message_id").notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] }), index("chat_mentions_pending_idx").on(t.userId, t.notifiedAt)],
);

/** Histórico de importações de CSV (leads, representantes e negociações). Só os lotes de leads podem ser desfeitos. */
export const importBatches = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  kind: text("kind").$type<"leads" | "inativos" | "reps" | "deals" | "carriers">().notNull(),
  fileName: text("file_name").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  total: integer("total").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  undoneCount: integer("undone_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Listas de leads montadas no Lista Flow. Uma ativa por pessoa e área: o Shuffler mostra o botão "Sortear da lista". */
export const leadLists = pgTable("lead_lists", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("sdr"), // sdr | vendas
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Transportadoras: por estado e tipo de frete (CIF/FOB/RED), com % de frete e prazo na capital e no interior. */
export const carriers = pgTable(
  "carriers",
  {
    id: serial("id").primaryKey(),
    uf: text("uf").notNull(),
    mode: text("mode").notNull(), // CIF | FOB | RED
    name: text("name").notNull(),
    capitalPct: doublePrecision("capital_pct"),
    interiorPct: doublePrecision("interior_pct"),
    capitalDays: integer("capital_days"),
    interiorDays: integer("interior_days"),
    /** Frete mínimo por pedido (centavos), se a transportadora cobra. */
    minCents: integer("min_cents"),
    contact: text("contact"),
    note: text("note"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("carriers_uf_mode_name").on(t.uf, t.mode, t.name)],
);

/** Avisos globais do Adm: caem do topo da tela de todo mundo (ou de quem tem o cargo escolhido) e sempre podem ser fechados. */
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  theme: text("theme").notNull().default("aviso"), // urgente | atencao | aviso | sucesso | novidade
  effect: text("effect").notNull().default("auto"), // auto | none | pulse | shake | shine
  /** Cargos que veem o aviso (vazio = todos). */
  roles: text("roles").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sino de notificações: tarefas, menções, repasses, metas, conquistas… Cada pessoa vê as suas. */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // mencao | negociacao | meta | conquista | visita | sistema | moedas
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

/** Nomenclatura dos produtos: sigla → significado (NYL = Nylon, AC = Aço Carbono…). O Adm edita; siglas novas aparecem para ele definir. */
export const productTerms = pgTable("product_terms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // sempre maiúsculo
  meaning: text("meaning").notNull(),
  /** Grupo da classificação: Material, Rosca, Cabeça, Acabamento, Tipo… */
  category: text("category").notNull().default("Outros"),
  note: text("note"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Mural de post-its de quem encontrou o segredo ("Estive aqui"): um por pessoa. */
export const eggNotes = pgTable("egg_notes", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  color: text("color").notNull().default("amarelo"),
  sticker: text("sticker").notNull().default("estrela"),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Trocas de termo feitas no banco (Glossário → "Trocar termo no banco"): guarda o antes e o depois de cada linha para poder desfazer. */
export const termSwaps = pgTable("term_swaps", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  from: text("from_text").notNull(),
  to: text("to_text").notNull(),
  matchCase: boolean("match_case").notNull().default(false),
  wholeWord: boolean("whole_word").notNull().default(false),
  /** [{ t: alvo, id, old, neu }] — só as linhas que mudaram. */
  changes: jsonb("changes").$type<{ t: string; id: string | number; old: unknown; neu: unknown }[]>().notNull(),
  rows: integer("rows").notNull().default(0),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
});
