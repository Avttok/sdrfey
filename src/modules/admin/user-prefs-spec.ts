/** Parâmetros de uma pessoa que o Adm pode devolver ao padrão. */
export type ResetKey = "all" | "accent" | "nav" | "map" | "font" | "goalsSdr" | "goalsSeller" | "goalsAccess" | "permissions" | "inMetrics" | "manager" | "lock";

export const RESET_KEYS: { key: Exclude<ResetKey, "all">; label: string; hint: string }[] = [
  { key: "accent", label: "Cor", hint: "Volta à cor padrão do cargo." },
  { key: "nav", label: "Barra de navegação", hint: "Posição, ordem dos menus e barra recolhida." },
  { key: "map", label: "Mapa do lead", hint: "Mostrar o mapa do Google." },
  { key: "font", label: "Fonte", hint: "Archivo (padrão)." },
  { key: "goalsSdr", label: "Metas do SDR", hint: "Atendidos, agendados, ligações, convertidos e desativações próprias: segue a meta global." },
  { key: "goalsSeller", label: "Metas de vendas", hint: "Metas e desativações próprias: segue a meta padrão da equipe." },
  { key: "goalsAccess", label: "Permissão de gerenciar metas", hint: "Remove o acesso extra às metas da equipe." },
  { key: "permissions", label: "Permissões individuais", hint: "Remove os ajustes só dele; vale o padrão do cargo." },
  { key: "inMetrics", label: "Aparece nas métricas", hint: "Volta a aparecer." },
  { key: "manager", label: "Gestor responsável", hint: "Visível para todos os gestores." },
  { key: "lock", label: "Bloqueio de tentativas", hint: "Zera tentativas erradas de senha e destrava o login." },
];
