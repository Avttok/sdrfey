import { Ban, Bot, Building2, CalendarCheck, CircleCheck, CircleHelp, CircleOff, Coins, Factory, Flame, Handshake, Hash, Landmark, Mail, MailX, MapPin, MessageCircle, MessagesSquare, Phone, PhoneOff, Snowflake, Sun, Tag, ThumbsDown, ThumbsUp, Trash2, TriangleAlert, UserRound, UserX, Users, Wallet, Zap, Heart, Star, Flag, Clock, ShieldAlert, FileWarning, Calculator, Store, Truck, type LucideIcon } from "lucide-react";

/** Ícones que o Adm pode escolher para uma tag. */
export const TAG_ICONS: Record<string, LucideIcon> = {
  flame: Flame, sun: Sun, snowflake: Snowflake, phone: Phone, "phone-off": PhoneOff, whatsapp: MessageCircle, mail: Mail, "mail-x": MailX, people: Users, user: UserRound, "user-x": UserX, bot: Bot,
  check: CircleCheck, ban: Ban, "circle-off": CircleOff, help: CircleHelp, calendar: CalendarCheck, handshake: Handshake, trash: Trash2, alert: TriangleAlert, "shield-alert": ShieldAlert, "file-warning": FileWarning,
  building: Building2, factory: Factory, store: Store, truck: Truck, landmark: Landmark, calc: Calculator, coins: Coins, wallet: Wallet, pin: MapPin, chat: MessagesSquare, "thumbs-up": ThumbsUp, "thumbs-down": ThumbsDown,
  zap: Zap, heart: Heart, star: Star, flag: Flag, clock: Clock, hash: Hash, tag: Tag,
};

/** Ícone padrão de cada tag do sistema (chave da tag). O Adm pode trocar. */
const BY_KEY: Record<string, string> = {
  quente: "flame", morno: "sun", frio: "snowflake",
  ligacao: "phone", whatsapp: "whatsapp", email: "mail", pessoalmente: "people", representante: "user", bot: "bot",
  qualificado: "check", desqualificado: "ban", agendado: "calendar",
  sem_contato: "phone-off", conversando: "chat", cliente: "handshake", contabilidade: "calc", inapta: "alert", baixada: "circle-off", suspensa: "shield-alert",
  auto_descarte: "trash", telefone_errado: "phone-off", email_errado: "mail-x", dados_errados: "file-warning", inexistente: "help", descartado: "trash",
};
const BY_GROUP: Record<string, string> = { capital: "coins", porte: "factory", meio: "chat", situacao: "tag", temperatura: "flame", qualificacao: "check", agenda: "calendar" };

/** Ícone final: o escolhido pelo Adm; senão o padrão da tag; senão o do grupo. */
export const tagIconKey = (custom: string | null | undefined, key: string, group: string): string =>
  (custom && TAG_ICONS[custom] ? custom : BY_KEY[key] ?? BY_GROUP[group] ?? "tag");
