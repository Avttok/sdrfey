/**
 * Central de exportação: o que dá para exportar (tabelas, colunas e filtros). É só descrição, sem SQL:
 * o servidor monta a consulta em `modules/export/sql.ts` e um teste confere que as duas listas andam juntas.
 */
export type ExKind = "text" | "int" | "money" | "date" | "datetime" | "bool";
export type ExCol = { key: string; label: string; group: string; kind?: ExKind; /** Em quais modelos de colunas entra */ preset?: ("basic" | "contact")[] };
export type ExFilterType = "multi" | "tri" | "date" | "num" | "text";
/** `dyn` = as opções vêm do banco (UF, pessoas, tags…). */
export type ExFilter = { key: string; label: string; type: ExFilterType; group: string; options?: { value: string; label: string }[]; dyn?: "uf" | "cadStatus" | "tags" | "users" | "sellers" | "channels" | "outcomes" | "visitStatus" | "origins" | "entities" | "sources"; hint?: string; unit?: string };
export type ExDataset = { key: ExDatasetKey; label: string; hint: string; icon: "users" | "handshake" | "calendar" | "phone" | "play" | "map" | "shield" | "scroll" | "radar"; columns: ExCol[]; filters: ExFilter[]; dateField: string };

export const EX_DATASETS_KEYS = ["leads", "negociacoes", "visitas", "interacoes", "atendimentos", "representantes", "usuarios", "registro", "consultas"] as const;
export type ExDatasetKey = (typeof EX_DATASETS_KEYS)[number];

export const EX_FORMATS = [
  { key: "xlsx", label: "Planilha Excel (.xlsx)", hint: "Colunas formatadas, filtro nos títulos e uma aba com os filtros usados." },
  { key: "csv", label: "CSV para Excel Brasil", hint: "Separado por ponto e vírgula, abre direto no Excel em português." },
  { key: "csv_comma", label: "CSV padrão (vírgula)", hint: "Para Google Planilhas e outros sistemas." },
  { key: "pdf", label: "PDF (.pdf)", hint: "Para imprimir ou apresentar. Até 5.000 linhas, com as colunas divididas em faixas se não couberem." },
  { key: "json", label: "JSON", hint: "Para quem vai importar em outro sistema." },
] as const;
export type ExFormat = (typeof EX_FORMATS)[number]["key"];

const c = (group: string, key: string, label: string, kind: ExKind = "text", preset?: ExCol["preset"]): ExCol => ({ group, key, label, kind, preset });
const TRI = [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }];
const f = (group: string, key: string, label: string, type: ExFilterType, extra: Partial<ExFilter> = {}): ExFilter => ({ group, key, label, type, ...extra });

export const EX_DATASETS: ExDataset[] = [
  {
    key: "leads", label: "Leads", icon: "users", dateField: "Cadastrado em",
    hint: "A base de leads com contatos, Receita, internet, tags e andamento. Escolha as colunas e filtre como quiser.",
    columns: [
      c("Identificação", "cnpj", "CNPJ", "text", ["basic", "contact"]), c("Identificação", "company", "Empresa", "text", ["basic", "contact"]), c("Identificação", "trade_name", "Nome fantasia", "text", ["basic"]),
      c("Identificação", "legal_name", "Razão social (Receita)"), c("Identificação", "sap_code", "Código SAP"), c("Identificação", "kind", "Tipo (Novo/Inativo)", "text", ["basic"]), c("Identificação", "id", "ID interno", "int"),
      c("Contato", "contact_name", "Contato", "text", ["contact"]), c("Contato", "role_title", "Cargo", "text", ["contact"]),
      c("Contato", "phones", "Telefones", "text", ["basic", "contact"]), c("Contato", "phone_main", "Telefone principal"), c("Contato", "emails", "E-mails", "text", ["basic", "contact"]), c("Contato", "email_main", "E-mail principal"),
      c("Local", "address", "Endereço"), c("Local", "neighborhood", "Bairro"), c("Local", "zip", "CEP"), c("Local", "city", "Cidade", "text", ["basic", "contact"]), c("Local", "uf", "UF", "text", ["basic", "contact"]), c("Local", "state_reg", "Inscrição estadual"),
      c("Receita", "registration_status", "Situação cadastral", "text", ["basic"]), c("Receita", "cnae", "Atividade (CNAE)"), c("Receita", "capital_social", "Capital social (R$)", "money"), c("Receita", "opened_at", "Abertura da empresa", "date"), c("Receita", "partners", "Sócios"),
      c("Internet", "site", "Site", "text", ["contact"]), c("Internet", "instagram", "Instagram", "text", ["contact"]), c("Internet", "facebook", "Facebook"), c("Internet", "linkedin", "LinkedIn"),
      c("Classificação", "tag_interest", "Interesse", "text", ["basic"]), c("Classificação", "tag_channel", "Meio"), c("Classificação", "qualified", "Qualificado"), c("Classificação", "tag_situation", "Situação (tags)", "text", ["basic"]), c("Classificação", "tag_size", "Porte"), c("Classificação", "tag_capital", "Faixa de capital"), c("Classificação", "all_tags", "Todas as tags"),
      c("Andamento", "owner", "SDR responsável"), c("Andamento", "times_served", "Vezes sorteado", "int"), c("Andamento", "times_worked", "Vezes trabalhado", "int"), c("Andamento", "interactions", "Nº de contatos registrados", "int"), c("Andamento", "last_interaction", "Último contato", "datetime"),
      c("Andamento", "scheduled", "Visita agendada"), c("Andamento", "visit_codes", "Códigos de visita"), c("Andamento", "open_deal", "Negociação aberta"), c("Andamento", "deals_count", "Nº de negociações", "int"), c("Andamento", "notes", "Observações"),
      c("Datas e origem", "created_at", "Cadastrado em", "datetime"), c("Datas e origem", "updated_at", "Atualizado em", "datetime"), c("Datas e origem", "enriched_at", "Consultado na Receita em", "datetime"), c("Datas e origem", "source", "Origem da importação"),
    ],
    filters: [
      f("Quem é", "kind", "Tipo de lead", "multi", { options: [{ value: "prospect", label: "Novos (Prospecção)" }, { value: "inativo", label: "Inativos (Vendas)" }] }),
      f("Quem é", "search", "Busca (empresa, CNPJ, contato, SAP)", "text"),
      f("Local", "uf", "Estado (UF)", "multi", { dyn: "uf" }),
      f("Local", "city", "Cidade contém", "text"),
      f("Receita", "cadStatus", "Situação cadastral", "multi", { dyn: "cadStatus" }),
      f("Receita", "enriched", "Já consultado na Receita", "tri"),
      f("Receita", "enrichedAt", "Consultado entre", "date"),
      f("Tags", "tags", "Tem alguma destas tags", "multi", { dyn: "tags", hint: "Basta ter uma delas." }),
      f("Tags", "tagsAll", "Tem todas estas tags", "multi", { dyn: "tags", hint: "Precisa ter todas." }),
      f("Contato", "hasPhone", "Tem telefone", "tri"),
      f("Contato", "hasEmail", "Tem e-mail", "tri"),
      f("Contato", "hasContact", "Tem nome de contato", "tri"),
      f("Contato", "hasSite", "Tem site ou rede social", "tri"),
      f("Andamento", "owner", "SDR responsável", "multi", { dyn: "users" }),
      f("Andamento", "scheduled", "Com visita agendada", "tri"),
      f("Andamento", "openDeal", "Com negociação aberta", "tri"),
      f("Andamento", "worked", "Já foi trabalhado", "tri"),
      f("Andamento", "served", "Vezes sorteado", "num", { unit: "vezes" }),
      f("Origem", "source", "Origem da importação", "multi", { dyn: "sources" }),
      f("Datas", "createdAt", "Cadastrado entre", "date"),
      f("Datas", "updatedAt", "Atualizado entre", "date"),
    ],
  },
  {
    key: "negociacoes", label: "Negociações", icon: "handshake", dateField: "Aberta em",
    hint: "Tudo o que os SDRs repassaram aos vendedores: etapa, valores, cotações, pedidos e prazos.",
    columns: [
      c("Cliente", "cnpj", "CNPJ", "text", ["basic", "contact"]), c("Cliente", "company", "Empresa", "text", ["basic", "contact"]), c("Cliente", "city", "Cidade", "text", ["basic"]), c("Cliente", "uf", "UF", "text", ["basic"]), c("Cliente", "contact_name", "Contato", "text", ["contact"]), c("Cliente", "phones", "Telefones", "text", ["contact"]), c("Cliente", "emails", "E-mails", "text", ["contact"]),
      c("Negociação", "id", "ID", "int"), c("Negociação", "stage", "Etapa", "text", ["basic"]), c("Negociação", "sdr", "SDR", "text", ["basic"]), c("Negociação", "seller", "Vendedor", "text", ["basic"]), c("Negociação", "is_reactivation", "Cliente reativado"), c("Negociação", "handoff_note", "Anotação do SDR"), c("Negociação", "lost_reason", "Motivo da perda"),
      c("Valores", "value", "Valor da cotação (R$)", "money", ["basic"]), c("Valores", "closed_value", "Valor fechado (R$)", "money"), c("Valores", "real_value", "Valor real (R$)", "money"), c("Valores", "net_value", "Valor líquido (R$)", "money"), c("Valores", "weight_kg", "Peso (kg)", "int"),
      c("Documentos", "quote_number", "Nº da cotação"), c("Documentos", "quote_date", "Data da cotação", "date"), c("Documentos", "order_number", "Nº do pedido"), c("Documentos", "sap_code", "Código SAP"), c("Documentos", "freight", "Frete"), c("Documentos", "payment_terms", "Condição de pagamento"),
      c("Prazos", "created_at", "Aberta em", "datetime", ["basic"]), c("Prazos", "claimed_at", "Assumida em", "datetime"), c("Prazos", "last_contact_at", "Último contato", "datetime"), c("Prazos", "next_action_at", "Próxima ação em", "datetime"), c("Prazos", "next_action_note", "Próxima ação"), c("Prazos", "closed_on", "Fechada no dia", "date", ["basic"]), c("Prazos", "closed_at", "Encerrada em", "datetime"),
    ],
    filters: [
      f("Andamento", "stage", "Etapa", "multi", { options: [{ value: "novo", label: "Novo" }, { value: "contato", label: "Em contato" }, { value: "cotacao", label: "Cotação enviada" }, { value: "negociacao", label: "Negociando" }, { value: "ganho", label: "Faturado" }, { value: "perdido", label: "Perdida" }] }),
      f("Andamento", "open", "Situação", "tri", { hint: "“Sim” = só abertas." }),
      f("Pessoas", "seller", "Vendedor", "multi", { dyn: "sellers" }),
      f("Pessoas", "sdr", "SDR", "multi", { dyn: "users" }),
      f("Pessoas", "noSeller", "Já tem vendedor", "tri"),
      f("Cliente", "uf", "Estado (UF)", "multi", { dyn: "uf" }),
      f("Cliente", "search", "Busca (empresa, CNPJ, cotação, pedido)", "text"),
      f("Cliente", "reactivation", "Cliente reativado", "tri"),
      f("Valores", "value", "Valor da cotação", "num", { unit: "R$" }),
      f("Datas", "createdAt", "Aberta entre", "date"), f("Datas", "closedOn", "Fechada entre", "date"), f("Datas", "quoteDate", "Cotação entre", "date"),
    ],
  },
  {
    key: "visitas", label: "Visitas", icon: "calendar", dateField: "Data da visita",
    hint: "As visitas agendadas com o representante ou o vendedor, com status e quem marcou.",
    columns: [
      c("Visita", "code", "Código", "text", ["basic", "contact"]), c("Visita", "visit_date", "Data da visita", "date", ["basic"]), c("Visita", "status", "Status", "text", ["basic"]), c("Visita", "kind", "Quem visita (Rep/Vendedor)"), c("Visita", "canceled", "Cancelada"), c("Visita", "note", "Anotação"), c("Visita", "link", "Link"),
      c("Cliente", "cnpj", "CNPJ", "text", ["basic", "contact"]), c("Cliente", "company", "Empresa", "text", ["basic", "contact"]), c("Cliente", "city", "Cidade", "text", ["basic"]), c("Cliente", "uf", "UF", "text", ["basic"]), c("Cliente", "contact_name", "Contato", "text", ["contact"]), c("Cliente", "phones", "Telefones", "text", ["contact"]),
      c("Responsáveis", "sdr", "SDR que agendou", "text", ["basic"]), c("Responsáveis", "seller", "Vendedor"), c("Responsáveis", "rep_name", "Representante"), c("Responsáveis", "rep_sap", "SAP do representante"), c("Responsáveis", "rep_city", "Cidade do representante"), c("Responsáveis", "rep_km", "Distância (km)", "int"),
      c("Datas", "created_at", "Agendada em", "datetime"), c("Datas", "confirmed_at", "Confirmada em", "datetime"), c("Datas", "canceled_at", "Cancelada em", "datetime"),
    ],
    filters: [
      f("Visita", "status", "Status", "multi", { options: [{ value: "pendente", label: "Pendente" }, { value: "confirmada", label: "Confirmada" }, { value: "realizada", label: "Realizada" }, { value: "cancelada", label: "Cancelada" }] }),
      f("Visita", "kind", "Quem visita", "multi", { options: [{ value: "rep", label: "Representante" }, { value: "seller", label: "Vendedor" }] }),
      f("Visita", "canceled", "Cancelada", "tri"),
      f("Pessoas", "sdr", "SDR que agendou", "multi", { dyn: "users" }), f("Pessoas", "seller", "Vendedor", "multi", { dyn: "sellers" }),
      f("Cliente", "uf", "Estado (UF)", "multi", { dyn: "uf" }), f("Cliente", "search", "Busca (empresa, CNPJ, código, representante)", "text"),
      f("Datas", "visitDate", "Visita entre", "date"), f("Datas", "createdAt", "Agendada entre", "date"),
    ],
  },
  {
    key: "interacoes", label: "Contatos registrados", icon: "phone", dateField: "Quando",
    hint: "Cada ligação, WhatsApp ou e-mail que a equipe registrou, com a anotação.",
    columns: [
      c("Contato", "at", "Quando", "datetime", ["basic", "contact"]), c("Contato", "user", "Quem", "text", ["basic", "contact"]), c("Contato", "channel", "Meio", "text", ["basic", "contact"]), c("Contato", "note", "Anotação", "text", ["basic", "contact"]),
      c("Cliente", "cnpj", "CNPJ", "text", ["basic"]), c("Cliente", "company", "Empresa", "text", ["basic"]), c("Cliente", "city", "Cidade"), c("Cliente", "uf", "UF"),
    ],
    filters: [
      f("Contato", "user", "Quem registrou", "multi", { dyn: "users" }), f("Contato", "channel", "Meio", "multi", { dyn: "channels" }), f("Contato", "hasNote", "Tem anotação", "tri"),
      f("Cliente", "uf", "Estado (UF)", "multi", { dyn: "uf" }), f("Cliente", "search", "Busca (empresa, CNPJ, anotação)", "text"),
      f("Datas", "at", "Registrado entre", "date"),
    ],
  },
  {
    key: "atendimentos", label: "Atendimentos (Shuffler)", icon: "play", dateField: "Salvo em",
    hint: "Cada passagem de um lead pelo Shuffler Prospecção: tempo gasto e resultado.",
    columns: [
      c("Atendimento", "user", "Quem", "text", ["basic", "contact"]), c("Atendimento", "outcome", "Resultado", "text", ["basic", "contact"]), c("Atendimento", "shown_at", "Sorteado em", "datetime", ["basic"]), c("Atendimento", "started_at", "Iniciado em", "datetime"), c("Atendimento", "saved_at", "Salvo em", "datetime", ["basic"]), c("Atendimento", "minutes", "Duração (min)", "int", ["basic"]),
      c("Cliente", "cnpj", "CNPJ", "text", ["basic"]), c("Cliente", "company", "Empresa", "text", ["basic"]), c("Cliente", "city", "Cidade"), c("Cliente", "uf", "UF"),
    ],
    filters: [
      f("Atendimento", "user", "Quem atendeu", "multi", { dyn: "users" }), f("Atendimento", "outcome", "Resultado", "multi", { dyn: "outcomes" }),
      f("Cliente", "uf", "Estado (UF)", "multi", { dyn: "uf" }), f("Cliente", "search", "Busca (empresa, CNPJ)", "text"),
      f("Datas", "savedAt", "Salvo entre", "date"), f("Datas", "minutes", "Duração", "num", { unit: "min" }),
    ],
  },
  {
    key: "representantes", label: "Representantes", icon: "map", dateField: "Cadastro",
    hint: "Representantes, gestores e equipes, com cidade e SAP.",
    columns: [c("Representante", "rep_name", "Representante", "text", ["basic", "contact"]), c("Representante", "sap_code", "SAP", "text", ["basic", "contact"]), c("Representante", "cnpj", "CNPJ", "text", ["basic"]), c("Representante", "esc", "ESC", "int", ["basic"]), c("Representante", "manager_name", "Gestor", "text", ["basic"]), c("Representante", "team", "Equipe", "text", ["basic"]), c("Local", "address", "Endereço"), c("Local", "cep", "CEP"), c("Local", "city", "Cidade", "text", ["basic", "contact"]), c("Local", "uf", "UF", "text", ["basic", "contact"]), c("Situação", "active", "Ativo", "text", ["basic"])],
    filters: [f("Local", "uf", "Estado (UF)", "multi", { dyn: "uf" }), f("Local", "city", "Cidade contém", "text"), f("Representante", "active", "Ativo", "tri"), f("Representante", "search", "Busca (nome, SAP, CNPJ, gestor)", "text")],
  },
  {
    key: "usuarios", label: "Equipe", icon: "shield", dateField: "Criada em",
    hint: "Contas, cargos e metas. Nunca inclui senhas.",
    columns: [c("Conta", "username", "Usuário", "text", ["basic", "contact"]), c("Conta", "name", "Nome", "text", ["basic", "contact"]), c("Conta", "roles", "Cargos", "text", ["basic"]), c("Conta", "active", "Ativa", "text", ["basic"]), c("Conta", "created_at", "Criada em", "datetime"), c("Metas", "daily_goal", "Meta de atendidos", "int"), c("Metas", "daily_goal_scheduled", "Meta de agendados", "int")],
    filters: [f("Conta", "role", "Cargo", "multi", { options: [{ value: "user", label: "SDR" }, { value: "seller", label: "Vendas" }, { value: "manager", label: "Gestor" }, { value: "admin", label: "Adm" }] }), f("Conta", "active", "Ativa", "tri")],
  },
  {
    key: "registro", label: "Registro de atividades", icon: "scroll", dateField: "Quando",
    hint: "O histórico de tudo que mudou no sistema: quem, quando, o quê e de → para.",
    columns: [c("Registro", "at", "Quando", "datetime", ["basic", "contact"]), c("Registro", "who", "Quem", "text", ["basic", "contact"]), c("Registro", "entity", "Tipo", "text", ["basic"]), c("Registro", "action", "Ação", "text", ["basic", "contact"]), c("Registro", "field", "Campo", "text", ["basic"]), c("Registro", "old_value", "De", "text", ["basic"]), c("Registro", "new_value", "Para", "text", ["basic"]), c("Cliente", "cnpj", "CNPJ"), c("Cliente", "company", "Empresa")],
    filters: [f("Registro", "user", "Quem fez", "multi", { dyn: "users" }), f("Registro", "entity", "Tipo", "multi", { dyn: "entities" }), f("Registro", "search", "Busca (ação, campo, valores)", "text"), f("Datas", "at", "Entre", "date")],
  },
  {
    key: "consultas", label: "Consultas de CNPJ", icon: "radar", dateField: "Quando",
    hint: "O histórico das consultas à Receita: quando, por onde, se deu certo e o que trouxe.",
    columns: [c("Consulta", "at", "Quando", "datetime", ["basic", "contact"]), c("Consulta", "origin", "Origem", "text", ["basic"]), c("Consulta", "ok", "Deu certo", "text", ["basic", "contact"]), c("Consulta", "ms", "Tempo (ms)", "int"), c("Consulta", "status", "Situação", "text", ["basic"]), c("Consulta", "phones", "Telefones novos", "int", ["basic"]), c("Consulta", "emails", "E-mails novos", "int", ["basic"]), c("Consulta", "why", "Motivo da falha"), c("Cliente", "cnpj", "CNPJ", "text", ["basic"]), c("Cliente", "company", "Empresa", "text", ["basic"])],
    filters: [f("Consulta", "origin", "Origem", "multi", { dyn: "origins" }), f("Consulta", "ok", "Deu certo", "tri"), f("Datas", "at", "Entre", "date")],
  },
];
export const EX_BY_KEY = new Map(EX_DATASETS.map((d) => [d.key, d]));

/** Pedido de exportação (o que a tela envia). */
export type ExRequest = { dataset: ExDatasetKey; columns: string[]; filters: Record<string, unknown>; format: ExFormat; /** ordem: coluna e sentido */ sort?: { key: string; dir: "asc" | "desc" } | null; limit?: number | null };
export type ExRange = { from?: string; to?: string };
export type ExNum = { min?: number; max?: number };
export const EX_MAX_ROWS = 300_000;
