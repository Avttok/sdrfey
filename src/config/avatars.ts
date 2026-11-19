import { Bird, Bone, Bug, Cat, Dog, Egg, Fish, Origami, Panda, PawPrint, Rabbit, Rat, Shell, Snail, Squirrel, Turtle, Worm, type LucideIcon } from "lucide-react";

/** Ícones de perfil (enquanto não há upload de foto). A chave é o que fica guardado. */
export const AVATARS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "cat", label: "Gato", icon: Cat }, { key: "dog", label: "Cachorro", icon: Dog }, { key: "rabbit", label: "Coelho", icon: Rabbit },
  { key: "squirrel", label: "Esquilo", icon: Squirrel }, { key: "panda", label: "Panda", icon: Panda }, { key: "rat", label: "Rato", icon: Rat },
  { key: "bird", label: "Pássaro", icon: Bird }, { key: "origami", label: "Origami", icon: Origami }, { key: "egg", label: "Ovo", icon: Egg },
  { key: "fish", label: "Peixe", icon: Fish }, { key: "turtle", label: "Tartaruga", icon: Turtle }, { key: "shell", label: "Concha", icon: Shell },
  { key: "snail", label: "Caracol", icon: Snail }, { key: "bug", label: "Joaninha", icon: Bug }, { key: "worm", label: "Minhoca", icon: Worm },
  { key: "paw", label: "Patinha", icon: PawPrint }, { key: "bone", label: "Ossinho", icon: Bone },
];
export const AVATAR_BY_KEY = new Map(AVATARS.map((a) => [a.key, a]));
