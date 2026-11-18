/** Categorias que o Adm pode apagar de uma vez. Só metadados (a tela e as ações usam a mesma lista). */
export type PurgeKey = "leads" | "deals" | "quotes" | "visits" | "interactions" | "sessions" | "tags" | "channels" | "people" | "chat" | "audit" | "reps" | "products" | "terms";

export type PurgeCategory = {
  key: PurgeKey;
  label: string;
  /** O que é apagado. */
  hint: string;
  /** O que some junto (efeito em cascata). */
  cascade?: string;
  /** Aceita "só de teste". */
  test: boolean;
  /** Aceita "anteriores a uma data". */
  time: boolean;
  group: "Clientes" | "Vendas" | "Atendimento" | "Sistema";
};

export const PURGE_CATEGORIES: PurgeCategory[] = [
  { key: "leads", label: "Leads (clientes)", hint: "O cadastro dos leads.", cascade: "Apaga junto tags, contatos, pessoas, visitas, interações, atendimentos e negociações (com cotações) desses leads.", test: true, time: true, group: "Clientes" },
  { key: "channels", label: "Telefones e e-mails", hint: "Os contatos salvos nos leads.", test: true, time: true, group: "Clientes" },
  { key: "people", label: "Pessoas de contato", hint: "As pessoas cadastradas dentro dos leads.", cascade: "Telefones/e-mails delas ficam, sem pessoa.", test: true, time: true, group: "Clientes" },
  { key: "tags", label: "Tags aplicadas", hint: "As tags colocadas nos leads (as tags em si continuam).", test: true, time: true, group: "Clientes" },
  { key: "deals", label: "Negociações", hint: "As negociações dos vendedores.", cascade: "Apaga junto andamentos, cotações e itens. O lead continua cadastrado.", test: true, time: true, group: "Vendas" },
  { key: "quotes", label: "Cotações", hint: "As cotações registradas (e os itens delas).", cascade: "A negociação continua.", test: true, time: true, group: "Vendas" },
  { key: "visits", label: "Visitas", hint: "Visitas agendadas (representantes e vendedores).", test: true, time: true, group: "Vendas" },
  { key: "interactions", label: "Interações", hint: "Cada ligação, WhatsApp ou e-mail registrado.", cascade: "Zera também o realizado das metas de ligações e atendidos.", test: true, time: true, group: "Atendimento" },
  { key: "sessions", label: "Atendimentos (sessões)", hint: "As passagens pelo Shuffler: tempo médio, atendidos e pulados.", test: true, time: true, group: "Atendimento" },
  { key: "chat", label: "Chat", hint: "Todas as mensagens, reações e leituras.", test: false, time: true, group: "Sistema" },
  { key: "audit", label: "Registro de atividades", hint: "O histórico de tudo que mudou no sistema.", cascade: "Perde-se o “quem fez o quê”. Fica só o registro desta exclusão.", test: false, time: true, group: "Sistema" },
  { key: "reps", label: "Representantes", hint: "A lista de representantes (as visitas já guardam uma cópia).", test: false, time: false, group: "Sistema" },
  { key: "products", label: "Catálogo de produtos", hint: "Os produtos lidos das cotações.", test: false, time: false, group: "Sistema" },
  { key: "terms", label: "Condições de pagamento", hint: "A lista de condições de pagamento.", test: false, time: false, group: "Sistema" },
];

export type UserPurgeKey = "interactions" | "sessions" | "visits" | "dealsSdr" | "dealsSeller" | "chat" | "audit";
export const USER_PURGE: { key: UserPurgeKey; label: string; hint: string }[] = [
  { key: "interactions", label: "Interações registradas", hint: "Ligações, WhatsApp e e-mails que a pessoa registrou." },
  { key: "sessions", label: "Atendimentos (sessões)", hint: "As passagens dela pelo Shuffler." },
  { key: "visits", label: "Visitas agendadas", hint: "Visitas que ela agendou." },
  { key: "dealsSdr", label: "Negociações que repassou (como SDR)", hint: "Some da lista dos vendedores, com cotações e andamentos." },
  { key: "dealsSeller", label: "Negociações dela (como vendedor)", hint: "Todas as negociações em que ela é a vendedora." },
  { key: "chat", label: "Mensagens do chat", hint: "Tudo que ela escreveu no chat." },
  { key: "audit", label: "Registro de atividades", hint: "O histórico das ações dela no sistema." },
];

export type RecordKind = "lead" | "deal" | "quote" | "visit" | "interaction" | "session" | "tag" | "channel" | "person" | "chat" | "audit";

export const CONFIRM_WORD = "APAGAR";
export const NUKE_WORD = "ZERAR TUDO";

/** Tabela, coluna de data e como reconhecer o que é de teste. Só texto nosso (nunca vem da tela). */
export const PURGE_SQL: Record<PurgeKey, { table: string; time?: string; test?: string }> = {
  leads: { table: "leads", time: "created_at", test: "is_test" },
  channels: { table: "lead_channels", time: "created_at", test: "lead_id in (select id from leads where is_test)" },
  people: { table: "lead_people", time: "created_at", test: "lead_id in (select id from leads where is_test)" },
  tags: { table: "lead_tags", time: "applied_at", test: "lead_id in (select id from leads where is_test)" },
  deals: { table: "deals", time: "created_at", test: "is_test" },
  quotes: { table: "deal_quotes", time: "created_at", test: "deal_id in (select id from deals where is_test)" },
  visits: { table: "visits", time: "created_at", test: "lead_id in (select id from leads where is_test)" },
  interactions: { table: "interactions", time: "at", test: "is_test" },
  sessions: { table: "attendance_sessions", time: "shown_at", test: "is_test" },
  chat: { table: "chat_messages", time: "created_at" },
  audit: { table: "audit_log", time: "at" },
  reps: { table: "reps" },
  products: { table: "products" },
  terms: { table: "payment_terms" },
};

