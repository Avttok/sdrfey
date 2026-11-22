/** Leitura de páginas de sites de empresas (sem rede): contatos escondidos, redes sociais, links internos e conferência de que o site é da empresa. */

const NAMED: Record<string, string> = { "&amp;": "&", "&commat;": "@", "&period;": ".", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&nbsp;": " ", "&#64;": "@", "&#x40;": "@" };

/** &#64; → @, &commat; → @, &#x2e; → . etc. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&(?:amp|commat|period|lt|gt|quot|nbsp);/gi, (m) => NAMED[m.toLowerCase()] ?? m);
}

/** Cloudflare "proteção de e-mail": o endereço vem em hexadecimal (primeiro byte é a chave). */
export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(out) ? out.toLowerCase() : null;
}

/** "contato [at] loja [dot] com.br", "vendas(arroba)loja.com.br" → e-mail normal. */
export function deobfuscate(text: string): string {
  return text
    .replace(/\s*[\[({]\s*(?:at|arroba|@)\s*[\])}]\s*/gi, "@")
    .replace(/\s*[\[({]\s*(?:dot|ponto)\s*[\])}]\s*/gi, ".");
}

/** E-mails e telefones declarados nos dados estruturados (JSON-LD) da página. */
export function jsonLdContacts(html: string): { phones: string[]; emails: string[]; links: string[] } {
  const out = { phones: [] as string[], emails: [] as string[], links: [] as string[] };
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === "telephone" || k === "faxNumber") (Array.isArray(x) ? x : [x]).forEach((y) => typeof y === "string" && out.phones.push(y));
      else if (k === "email") (Array.isArray(x) ? x : [x]).forEach((y) => typeof y === "string" && out.emails.push(y.replace(/^mailto:/i, "").toLowerCase()));
      else if (k === "sameAs") (Array.isArray(x) ? x : [x]).forEach((y) => typeof y === "string" && out.links.push(y));
      else walk(x);
    }
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* JSON quebrado: ignora */ }
  }
  return out;
}

export type Socials = { instagram: string | null; facebook: string | null; linkedin: string | null };

/** Perfis em redes sociais citados na página (ignora botões de compartilhar). */
export function socialLinks(html: string): Socials {
  const s: Socials = { instagram: null, facebook: null, linkedin: null };
  const ig = html.match(/instagram\.com\/([A-Za-z0-9._]{2,30})(?=[\/"'?#\s\\])/);
  if (ig && !/^(p|reel|reels|explore|accounts|about|share|stories|tv)$/i.test(ig[1])) s.instagram = `https://instagram.com/${ig[1]}`;
  for (const m of html.matchAll(/facebook\.com\/(?:pages\/[^\/"'?#\s]+\/|profile\.php\?id=)?([A-Za-z0-9.\-_]{3,60})(?=[\/"'?#\s\\])/gi)) {
    if (!/^(sharer|share|tr|plugins|dialog|login|help|policies|legal|privacy|groups|events|watch|hashtag)(\.php)?$/i.test(m[1])) { s.facebook = `https://facebook.com/${m[1]}`; break; }
  }
  const li = html.match(/linkedin\.com\/(company|in)\/([A-Za-z0-9\-_%.]{2,80})(?=[\/"'?#\s\\])/i);
  if (li) s.linkedin = `https://linkedin.com/${li[1].toLowerCase()}/${li[2]}`;
  return s;
}

const SKIP_EXT = /\.(?:pdf|jpe?g|png|gif|svg|webp|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|css|js|ico|xml)(?:[?#]|$)/i;
const HINT_HIGH = /contat|fale|contact|atendimento|whats|orcamento|orçamento|cotac|cotaç/i;
const HINT_MID = /sobre|quem-?somos|empresa|instituc|unidade|loja|onde|localiza|represent|revend|distribu|suporte|sac\b|ouvidoria|endere|filia|nossos?-?contatos|a-?fey/i;

const strip = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const bare = (h: string) => h.replace(/^www\./i, "").toLowerCase();

/** Links internos que provavelmente levam a telefones/e-mails (contato, sobre, unidades…), do mais promissor ao menos. */
export function internalLinks(html: string, base: URL): { url: string; score: number }[] {
  const seen = new Map<string, number>();
  for (const m of html.matchAll(/<a\s[^>]*?href=["']([^"'#]+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const href = decodeEntities(m[1]).trim();
    if (!href || /^(mailto:|tel:|javascript:|whatsapp:|data:)/i.test(href) || SKIP_EXT.test(href)) continue;
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || bare(u.hostname) !== bare(base.hostname)) continue;
    u.hash = "";
    const key = u.toString().replace(/\/$/, "");
    if (key === base.toString().replace(/\/$/, "")) continue;
    const text = strip(m[2]);
    const score = HINT_HIGH.test(u.pathname + " " + text) ? 5 : HINT_MID.test(u.pathname + " " + text) ? 2 : 0;
    if (score) seen.set(key, Math.max(seen.get(key) ?? 0, score));
  }
  return [...seen].map(([url, score]) => ({ url, score })).sort((a, b) => b.score - a.score);
}

/** Páginas "link na bio" (Linktree e parecidos): muita empresa pequena põe o WhatsApp só ali. */
export function bioLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?(?:linktr\.ee|bio\.link|beacons\.ai|linkin\.bio|taplink\.cc|campsite\.bio|lnk\.bio|bio\.site)\/[A-Za-z0-9._\-]{2,40}/gi)) out.add(m[0]);
  return [...out].slice(0, 2);
}

/** Endereços de e-mail gratuitos ou de contabilidade: não indicam o site da empresa. */
export const FREE_MAIL = /^(?:gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|uol|bol|terra|ig|globo|globomail|icloud|me|aol|protonmail|proton|zipmail|r7|oi|veloxmail|pop|superig|click21|brturbo|itelefonica|zoho|mail|gmx|yandex)\./i;
const ACCOUNTING = /contab|contador|contabil|assessori|escritorio|escritório|consultori|despachante|advoc/i;
const STOP = new Set(["ltda", "eireli", "epp", "mei", "sa", "me", "comercio", "comércio", "industria", "indústria", "servicos", "serviços", "empresa", "grupo", "brasil", "materiais", "material", "distribuidora", "distribuidor", "representacoes", "representações", "importacao", "importação", "exportacao", "exportação", "loja", "casa", "centro", "comercial", "industrial", "peças", "pecas", "ferragens", "ferramentas", "parafusos", "para", "dos", "das", "de", "do", "da", "e", "em", "com"]);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palavras que identificam a empresa (sem "LTDA", "comércio" e outras genéricas). */
export function nameTokens(names: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const n of names) for (const w of fold(n ?? "").split(/[^a-z0-9]+/)) if (w.length >= 4 && !STOP.has(w)) out.add(w);
  return [...out];
}

/** Domínios prováveis do site: do e-mail (se não for gratuito nem de contador) e do nome da empresa. */
export function candidateDomains(emails: string[], names: (string | null | undefined)[]): { host: string; byName: boolean }[] {
  const out: { host: string; byName: boolean }[] = [];
  const add = (host: string, byName: boolean) => { if (!out.some((o) => o.host === host)) out.push({ host, byName }); };
  for (const e of emails) {
    const d = e.split("@")[1]?.toLowerCase().trim();
    if (!d || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) || FREE_MAIL.test(d) || ACCOUNTING.test(d)) continue;
    add(d, false);
  }
  const base = names.find((n) => n && n.trim());
  if (base) {
    const w = fold(base).replace(/\b(ltda|eireli|epp|mei|s\/a|sa|me)\b/g, " ").split(/[^a-z0-9]+/).filter((x) => x && !["de", "da", "do", "dos", "das", "e", "comercio", "industria", "servicos"].includes(x));
    const slug = w.join("");
    if (slug.length >= 5 && slug.length <= 28) { add(`${slug}.com.br`, true); add(`${slug}.com`, true); }
  }
  return out.slice(0, 5);
}

/**
 * O site é mesmo da empresa? Vale quando a página mostra o CNPJ dela. Para domínio tirado do e-mail (não do nome), basta o
 * título/cabeçalho trazer ao menos duas palavras do nome (um escritório de contabilidade não passa).
 */
export function belongsToCompany(html: string, c: { cnpj: string; names: (string | null | undefined)[]; byName: boolean }): boolean {
  const flat = html.replace(/\D/g, "");
  if (c.cnpj.length === 14 && flat.includes(c.cnpj)) return true;
  if (c.byName) return false;
  const head = fold(strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") + " " + (html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i)?.[1] ?? "") + " " + (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "")));
  const toks = nameTokens(c.names);
  const hit = toks.filter((t) => head.includes(t));
  return hit.length >= Math.min(2, toks.length) && hit.length > 0;
}
