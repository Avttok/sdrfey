import type { Role } from "./roles";

/**
 * Tudo o que o Adm pode liberar ou bloquear: abas, blocos do painel e funções.
 * O Adm sempre tem tudo. Para os outros: ajuste da pessoa > ajuste do cargo (Adm) > padrão abaixo.
 * Para criar uma permissão nova, acrescente uma linha aqui; ela aparece sozinha na tela do Adm.
 */
export type PermissionDef = { key: string; label: string; group: "Abas" | "Painel" | "Funções"; defaults: Role[] };

export const PERMISSIONS: PermissionDef[] = [
  { key: "tab.painel", label: "Aba Dashboard", group: "Abas", defaults: ["user", "manager", "seller"] },
  { key: "tab.comecar", label: "Aba Shuffler", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.leads", label: "Aba Leads", group: "Abas", defaults: ["user", "manager", "seller"] },
  { key: "tab.historico", label: "Aba Meu histórico", group: "Abas", defaults: ["user", "manager", "seller"] },
  { key: "tab.visitas", label: "Aba Visitas", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.registro", label: "Aba Registro de atividades", group: "Abas", defaults: ["manager"] },
  { key: "tab.metas", label: "Aba Metas", group: "Abas", defaults: ["manager", "seller"] },
  { key: "tab.representantes", label: "Aba Representantes", group: "Abas", defaults: ["manager"] },

  { key: "tab.negociacoes", label: "Aba Vendas: Negociações", group: "Abas", defaults: ["seller", "manager"] },
  { key: "tab.shuffler_vendas", label: "Aba Vendas: Shuffler (leads inativos)", group: "Abas", defaults: ["seller", "manager"] },

  { key: "panel.equipe", label: "Ver números da equipe toda (sem isso, só os próprios)", group: "Painel", defaults: ["manager"] },
  { key: "panel.kpi.contatos", label: "Indicador: Contatos", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.meta", label: "Indicador: Meta atendidos", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.meta_agend", label: "Indicador: Meta agendados", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.meta_ligacoes", label: "Indicador: Meta ligações", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.meta_convertidos", label: "Indicador: Meta convertidos", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.qualificados", label: "Indicador: Qualificados", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.agendados", label: "Indicador: Agendados", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.taxa_qualif", label: "Indicador: Taxa de qualificação", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.taxa_agend", label: "Indicador: Taxa de agendamento", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.tempo", label: "Indicador: Tempo por lead", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.novos", label: "Indicador: Leads novos", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.media_dia", label: "Indicador: Média por dia", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.ligacoes", label: "Indicador: Ligações", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.convertidos", label: "Indicador: Convertidos", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.descartados", label: "Indicador: Descartados", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.visitas_ok", label: "Indicador: Visitas confirmadas/realizadas", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.tempo_total", label: "Indicador: Tempo total atendendo", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.vendas_origem", label: "Indicador: Vendas originadas", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.kpi.sequencia", label: "Indicador: Sequência de dias", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.ranking", label: "Ranking da equipe", group: "Painel", defaults: ["manager"] },
  { key: "panel.funil", label: "Funil", group: "Painel", defaults: ["manager"] },
  { key: "panel.horas", label: "Atividade por hora", group: "Painel", defaults: ["manager"] },
  { key: "panel.meios", label: "Meios de contato", group: "Painel", defaults: ["manager"] },
  { key: "panel.temperatura", label: "Interesse (Frio/Morno/Quente)", group: "Painel", defaults: ["manager"] },
  { key: "panel.estoque", label: "Leads (estoque)", group: "Painel", defaults: ["manager"] },
  { key: "panel.alertas", label: "Alertas", group: "Painel", defaults: ["manager"] },
  { key: "panel.agendamentos", label: "Agendamentos recentes", group: "Painel", defaults: ["user", "manager"] },

  { key: "panel.vendas", label: "Bloco Vendas da equipe (dashboard)", group: "Painel", defaults: ["manager"] },

  { key: "deals.team", label: "Ver e atender as negociações de toda a equipe (sem isso, só as próprias e as sem dono)", group: "Funções", defaults: ["manager"] },
  { key: "deals.delete", label: "Apagar e resetar negociações (tudo fica no Registro do Adm)", group: "Funções", defaults: ["manager"] },
  { key: "tab.desempenho", label: "Aba SDR: Desempenho (exportar planilhas)", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.desempenho_vendas", label: "Aba Vendas: Desempenho (exportar planilhas)", group: "Abas", defaults: ["seller", "manager"] },
  { key: "desempenho.equipe", label: "Desempenho: exportar também os números de outras pessoas (sem isso, só os próprios)", group: "Funções", defaults: ["manager"] },
  { key: "visits.team", label: "Ver as visitas agendadas por toda a equipe (sem isso, só as próprias)", group: "Funções", defaults: ["manager"] },
  { key: "lead.edit", label: "Editar qualquer dado de um lead", group: "Funções", defaults: ["manager"] },
  { key: "lead.release", label: "Liberar lead que está com outra pessoa", group: "Funções", defaults: ["manager"] },
  { key: "rep.edit", label: "Criar e editar representantes", group: "Funções", defaults: ["manager"] },
  { key: "audit.revert", label: "Reverter alterações pelo Registro", group: "Funções", defaults: [] },
  { key: "goals.edit", label: "Alterar metas da equipe: padrão (global) e de qualquer pessoa", group: "Funções", defaults: [] },
  { key: "chat.use", label: "Usar o chat interno", group: "Funções", defaults: ["user", "seller", "manager"] },
  { key: "goals.edit.own", label: "Alterar só a própria meta (sem mexer na global nem na dos outros)", group: "Funções", defaults: [] },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type PermissionMap = Record<string, boolean>;
export type RoleOverrides = Partial<Record<Role, PermissionMap>>;

/** Permissões que só existem para o Adm (nunca aparecem como opção para outros). */
export const ADMIN_ONLY = ["Administração"] as const;
