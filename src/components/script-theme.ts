import { UserPlus, MapPin, BadgeCheck, Heart, Bolt, BadgeDollarSign, CalendarCheck, CarFront, CircleHelp, Cog, Crown, Ear, Factory, FileText, Flag, Handshake, Hammer, Headset, MessageCircle, PhoneCall, RotateCcw, Rocket, ShieldAlert, Sparkles, Store, Swords, Target, Truck, Wrench, Boxes, Warehouse, BrickWall, Car, PackageOpen, Bus, Tractor, Armchair, Zap, HardHat, type LucideIcon } from "lucide-react";
import type { ScriptGoal, ScriptMood, ScriptNode } from "@/config/scripts";

/** Cada papel do passo ganha ícone e cor, como etapas de um processo. */
export const MOODS: Record<ScriptMood, { label: string; hint: string; hex: string; Icon: LucideIcon }> = {
  abertura: { label: "Abertura", hint: "Cumprimente e se apresente", hex: "#0ea5e9", Icon: MessageCircle },
  ponte: { label: "Abrir portas", hint: "Chegue em quem decide", hex: "#8b5cf6", Icon: Handshake },
  confirma: { label: "Confirmar", hint: "Confirme os dados com o contato", hex: "#6366f1", Icon: BadgeCheck },
  pergunta: { label: "Escutar", hint: "Pergunte e anote o que ouvir", hex: "#14b8a6", Icon: Ear },
  proposta: { label: "Proposta", hint: "Mostre valor e conduza", hex: "#f59e0b", Icon: Rocket },
  objecao: { label: "Objeção!", hint: "Contorne com calma", hex: "#f97316", Icon: ShieldAlert },
  fideliza: { label: "Fidelizar", hint: "Cuide de quem já compra", hex: "#ec4899", Icon: Heart },
  fechamento: { label: "Resultado", hint: "Missão cumprida", hex: "#22c55e", Icon: Flag },
  apoio: { label: "Passo", hint: "Siga o roteiro", hex: "#64748b", Icon: CircleHelp },
};

export const GOAL_THEME: Record<ScriptGoal, { hex: string; Icon: LucideIcon; short: string; mission: string }> = {
  sdr: { hex: "#0ea5e9", Icon: Target, short: "Prospecção", mission: "Confirmar o perfil, conhecer o cliente e agendar a conversa" },
  vendas: { hex: "#f59e0b", Icon: Swords, short: "Venda", mission: "Cotar e fechar o pedido" },
  retorno: { hex: "#8b5cf6", Icon: PhoneCall, short: "Retorno", mission: "Fazer a cotação virar pedido" },
  fidelizar: { hex: "#ec4899", Icon: Heart, short: "Fidelização", mission: "Manter o cliente comprando e sem dúvidas" },
  visita: { hex: "#6366f1", Icon: MapPin, short: "Visita", mission: "Confirmar a visita, remarcar se preciso e ligar depois dela" },
  reativar: { hex: "#14b8a6", Icon: RotateCcw, short: "Reativação", mission: "Retomar o contato com quem está parado e reabrir a conversa" },
};

export const SEGMENT_ICON: Record<string, LucideIcon> = {
  geral: Sparkles, posto_molas: Cog, auto_center: CarFront, parafusos: Bolt, ferramentas: Hammer, concessionaria: Store, industria: Factory, implementos: Truck,
  distribuidor_fixadores: Boxes, distribuidor_industrial: Warehouse, ferragens: Wrench, material_construcao: BrickWall, autopecas: Car, autopecas_atacado: PackageOpen,
  oficina_pesados: Wrench, transportadora_frota: Truck, carrocerias: Bus, maquinas_agricolas: Tractor, metalurgica: Cog, serralheria: Hammer, moveis: Armchair, eletro_energia: Zap, construcao_pesada: HardHat,
};

export const OUTCOME_ICON: Record<NonNullable<ScriptNode["outcome"]>, LucideIcon> = {
  visita: CalendarCheck, cotacao: FileText, retorno: PhoneCall, venda: BadgeDollarSign, indicacao: UserPlus, encerrar: Flag,
};

export { Crown, Headset, Wrench, Boxes };

/** Fundo suave e borda na cor do papel (funciona no claro e no escuro). */
export const tint = (hex: string, bg = 14, border = 40) => ({ backgroundColor: `color-mix(in srgb, ${hex} ${bg}%, transparent)`, borderColor: `color-mix(in srgb, ${hex} ${border}%, transparent)` });
