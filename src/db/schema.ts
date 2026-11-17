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
  /** Barra de navegação: "top" (horizontal) ou "side" (vertical à esquerda). */
  navLayout: text("nav_layout").notNull().default("top"),
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
    /** Dia em que a visita vai acontecer (a data em que foi agendada é createdAt). */
    visitDate: date("visit_date"),
    /** Link da visita gerado no Salesforce (opcional). */
    link: text("link"),
    /** Representante mais próximo no momento do agendamento (cópia: não muda se a lista de representantes mudar). */
    repName: text("rep_name"),
    repSap: text("rep_sap"),
    repCity: text("rep_city"),
    repKm: integer("rep_km"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    /** Visita de representante leva dias para ser confirmada: pendente → confirmada → realizada (ou cancelada). */
    status: text("status").$type<"pendente" | "confirmada" | "realizada" | "cancelada">().notNull().default("pendente"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: integer("confirmed_by").references(() => users.id, { onDelete: "set null" }),
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
  /** Versão com formatação (negrito, cores, imagens). Vazio = só texto. */
  bodyHtml: text("body_html"),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: now(),
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
    paymentTerms: text("payment_terms"),
    /** Cor que o vendedor escolheu para reconhecer o cliente (#rrggbb). */
    color: text("color"),
    /** Cliente inativo que voltou a comprar (conta na meta de reativados). */
    isReactivation: boolean("is_reactivation").notNull().default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deals_lead_idx").on(t.leadId),
    index("deals_seller_idx").on(t.sellerId, t.stage),
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
  (t) => [index("deal_events_deal_idx").on(t.dealId), index("deal_events_at_idx").on(t.at)],
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
    /** Valor sem impostos: total − IPI − ICMS. É o que vale para o vendedor. */
    netCents: integer("net_cents"),
    freightCents: integer("freight_cents"),
    freight: text("freight").$type<"CIF" | "FOB" | "RED">(),
    paymentTerms: text("payment_terms"),
    validityDays: integer("validity_days"),
    note: text("note"),
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
    seenCount: integer("seen_count").notNull().default(1),
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
  (t) => [index("deal_quote_items_deal_idx").on(t.dealId)],
);
