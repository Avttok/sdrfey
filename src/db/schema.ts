import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
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
    notes: text("notes"),
    /** Texto da coluna VISITA da planilha antiga. */
    legacyVisit: text("legacy_visit"),

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
    /** Lead de teste (modo teste): nunca entra nas métricas reais. */
    isTest: boolean("is_test").notNull().default(false),
    /** Data combinada para voltar a falar com o lead. */
    returnAt: timestamp("return_at", { withTimezone: true }),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),

    source: text("source"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_eligible_idx").on(t.nextEligibleAt),
    index("leads_locked_idx").on(t.lockedBy),
    index("leads_owner_idx").on(t.ownerId),
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
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index("visits_lead_idx").on(t.leadId)],
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
  (t) => [index("lead_people_lead_idx").on(t.leadId)],
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
    origin: text("origin").$type<"import" | "manual" | "brasilapi" | "receitaws">().notNull().default("manual"),
    wrong: boolean("wrong").notNull().default(false),
    createdAt: now(),
  },
  (t) => [uniqueIndex("lead_channels_uq").on(t.leadId, t.kind, t.value), index("lead_channels_value_idx").on(t.value)],
);

/* ───────────── Atendimento ───────────── */

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
  (t) => [index("interactions_at_idx").on(t.at), index("interactions_user_idx").on(t.userId), index("interactions_lead_idx").on(t.leadId)],
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
  (t) => [index("sessions_user_idx").on(t.userId, t.savedAt), index("sessions_lead_idx").on(t.leadId)],
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

/** Modelos de e-mail gerenciados pelo Adm. Variáveis: {meu_nome} {empresa} {contato|fallback} {cidade} {representante}. */
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: now(),
});
