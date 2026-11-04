/**
 * Catálogo inicial de tags. É gravado no banco no primeiro deploy e NUNCA sobrescreve
 * o que você alterar depois. Situações novas podem ser criadas pelo Adm sem mexer aqui.
 */

export type TagGroupSeed = {
  key: string;
  name: string;
  exclusive: boolean;
  mode: "manual" | "auto" | "both";
  tags: TagSeed[];
};

export type TagSeed = {
  key: string;
  label: string;
  color: string;
  blocksSorting?: boolean;
  cooldownDays?: number;
  autoOnly?: boolean;
};

/** Chaves usadas pela lógica do sistema (evita texto solto espalhado pelo código). */
export const TAG = {
  group: {
    temperatura: "temperatura",
    meio: "meio",
    qualificacao: "qualificacao",
    agenda: "agenda",
    situacao: "situacao",
    porte: "porte",
    capital: "capital",
  },
  bot: "bot",
  agendado: "agendado",
  qualificado: "qualificado",
  desqualificado: "desqualificado",
  autoDescarte: "auto_descarte",
  semContato: "sem_contato",
  contabilidade: "contabilidade",
  cliente: "cliente",
} as const;

export const TAG_GROUPS_SEED: TagGroupSeed[] = [
  {
    key: "temperatura",
    name: "Temperatura",
    exclusive: true,
    mode: "manual",
    tags: [
      { key: "frio", label: "Frio", color: "#3b82f6" },
      { key: "morno", label: "Morno", color: "#f59e0b" },
      { key: "quente", label: "Quente", color: "#ef4444" },
    ],
  },
  {
    key: "meio",
    name: "Meio de contato",
    exclusive: false,
    mode: "both",
    tags: [
      { key: "ligacao", label: "Ligação", color: "#0ea5e9" },
      { key: "whatsapp", label: "WhatsApp", color: "#22c55e" },
      { key: "email", label: "Email", color: "#8b5cf6" },
      { key: "pessoalmente", label: "Pessoalmente", color: "#f97316" },
      { key: "representante", label: "Representante", color: "#14b8a6" },
      { key: "bot", label: "BOT", color: "#64748b", autoOnly: true },
    ],
  },
  {
    key: "qualificacao",
    name: "Qualificação",
    exclusive: true,
    mode: "both",
    tags: [
      { key: "qualificado", label: "Qualificado", color: "#22c55e" },
      { key: "desqualificado", label: "Desqualificado", color: "#94a3b8" },
    ],
  },
  {
    key: "agenda",
    name: "Agenda",
    exclusive: false,
    mode: "manual",
    tags: [{ key: "agendado", label: "Agendado", color: "#6366f1" }],
  },
  {
    key: "situacao",
    name: "Situação",
    exclusive: false,
    mode: "both",
    tags: [
      { key: "sem_contato", label: "Sem contato", color: "#94a3b8", cooldownDays: 3 },
      { key: "conversando", label: "Conversando", color: "#0ea5e9" },
      { key: "cliente", label: "Cliente", color: "#16a34a", blocksSorting: true },
      { key: "contabilidade", label: "Contabilidade", color: "#d97706" },
      { key: "inapta", label: "Inapta", color: "#dc2626", blocksSorting: true },
      { key: "baixada", label: "Baixada", color: "#dc2626", blocksSorting: true },
      { key: "suspensa", label: "Suspensa", color: "#dc2626", blocksSorting: true },
      { key: "auto_descarte", label: "Auto descarte", color: "#b91c1c", blocksSorting: true, autoOnly: true },
      { key: "telefone_errado", label: "Telefone errado", color: "#a16207" },
      { key: "email_errado", label: "Email errado", color: "#a16207" },
      { key: "dados_errados", label: "Dados errados", color: "#a16207" },
      { key: "inexistente", label: "Inexistente", color: "#dc2626", blocksSorting: true },
    ],
  },
  { key: "porte", name: "Porte", exclusive: true, mode: "auto", tags: [] },
  { key: "capital", name: "Capital social", exclusive: true, mode: "auto", tags: [] },
];

/** Configurações iniciais (editáveis depois pelo Adm). */
export const SETTINGS_SEED: Record<string, unknown> = {
  /** Minutos até um lead parado ser liberado para outra pessoa. */
  lock_minutes: 30,
  /** Meta diária de contatos por pessoa. */
  daily_goal: 35,
};
