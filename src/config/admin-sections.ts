import { Headset, BarChart3, Puzzle, Merge, Brain, Activity, BookA, Archive, Megaphone, Coins, Clock, DatabaseZap, Download, Eraser, ScrollText, Truck, Handshake, KeyRound, PhoneCall, Link2, Mail, PanelTop, Settings2, Tags, Upload, Users, type LucideIcon } from "lucide-react";

export type AdminItem = { href: string; label: string; hint: string; icon: LucideIcon };
export type AdminSection = { id: string; title: string; hue: string; items: AdminItem[] };

/** Todas as áreas do Adm, agrupadas. Usado pelo menu lateral e pela Central do Adm. */
export const ADMIN_SECTIONS: AdminSection[] = [
  { id: "pessoas", title: "Pessoas e acesso", hue: "#6366f1", items: [
    { href: "/admin/usuarios", label: "Equipe e acessos", hint: "Contas, cargos e permissões", icon: Users },
    { href: "/admin/moedas", label: "Moedas e pontos", hint: "Saldos, bloqueios e ajustes", icon: Coins },
  ] },
  { id: "vendas", title: "Vendas", hue: "#10b981", items: [
    { href: "/admin/vendas", label: "Condições e produtos", hint: "Pagamento e catálogo", icon: Handshake },
    { href: "/admin/nomenclatura", label: "Nomenclatura de produtos", hint: "Siglas, classificação e sugestões", icon: Tags },
    { href: "/transportadoras", label: "Transportadoras", hint: "Tabela de fretes e importação", icon: Truck },
    { href: "/admin/negociacoes-apagadas", label: "Apagadas", hint: "Negociações apagadas/resetadas", icon: Archive },
  ] },
  { id: "conteudo", title: "Conteúdo e dados", hue: "#f59e0b", items: [
    { href: "/admin/tags", label: "Tags", hint: "Nomes, cores, ícones e ordem", icon: Tags },
    { href: "/admin/avisos", label: "Avisos globais", hint: "Cards que caem do topo para todos", icon: Megaphone },
    { href: "/admin/modelos", label: "Modelos de e-mail", hint: "Textos prontos", icon: Mail },
    { href: "/admin/importar", label: "Importar planilhas", hint: "Leads, representantes, negociações e transportadoras · histórico", icon: Upload },
    { href: "/admin/contatos", label: "Contatos repetidos", hint: "Encontrar e juntar pessoas duplicadas", icon: Merge },
    { href: "/admin/campos", label: "Dados dos leads", hint: "Campos que o roteiro preenche, uso e sugestões", icon: Brain },
    { href: "/admin/roteiros", label: "Roteiros de ligação", hint: "Versão de fábrica, restaurar e conferir", icon: ScrollText },
    { href: "/admin/roteiros/modulos", label: "Galeria de módulos", hint: "Sequência dos roteiros e desempenho de cada módulo", icon: Puzzle },
    { href: "/admin/roteiros/uso", label: "Uso dos roteiros", hint: "Ligações, objetivos, objeções e onde param", icon: BarChart3 },
    { href: "/admin/consulta-cnpj", label: "Consulta de CNPJ", hint: "Buscar dados dos leads em lote", icon: DatabaseZap },
    { href: "/admin/exportar", label: "Exportar / backup", hint: "Baixar o banco com segurança", icon: Download },
    { href: "/admin/apagar", label: "Apagar", hint: "Excluir dados com segurança", icon: Eraser },
  ] },
  { id: "sistema", title: "Sistema", hue: "#ec4899", items: [
    { href: "/admin/ligacoes", label: "Ligações (VocallPhone)", hint: "Botão Ligar direto do sistema", icon: PhoneCall },
    { href: "/admin/telefone-web", label: "Telefone no navegador (teste)", hint: "Ligar sem o app VocallPhone: teste de viabilidade", icon: Headset },
    { href: "/admin/eox", label: "Integração com a EOX", hint: "Preencher sozinho o link do cadastro de cada lead", icon: Link2 },
    { href: "/admin/glossario", label: "Glossário", hint: "Nomes do sistema e troca de termos", icon: BookA },
    { href: "/admin/barra", label: "Barra de menus", hint: "Ordem do menu para todos", icon: PanelTop },
    { href: "/admin/parametros", label: "Parâmetros", hint: "SDR: sorteio · Vendas: avisos das negociações · Segurança", icon: Settings2 },
    { href: "/admin/banco", label: "Saúde do sistema", hint: "Banco, conexões e números", icon: Activity },
    { href: "/admin/ao-vivo", label: "Ao vivo", hint: "Quem está online", icon: Clock },
  ] },
];
