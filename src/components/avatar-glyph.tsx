import { AVATAR_BY_KEY } from "@/config/avatars";

/** Conteúdo do círculo de perfil: o ícone escolhido ou, sem escolha, as iniciais. */
export function AvatarGlyph({ avatar, initials, size = 18 }: { avatar?: string | null; initials: string; size?: number }) {
  const I = avatar ? AVATAR_BY_KEY.get(avatar)?.icon : null;
  return I ? <I size={size} strokeWidth={2} aria-hidden /> : <>{initials}</>;
}
