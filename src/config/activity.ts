/**
 * O que a pessoa está fazendo, para o "Ao vivo" do Adm e para o menu do perfil.
 * A tela manda o endereço em que está; aqui ele vira uma frase. Para uma tela nova, acrescente uma linha em ROUTES.
 * `detail` pede o nome do lead/negociação (resolvido no servidor) para a frase ficar "Negociando [empresa]".
 */
export type Detail = { kind: "lead" | "deal"; id: number };
export type ActKind = "attend" | "deal" | "lead" | "visit" | "goal" | "history" | "dash" | "import" | "export" | "admin" | "users" | "log" | "trash" | "test" | "account" | "rep" | "away" | "online";

const ROUTES: { re: RegExp; label: string; kind: ActKind; detail?: (m: RegExpMatchArray) => Detail; withName?: string }[] = [
  { re: /^\/atender/, label: "No Shuffler", kind: "attend" },
  { re: /^\/shuffler-vendas/, label: "No Shuffler de vendas", kind: "attend" },
  { re: /^\/negociacoes\/importar/, label: "Importando cotações", kind: "import" },
  { re: /^\/negociacoes\/(\d+)/, label: "Negociando", kind: "deal", detail: (m) => ({ kind: "deal", id: Number(m[1]) }), withName: "Negociando" },
  { re: /^\/negociacoes/, label: "Na carteira de vendas", kind: "deal" },
  { re: /^\/leads\/(\d+)/, label: "Vendo o lead", kind: "lead", detail: (m) => ({ kind: "lead", id: Number(m[1]) }), withName: "Vendo o lead" },
  { re: /^\/leads/, label: "Pesquisando leads", kind: "lead" },
  { re: /^\/representantes/, label: "Vendo representantes", kind: "rep" },
  { re: /^\/visitas/, label: "Gerenciando visitas", kind: "visit" },
  { re: /^\/metas/, label: "Conferindo as metas", kind: "goal" },
  { re: /^\/historico/, label: "Revendo o histórico", kind: "history" },
  { re: /^\/painel/, label: "No Dashboard", kind: "dash" },
  { re: /^\/registro/, label: "Lendo o Registro de atividades", kind: "log" },
  { re: /^\/importar/, label: "Importando leads", kind: "import" },
  { re: /^\/conquistas/, label: "Vendo as conquistas", kind: "account" },
  { re: /^\/conta/, label: "Ajustando a própria conta", kind: "account" },
  { re: /^\/admin\/banco/, label: "Vendo a saúde do sistema", kind: "admin" },
  { re: /^\/admin\/ao-vivo/, label: "Monitorando o Ao vivo", kind: "admin" },
  { re: /^\/admin\/usuarios/, label: "Gerenciando usuários", kind: "users" },
  { re: /^\/admin\/permissoes/, label: "Ajustando permissões", kind: "users" },
  { re: /^\/admin\/importar/, label: "Importando dados (Adm)", kind: "import" },
  { re: /^\/admin\/exportar/, label: "Exportando dados", kind: "export" },
  { re: /^\/admin\/modelos/, label: "Editando modelos de e-mail", kind: "admin" },
  { re: /^\/admin\/tags/, label: "Organizando tags", kind: "admin" },
  { re: /^\/admin\/parametros/, label: "Ajustando parâmetros", kind: "admin" },
  { re: /^\/admin\/vendas/, label: "Ajustando as vendas (Adm)", kind: "admin" },
  { re: /^\/admin\/modo-teste/, label: "Em modo teste", kind: "test" },
  { re: /^\/admin\/negociacoes-apagadas/, label: "Vendo negociações apagadas", kind: "trash" },
  { re: /^\/admin\/apagar/, label: "Na central de exclusão", kind: "trash" },
  { re: /^\/admin/, label: "No painel Adm", kind: "admin" },
];

/** Frase da tela atual. `name` (empresa) só é usado nas telas de detalhe. */
export function describePath(path: string, name?: string | null): { text: string; kind: ActKind; detail?: Detail } {
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (!m) continue;
    const detail = r.detail?.(m);
    return { text: r.withName && name ? `${r.withName} ${name}` : r.label, kind: r.kind, detail };
  }
  return { text: "Navegando", kind: "online" };
}

/** Descobre o tipo (ícone) a partir da frase gravada, já que o banco guarda só o texto. */
export function kindOfText(text: string | null | undefined): ActKind {
  if (!text) return "online";
  const t = text.toLowerCase();
  if (t.startsWith("ausente")) return "away";
  if (t.startsWith("atendendo") || t.startsWith("no shuffler")) return "attend";
  if (t.startsWith("negociando") || t.includes("vendas")) return "deal";
  if (t.startsWith("vendo o lead") || t.includes("leads")) return "lead";
  if (t.includes("representantes")) return "rep";
  if (t.includes("visitas")) return "visit";
  if (t.includes("metas")) return "goal";
  if (t.includes("histórico")) return "history";
  if (t.includes("dashboard")) return "dash";
  if (t.includes("registro")) return "log";
  if (t.includes("exclusão") || t.includes("apagadas")) return "trash";
  if (t.includes("teste")) return "test";
  if (t.includes("exportando")) return "export";
  if (t.includes("importando")) return "import";
  if (t.includes("usuários") || t.includes("permissões")) return "users";
  if (t.includes("conta")) return "account";
  if (t.includes("adm") || t.includes("ao vivo") || t.includes("modelos") || t.includes("tags") || t.includes("parâmetros")) return "admin";
  return "online";
}
