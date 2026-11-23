import { Anchor, Atom, Bird, Bone, Bug, Cat, Dog, Egg, Fish, Origami, Panda, PawPrint, Rabbit, Rat, Shell, Snail, Squirrel, Turtle, Worm, Coffee, Compass, Crown, Diamond, Feather, Flag, Flame, Gem, Headphones, Moon, Orbit, Rocket, Sun, Trophy, Wand, Wrench, Zap, Clover, type LucideIcon } from "lucide-react";

/** Ícones de perfil (enquanto não há upload de foto). A chave é o que fica guardado. */
export const AVATARS: { key: string; label: string; icon: LucideIcon; /** Chave da conquista que libera este ícone (sem ela, é livre). */ unlock?: string }[] = [
  { key: "cat", label: "Gato", icon: Cat }, { key: "dog", label: "Cachorro", icon: Dog }, { key: "rabbit", label: "Coelho", icon: Rabbit },
  { key: "squirrel", label: "Esquilo", icon: Squirrel }, { key: "panda", label: "Panda", icon: Panda }, { key: "rat", label: "Rato", icon: Rat },
  { key: "bird", label: "Pássaro", icon: Bird }, { key: "origami", label: "Origami", icon: Origami }, { key: "egg", label: "Ovo", icon: Egg },
  { key: "fish", label: "Peixe", icon: Fish }, { key: "turtle", label: "Tartaruga", icon: Turtle }, { key: "shell", label: "Concha", icon: Shell },
  { key: "snail", label: "Caracol", icon: Snail }, { key: "bug", label: "Joaninha", icon: Bug }, { key: "worm", label: "Minhoca", icon: Worm },
  { key: "paw", label: "Patinha", icon: PawPrint }, { key: "bone", label: "Ossinho", icon: Bone },
  /* Liberados por conquistas: a raridade é a da conquista (config/achievements.ts). */
  { key: "flag", label: "Bandeirinha", icon: Flag, unlock: "att_1" }, { key: "fone", label: "Fone de ouvido", icon: Headphones, unlock: "call_1" },
  { key: "cafe", label: "Cafezinho", icon: Coffee, unlock: "early_20" }, { key: "lua", label: "Lua", icon: Moon, unlock: "late_20" },
  { key: "trevo", label: "Trevo", icon: Clover, unlock: "acc_30" }, { key: "sol", label: "Sol", icon: Sun, unlock: "active_30" },
  { key: "foguete", label: "Foguete", icon: Rocket, unlock: "day_25" }, { key: "chama", label: "Chama", icon: Flame, unlock: "seq_7" },
  { key: "bussola", label: "Bússola", icon: Compass, unlock: "conv_10" }, { key: "chave", label: "Chave inglesa", icon: Wrench, unlock: "deal_25" },
  { key: "ancora", label: "Âncora", icon: Anchor, unlock: "bill_50" },
  { key: "raio", label: "Raio", icon: Zap, unlock: "day_50" }, { key: "diamante", label: "Diamante", icon: Gem, unlock: "call_2000" },
  { key: "trofeu", label: "Troféu", icon: Trophy, unlock: "att_1000" }, { key: "orbita", label: "Órbita", icon: Orbit, unlock: "shuf_300" },
  { key: "coroa", label: "Coroa", icon: Crown, unlock: "att_5000" }, { key: "atomo", label: "Átomo", icon: Atom, unlock: "acc_730" },
  { key: "fenix", label: "Fênix", icon: Feather, unlock: "seq_20" }, { key: "joia", label: "Joia", icon: Diamond, unlock: "bill_200" },
  { key: "varinha", label: "Varinha mágica", icon: Wand, unlock: "egg" },
];
export const AVATAR_BY_KEY = new Map(AVATARS.map((a) => [a.key, a]));

export const avatarOpen = (a: { unlock?: string }, earned: readonly string[]) => !a.unlock || earned.includes(a.unlock);
