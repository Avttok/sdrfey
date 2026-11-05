import type { Role } from "./roles";

/**
 * Tudo o que o Adm pode liberar ou bloquear: abas, blocos do painel e funções.
 * O Adm sempre tem tudo. Para os outros: ajuste da pessoa > ajuste do cargo (Adm) > padrão abaixo.
 * Para criar uma permissão nova, acrescente uma linha aqui; ela aparece sozinha na tela do Adm.
 */
export type PermissionDef = { key: string; label: string; group: "Abas" | "Painel" | "Funções"; defaults: Role[] };

export const PERMISSIONS: PermissionDef[] = [
  { key: "tab.painel", label: "Aba Dashboard", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.comecar", label: "Aba Shufflar", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.leads", label: "Aba Leads", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.historico", label: "Aba Meu histórico", group: "Abas", defaults: ["user", "manager"] },
  { key: "tab.registro", label: "Aba Registro de atividades", group: "Abas", defaults: ["manager"] },
  { key: "tab.metas", label: "Aba Metas", group: "Abas", defaults: ["manager"] },
  { key: "tab.representantes", label: "Aba Representantes", group: "Abas", defaults: ["manager"] },
  { key: "tab.importar", label: "Aba Importar CSV", group: "Abas", defaults: [] },

  { key: "panel.equipe", label: "Ver números da equipe toda (sem isso, só os próprios)", group: "Painel", defaults: ["manager"] },
  { key: "panel.kpis", label: "Indicadores principais", group: "Painel", defaults: ["user", "manager"] },
  { key: "panel.ranking", label: "Ranking da equipe", group: "Painel", defaults: ["manager"] },
  { key: "panel.funil", label: "Funil", group: "Painel", defaults: ["manager"] },
  { key: "panel.horas", label: "Atividade por hora", group: "Painel", defaults: ["manager"] },
  { key: "panel.meios", label: "Meios de contato", group: "Painel", defaults: ["manager"] },
  { key: "panel.temperatura", label: "Interesse (Frio/Morno/Quente)", group: "Painel", defaults: ["manager"] },
  { key: "panel.estoque", label: "Leads (estoque)", group: "Painel", defaults: ["manager"] },
  { key: "panel.alertas", label: "Alertas", group: "Painel", defaults: ["manager"] },
  { key: "panel.agendamentos", label: "Agendamentos recentes", group: "Painel", defaults: ["user", "manager"] },

  { key: "lead.edit", label: "Editar qualquer dado de um lead", group: "Funções", defaults: ["manager"] },
  { key: "lead.release", label: "Liberar lead que está com outra pessoa", group: "Funções", defaults: ["manager"] },
  { key: "rep.edit", label: "Criar e editar representantes", group: "Funções", defaults: ["manager"] },
  { key: "audit.revert", label: "Reverter alterações pelo Registro", group: "Funções", defaults: [] },
  { key: "goals.edit", label: "Alterar metas da equipe", group: "Funções", defaults: [] },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type PermissionMap = Record<string, boolean>;
export type RoleOverrides = Partial<Record<Role, PermissionMap>>;

/** Permissões que só existem para o Adm (nunca aparecem como opção para outros). */
export const ADMIN_ONLY = ["Administração"] as const;
