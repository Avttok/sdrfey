import { Activity, Archive, Coins, Clock, DatabaseZap, Download, Eraser, FlaskConical, Handshake, KeyRound, Mail, MessagesSquare, PanelTop, Settings2, Tags, Upload, Users, type LucideIcon } from "lucide-react";

export type AdminItem = { href: string; label: string; hint: string; icon: LucideIcon };
export type AdminSection = { id: string; title: string; hue: string; items: AdminItem[] };

/** Todas as áreas do Adm, agrupadas. Usado pelo menu lateral e pela Central do Adm. */
export const ADMIN_SECTIONS: AdminSection[] = [
  { id: "pessoas", title: "Pessoas e acesso", hue: "#6366f1", items: [
    { href: "/admin/usuarios", label: "Usuários", hint: "Contas, cargos e bloqueios", icon: Users },
    { href: "/admin/permissoes", label: "Permissões", hint: "Quem vê e faz o quê", icon: KeyRound },
    { href: "/admin/moedas", label: "Moedas e pontos", hint: "Saldos, bloqueios e ajustes", icon: Coins },
  ] },
  { id: "vendas", title: "Vendas", hue: "#10b981", items: [
    { href: "/admin/vendas", label: "Condições e produtos", hint: "Pagamento e catálogo", icon: Handshake },
    { href: "/admin/negociacoes-apagadas", label: "Apagadas", hint: "Negociações apagadas/resetadas", icon: Archive },
  ] },
  { id: "conteudo", title: "Conteúdo e dados", hue: "#f59e0b", items: [
    { href: "/admin/tags", label: "Tags", hint: "Nomes, cores, ícones e ordem", icon: Tags },
    { href: "/admin/modelos", label: "Modelos de e-mail", hint: "Textos prontos", icon: Mail },
    { href: "/admin/importar", label: "Importar CSV", hint: "Leads e representantes", icon: Upload },
    { href: "/admin/consulta-cnpj", label: "Consulta de CNPJ", hint: "Buscar dados dos leads em lote", icon: DatabaseZap },
    { href: "/admin/exportar", label: "Exportar / backup", hint: "Baixar o banco com segurança", icon: Download },
    { href: "/admin/apagar", label: "Apagar", hint: "Excluir dados com segurança", icon: Eraser },
  ] },
  { id: "sistema", title: "Sistema", hue: "#ec4899", items: [
    { href: "/admin/barra", label: "Barra de menus", hint: "Ordem do menu para todos", icon: PanelTop },
    { href: "/admin/parametros", label: "Parâmetros", hint: "Regras do sorteio", icon: Settings2 },
    { href: "/admin/banco", label: "Saúde do sistema", hint: "Banco, conexões e números", icon: Activity },
    { href: "/admin/chat", label: "Chat (tudo)", hint: "Grupos e conversas diretas", icon: MessagesSquare },
    { href: "/admin/ao-vivo", label: "Ao vivo", hint: "Quem está online", icon: Clock },
    { href: "/admin/modo-teste", label: "Modo teste", hint: "Treinar sem sujar dados", icon: FlaskConical },
  ] },
];
