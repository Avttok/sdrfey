/**
 * Preenche as variáveis de um modelo de e-mail.
 * {meu_nome} {empresa} {cidade} {representante} {contato}
 * Com alternativa quando faltar o dado: {contato|tudo bem} → "Maria" ou, sem contato, "tudo bem".
 */
export type TemplateVars = Partial<Record<"meu_nome" | "empresa" | "cidade" | "representante" | "contato", string | null>>;

export const TEMPLATE_VARIABLES = ["meu_nome", "empresa", "cidade", "representante", "contato"] as const;

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (whole, key: string, fallback?: string) => {
    if (!(TEMPLATE_VARIABLES as readonly string[]).includes(key)) return whole;
    const v = vars[key as keyof TemplateVars]?.trim();
    return v ? v : (fallback ?? "");
  });
}

export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const DEFAULT_TEMPLATE = {
  name: "Primeiro contato",
  subject: "{empresa}, uma conversa rápida?",
  body: "Olá, {contato|tudo bem}!\n\nMeu nome é {meu_nome}. Estou entrando em contato com a {empresa} para apresentar nossas soluções.\n\nPodemos conversar rapidamente esta semana?\n\nAbraço,\n{meu_nome}",
};
