/** Categorias que o Adm pode apagar de uma vez. Só metadados (a tela e as ações usam a mesma lista). */
export type PurgeKey = "leads" | "deals" | "quotes" | "visits" | "interactions" | "sessions" | "tags" | "channels" | "people" | "chat" | "audit" | "reps" | "products" | "terms" | "liveSnaps" | "enrichLog" | "notifications" | "termSwaps" | "importBatches" | "skips" | "carriers" | "callScripts" | "tasks" | "touches" | "sellerShuffles" | "leadLists" | "leadFacts" | "fieldEvents" | "announcements" | "coins" | "emailTemplates" | "scripts" | "fieldSuggestions";

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
  group: "Clientes" | "Vendas" | "Atendimento" | "Sistema" | "Temporários e histórico técnico";
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
  { key: "carriers", label: "Transportadoras", hint: "A tabela de transportadoras e fretes importada.", test: false, time: true, group: "Vendas" },
  { key: "callScripts", label: "Histórico de roteiros", hint: "Cada roteiro feito numa ligação (caminho, respostas e resultado).", cascade: "As tarefas que esses roteiros criaram continuam; apague em Tarefas se quiser.", test: true, time: true, group: "Atendimento" },
  { key: "tasks", label: "Tarefas", hint: "As tarefas de SDR e Vendas (abertas e feitas).", test: false, time: true, group: "Atendimento" },
  { key: "touches", label: "Contatos registrados (“Como foi?”)", hint: "Cada e-mail, WhatsApp ou ligação com o resultado marcado.", test: true, time: true, group: "Atendimento" },
  { key: "sellerShuffles", label: "Sorteios do Shuffler Vendas", hint: "As passagens dos vendedores pelo Shuffler Vendas.", test: true, time: true, group: "Atendimento" },
  { key: "leadLists", label: "Listas do Lista Flow", hint: "As listas montadas de leads.", cascade: "Os leads continuam cadastrados; só some a lista.", test: false, time: true, group: "Atendimento" },
  { key: "leadFacts", label: "Dados dos leads (preenchidos pelo roteiro)", hint: "Os campos que o roteiro e a equipe preencheram nos leads.", test: false, time: true, group: "Clientes" },
  { key: "fieldEvents", label: "Histórico dos dados dos leads", hint: "O diário de cada mudança nos dados dos leads.", test: true, time: true, group: "Clientes" },
  { key: "announcements", label: "Avisos globais", hint: "Os cards que caem do topo para todos.", test: false, time: true, group: "Sistema" },
  { key: "coins", label: "Moedas e compras da loja", hint: "O extrato de moedas e as compras.", cascade: "Os saldos de todos voltam a zero.", test: false, time: true, group: "Sistema" },
  { key: "emailTemplates", label: "Modelos de e-mail", hint: "Os textos prontos de e-mail.", test: false, time: false, group: "Sistema" },
  { key: "scripts", label: "Roteiros de ligação (os textos)", hint: "Os roteiros criados em Scripts. Dá para restaurar os de fábrica depois.", cascade: "O histórico de roteiros já feitos continua.", test: false, time: false, group: "Sistema" },
  { key: "fieldSuggestions", label: "Sugestões de campos", hint: "Campos novos sugeridos pelos roteiros.", test: false, time: true, group: "Sistema" },
  { key: "chat", label: "Chat", hint: "Todas as mensagens, reações e leituras.", test: false, time: true, group: "Sistema" },
  { key: "audit", label: "Registro de atividades", hint: "O histórico de tudo que mudou no sistema.", cascade: "Perde-se o “quem fez o quê”. Fica só o registro desta exclusão.", test: false, time: true, group: "Sistema" },
  { key: "reps", label: "Representantes", hint: "A lista de representantes (as visitas já guardam uma cópia).", test: false, time: false, group: "Sistema" },
  { key: "products", label: "Catálogo de produtos", hint: "Os produtos lidos das cotações.", test: false, time: false, group: "Sistema" },
  { key: "terms", label: "Condições de pagamento", hint: "A lista de condições de pagamento.", test: false, time: false, group: "Sistema" },
  { key: "liveSnaps", label: "Capturas do Ao vivo", hint: "Imagens das telas que o Adm acompanhou. Ocupam bastante espaço e só servem por alguns minutos.", test: false, time: true, group: "Temporários e histórico técnico" },
  { key: "enrichLog", label: "Histórico de consultas à Receita", hint: "O diário de cada consulta (origem, tempo e resultado). Os dados já gravados nos leads ficam.", test: false, time: true, group: "Temporários e histórico técnico" },
  { key: "notifications", label: "Notificações", hint: "Avisos do sino de todas as pessoas.", test: false, time: true, group: "Temporários e histórico técnico" },
  { key: "termSwaps", label: "Trocas do Glossário (para desfazer)", hint: "Os instantâneos que permitem desfazer uma troca de termo.", cascade: "Depois de apagar não dá mais para desfazer essas trocas. O texto novo continua como está.", test: false, time: true, group: "Temporários e histórico técnico" },
  { key: "importBatches", label: "Histórico de importações", hint: "Quem importou o quê e quando (nome do arquivo e contagens). Nenhum arquivo é guardado.", cascade: "Perde-se a opção de desfazer essas importações.", test: false, time: true, group: "Temporários e histórico técnico" },
  { key: "skips", label: "Leads pulados (vencidos ou todos)", hint: "O “pular” do Shuffler. Apagar libera esses leads para voltarem ao sorteio.", test: false, time: true, group: "Temporários e histórico técnico" },
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
  liveSnaps: { table: "live_snaps", time: "created_at" },
  enrichLog: { table: "enrich_log", time: "at" },
  notifications: { table: "notifications", time: "created_at" },
  termSwaps: { table: "term_swaps", time: "at" },
  importBatches: { table: "import_batches", time: "created_at" },
  skips: { table: "lead_skips", time: "until" },
  carriers: { table: "carriers", time: "created_at" },
  callScripts: { table: "call_scripts", time: "started_at", test: "is_test" },
  tasks: { table: "tasks", time: "created_at" },
  touches: { table: "contact_events", time: "at", test: "is_test" },
  sellerShuffles: { table: "seller_shuffles", time: "shown_at", test: "is_test" },
  leadLists: { table: "lead_lists", time: "created_at" },
  leadFacts: { table: "lead_facts", time: "created_at" },
  fieldEvents: { table: "field_events", time: "created_at", test: "is_test" },
  announcements: { table: "announcements", time: "created_at" },
  coins: { table: "coin_ledger", time: "created_at" },
  emailTemplates: { table: "email_templates" },
  scripts: { table: "scripts" },
  fieldSuggestions: { table: "field_suggestions", time: "created_at" },
};

