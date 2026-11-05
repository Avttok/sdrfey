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

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Remove scripts, manipuladores on*, javascript: e tags fora da lista. Vale no servidor e no navegador. */
export function sanitizeHtml(html: string): string {
  const ALLOWED = "a|b|strong|i|em|u|s|br|p|div|span|font|img|ul|ol|li|h1|h2|h3|blockquote|hr|table|thead|tbody|tr|td|th|sub|sup";
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?(<\/\s*\1\s*>|$)/gi, "")
    .replace(new RegExp(`</?\\s*(?!(?:${ALLOWED})\\b)[a-z][^>]*>`, "gi"), "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(?:javascript|vbscript|data:(?!image\/(?:png|jpe?g|gif|webp);base64,))[^"']*\2/gi, "$1=$2#$2");
}

/** Versão formatada: troca as variáveis (escapando o valor) e limpa o HTML. */
export function renderHtml(html: string, vars: TemplateVars): string {
  const filled = html.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (whole, key: string, fallback?: string) => {
    if (!(TEMPLATE_VARIABLES as readonly string[]).includes(key)) return whole;
    const v = vars[key as keyof TemplateVars]?.trim();
    return esc(v ? v : (fallback ?? ""));
  });
  return sanitizeHtml(filled);
}

/** Texto simples a partir do HTML (para o e-mail em texto e para o campo `body`). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-3]|blockquote|tr)\s*>/gi, "\n")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const DEFAULT_TEMPLATE = {
  name: "Primeiro contato",
  subject: "{empresa}, uma conversa rápida?",
  html: "<p>Olá, {contato|tudo bem}!</p><p>Meu nome é <b>{meu_nome}</b>. Estou entrando em contato com a <b>{empresa}</b> para apresentar nossas soluções.</p><p>Podemos conversar rapidamente esta semana?</p><p>Abraço,<br>{meu_nome}</p>",
  body: "Olá, {contato|tudo bem}!\n\nMeu nome é {meu_nome}. Estou entrando em contato com a {empresa} para apresentar nossas soluções.\n\nPodemos conversar rapidamente esta semana?\n\nAbraço,\n{meu_nome}",
};
