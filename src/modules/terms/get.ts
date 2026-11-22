import { cleanOverrides, TERMS_KEY, type TermOverrides } from "@/config/terms";
import { settingValue } from "@/modules/settings/get";

/** Apelidos do Glossário salvos pelo Adm (vazio = tudo com o nome padrão). */
export async function getTermOverrides(): Promise<TermOverrides> {
  return cleanOverrides(await settingValue(TERMS_KEY).catch(() => undefined));
}
