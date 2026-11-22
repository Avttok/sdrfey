import { Award, BadgeCheck, Bird, Cake, CalendarCheck, CalendarDays, Coins, Crown, Egg, FileText, Flag, Flame, Gem, Handshake, Headset, Heart, Mail, Medal, MessageCircle, Moon, Phone, PhoneCall, Rabbit, Receipt, Repeat, Rocket, Shuffle, Sparkles, Star, Sunrise, Swords, Target, Trophy, TrendingUp, Users, Wallet, Zap, type LucideIcon } from "lucide-react";

/**
 * Catálogo das conquistas. Cada uma olha uma estatística (`stat`) e é ganha ao chegar na `meta`.
 * As estatísticas vêm de modules/achievements/stats.ts. Para criar uma conquista nova, acrescente uma linha aqui.
 * `group` decide para quem aparece: SDR (atendimento), Vendas (vendedores) ou Geral (todos).
 */
export type AchievementGroup = "SDR" | "Vendas" | "Geral";
export type Achievement = { key: string; name: string; desc: string; stat: string; goal: number; icon: LucideIcon; color: string; unit: string; group: AchievementGroup; /** secreta: só aparece (e só conta no total) para quem já a desbloqueou */ hidden?: boolean };

const A = (group: AchievementGroup, key: string, name: string, desc: string, stat: string, goal: number, icon: LucideIcon, color: string, unit: string): Achievement => ({ group, key, name, desc, stat, goal, icon, color, unit });

export const ACHIEVEMENTS: Achievement[] = [
  // ----- SDR: atendimento
  A("SDR", "att_1", "Primeiro atendimento", "Salvou o primeiro lead atendido. O começo de tudo!", "attended", 1, Flag, "#34D399", "atendidos"),
  A("SDR", "att_25", "Pegando o ritmo", "25 leads atendidos.", "attended", 25, Headset, "#2DD4BF", "atendidos"),
  A("SDR", "att_100", "Centurião", "100 leads atendidos.", "attended", 100, Medal, "#CD7F32", "atendidos"),
  A("SDR", "att_500", "Máquina de atender", "500 leads atendidos.", "attended", 500, Award, "#C0C7D0", "atendidos"),
  A("SDR", "att_1000", "Mil atendimentos", "1.000 leads atendidos.", "attended", 1000, Trophy, "#FACC15", "atendidos"),
  A("SDR", "att_5000", "Lenda do Shuffler", "5.000 leads atendidos. Poucos chegam aqui.", "attended", 5000, Crown, "#A855F7", "atendidos"),
  A("SDR", "call_1", "Alô?", "Registrou a primeira ligação.", "calls", 1, Phone, "#34D399", "ligações"),
  A("SDR", "call_100", "Telefone quente", "100 ligações registradas.", "calls", 100, PhoneCall, "#60A5FA", "ligações"),
  A("SDR", "call_500", "Voz de ouro", "500 ligações registradas.", "calls", 500, PhoneCall, "#FACC15", "ligações"),
  A("SDR", "call_2000", "Call center de um homem só", "2.000 ligações registradas.", "calls", 2000, Gem, "#22D3EE", "ligações"),
  A("SDR", "zap_100", "Zap em dia", "100 contatos por WhatsApp.", "whatsapps", 100, MessageCircle, "#22C55E", "WhatsApps"),
  A("SDR", "zap_500", "Mestre do Zap", "500 contatos por WhatsApp.", "whatsapps", 500, MessageCircle, "#16A34A", "WhatsApps"),
  A("SDR", "mail_50", "Caixa de saída", "50 contatos por e-mail.", "emails", 50, Mail, "#818CF8", "e-mails"),
  A("SDR", "mail_300", "Correspondente", "300 contatos por e-mail.", "emails", 300, Mail, "#A855F7", "e-mails"),
  A("SDR", "sched_1", "Primeira visita", "Agendou a primeira visita.", "visits", 1, CalendarCheck, "#34D399", "visitas"),
  A("SDR", "sched_25", "Agenda cheia", "25 visitas agendadas.", "visits", 25, CalendarCheck, "#F59E0B", "visitas"),
  A("SDR", "sched_100", "Rei da agenda", "100 visitas agendadas.", "visits", 100, CalendarDays, "#FB923C", "visitas"),
  A("SDR", "conv_1", "Passou o bastão", "O primeiro lead virou negociação.", "converted", 1, Handshake, "#34D399", "convertidos"),
  A("SDR", "conv_10", "Faro de vendas", "10 leads viraram negociação.", "converted", 10, Target, "#60A5FA", "convertidos"),
  A("SDR", "conv_50", "Caçador de oportunidades", "50 leads viraram negociação.", "converted", 50, Swords, "#F87171", "convertidos"),
  A("SDR", "day_10", "Dia de foguete", "10 atendimentos num dia só.", "best_day", 10, Rocket, "#60A5FA", "no melhor dia"),
  A("SDR", "day_25", "Dia imparável", "25 atendimentos num dia só.", "best_day", 25, Zap, "#FACC15", "no melhor dia"),
  A("SDR", "day_50", "Dia lendário", "50 atendimentos num dia só.", "best_day", 50, Rabbit, "#F87171", "no melhor dia"),
  A("SDR", "seq_3", "Esquentando", "Atendimentos em 3 dias seguidos.", "streak", 3, Flame, "#FB923C", "dias seguidos"),
  A("SDR", "seq_7", "Semana cheia", "Atendimentos em 7 dias seguidos.", "streak", 7, Flame, "#F87171", "dias seguidos"),
  A("SDR", "seq_20", "Pegando fogo", "Atendimentos em 20 dias seguidos.", "streak", 20, Flame, "#A855F7", "dias seguidos"),
  A("SDR", "early_20", "Madrugador", "20 atendimentos antes das 8h.", "early", 20, Sunrise, "#FB923C", "cedinho"),
  A("SDR", "late_20", "Hora extra", "20 atendimentos depois das 18h.", "late", 20, Moon, "#818CF8", "à noite"),
  A("SDR", "active_30", "Presença", "Atendeu em 30 dias diferentes.", "days_active", 30, CalendarDays, "#2DD4BF", "dias"),
  A("SDR", "active_100", "Cem dias de Shuffler", "Atendeu em 100 dias diferentes.", "days_active", 100, Star, "#FACC15", "dias"),

  // ----- Vendas
  A("Vendas", "deal_1", "Primeira negociação", "Assumiu a primeira negociação.", "deals_taken", 1, Handshake, "#34D399", "negociações"),
  A("Vendas", "deal_25", "Carteira cheia", "25 negociações assumidas.", "deals_taken", 25, Users, "#2DD4BF", "negociações"),
  A("Vendas", "deal_100", "Mão na massa", "100 negociações assumidas.", "deals_taken", 100, Medal, "#CD7F32", "negociações"),
  A("Vendas", "quote_1", "Primeira cotação", "Registrou a primeira cotação.", "quotes", 1, FileText, "#34D399", "cotações"),
  A("Vendas", "quote_50", "Cotador", "50 cotações registradas.", "quotes", 50, FileText, "#60A5FA", "cotações"),
  A("Vendas", "quote_250", "Fábrica de cotações", "250 cotações registradas.", "quotes", 250, FileText, "#A855F7", "cotações"),
  A("Vendas", "bill_1", "Primeiro faturamento", "Faturou a primeira venda. 🎉", "billed", 1, Receipt, "#34D399", "vendas"),
  A("Vendas", "bill_10", "Fechador", "10 vendas faturadas.", "billed", 10, Trophy, "#FACC15", "vendas"),
  A("Vendas", "bill_50", "Máquina de vendas", "50 vendas faturadas.", "billed", 50, Award, "#F59E0B", "vendas"),
  A("Vendas", "bill_200", "Lenda do balcão", "200 vendas faturadas.", "billed", 200, Crown, "#A855F7", "vendas"),
  A("Vendas", "cash_10k", "Primeiros 10 mil", "R$ 10.000 faturados.", "billed_reais", 10_000, Coins, "#A3E635", "reais"),
  A("Vendas", "cash_100k", "Cem mil", "R$ 100.000 faturados.", "billed_reais", 100_000, Wallet, "#34D399", "reais"),
  A("Vendas", "cash_1m", "Milhão", "R$ 1.000.000 faturados.", "billed_reais", 1_000_000, Gem, "#22D3EE", "reais"),
  A("Vendas", "big_20k", "Peixe grande", "Uma venda de R$ 20.000 ou mais.", "biggest_reais", 20_000, TrendingUp, "#FB923C", "na maior venda"),
  A("Vendas", "big_100k", "Baleia", "Uma venda de R$ 100.000 ou mais.", "biggest_reais", 100_000, TrendingUp, "#A855F7", "na maior venda"),
  A("Vendas", "client_5", "Bem relacionado", "Faturou para 5 clientes diferentes.", "clients", 5, Users, "#2DD4BF", "clientes"),
  A("Vendas", "client_25", "Conhecido na praça", "Faturou para 25 clientes diferentes.", "clients", 25, Heart, "#F472B6", "clientes"),
  A("Vendas", "react_1", "De volta à ativa", "Reativou um cliente que voltou a comprar.", "reactivated", 1, Repeat, "#60A5FA", "reativados"),
  A("Vendas", "react_10", "Ressuscitador", "10 clientes reativados.", "reactivated", 10, Sparkles, "#F59E0B", "reativados"),
  A("Vendas", "shuf_1", "Bora shufflar", "Trabalhou o primeiro lead inativo.", "shuffled", 1, Shuffle, "#34D399", "inativos"),
  A("Vendas", "shuf_50", "Garimpeiro", "50 leads inativos trabalhados.", "shuffled", 50, Shuffle, "#2DD4BF", "inativos"),
  A("Vendas", "shuf_300", "Mina de ouro", "300 leads inativos trabalhados.", "shuffled", 300, Gem, "#FACC15", "inativos"),
  A("Vendas", "shufdeal_1", "Achou ouro", "Um lead inativo virou negociação.", "shuffle_deals", 1, Sparkles, "#FACC15", "viraram negociação"),
  A("Vendas", "shufdeal_20", "Faro de garimpo", "20 leads inativos viraram negociação.", "shuffle_deals", 20, Target, "#F87171", "viraram negociação"),

  // ----- Geral
  A("Geral", "acc_7", "Bem-vindo", "Uma semana de SDR Fey.", "days_account", 7, CalendarCheck, "#34D399", "dias"),
  A("Geral", "acc_30", "Um mês de casa", "Um mês de SDR Fey.", "days_account", 30, CalendarDays, "#60A5FA", "dias"),
  A("Geral", "acc_90", "Da família", "Três meses de SDR Fey.", "days_account", 90, Heart, "#F472B6", "dias"),
  A("Geral", "acc_180", "Meio ano", "Seis meses de SDR Fey.", "days_account", 180, BadgeCheck, "#818CF8", "dias"),
  A("Geral", "acc_365", "Aniversário", "Um ano de SDR Fey. Parabéns!", "days_account", 365, Cake, "#F472B6", "dias"),
  A("Geral", "acc_730", "Raiz", "Dois anos de SDR Fey.", "days_account", 730, Bird, "#FACC15", "dias"),
  { ...A("Geral", "egg", "Douradovo", "Você encontrou o segredo escondido no sistema. Poucos chegam aqui!", "egg", 1, Egg, "#FBBF24", "segredo"), hidden: true },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

/** Quais grupos de conquistas a pessoa vê, de acordo com o que ela faz no sistema. */
export function groupsFor(roles: readonly string[]): AchievementGroup[] {
  const admin = roles.includes("admin");
  const out: AchievementGroup[] = [];
  if (admin || roles.includes("user") || roles.includes("manager")) out.push("SDR");
  if (admin || roles.includes("seller") || roles.includes("manager")) out.push("Vendas");
  out.push("Geral");
  return out;
}
