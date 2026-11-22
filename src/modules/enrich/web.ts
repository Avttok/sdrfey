import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { belongsToCompany, bioLinks, candidateDomains, decodeCfEmail, decodeEntities, deobfuscate, internalLinks, jsonLdContacts, socialLinks } from "./site-parse";

const UA = "Mozilla/5.0 (compatible; SDRFEY/1.0; +https://sdr-fey.vercel.app)";
const MAX_BYTES = 600_000;

/** Endereço interno/privado? (proteção contra o servidor ser usado para espiar a rede de dentro) */
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) { const l = ip.toLowerCase(); return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168."); }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Só endereços públicos http(s). Resolve o nome e recusa se algum IP for interno. */
export async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname;
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const ips = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!ips.length || ips.some((x) => isPrivateIp(x.address))) return null;
  } catch { return null; }
  return u;
}

/** Baixa o HTML de uma página pública (até 3 redirecionamentos, cada um conferido; 6s; 600 KB). */
export async function fetchHtml(raw: string): Promise<string | null> {
  let url = await safeUrl(raw);
  for (let hop = 0; url && hop < 4; hop++) {
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(6_000), headers: { "user-agent": UA, accept: "text/html" }, cache: "no-store" });
      if (res.status >= 300 && res.status < 400) { const loc = res.headers.get("location"); url = loc ? await safeUrl(new URL(loc, url).toString()) : null; continue; }
      if (!res.ok || !/html|text/i.test(res.headers.get("content-type") ?? "")) return null;
      const reader = res.body?.getReader(); if (!reader) return null;
      const chunks: Uint8Array[] = []; let size = 0;
      while (size < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
      try { await reader.cancel(); } catch { /* já terminou */ }
      return Buffer.concat(chunks).toString("utf8");
    } catch { return null; }
  }
  return null;
}

export type WebFind = { phones: string[]; emails: string[]; instagram: string | null; facebook: string | null; linkedin: string | null; pages: number };

const JUNK_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|sentry|wixpress|example\.|seudominio|email@|nome@|usuario@|@2x|@(?:domain|dominio|site|seusite|empresa)\./i;

function normPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || ddd % 10 === 0) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  if (d.length === 10 && !/[2-5]/.test(d[2])) return null;
  if (/^(\d)\1+$/.test(d.slice(2))) return null;
  return d;
}

/**
 * Telefones, e-mails e redes sociais de uma página. Prioriza o que a página declara (tel:, mailto:, WhatsApp, dados estruturados,
 * e-mail protegido pelo Cloudflare, "nome [at] site"); depois números e e-mails soltos no texto.
 */
export function extractContacts(rawHtml: string): WebFind {
  const html = decodeEntities(rawHtml);
  const phones = new Set<string>(), emails = new Set<string>();
  const addMail = (e: string) => { const m = e.trim().toLowerCase(); if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(m) && !JUNK_EMAIL.test(m)) emails.add(m); };
  const addPhone = (v: string) => { const p = normPhone(v); if (p) phones.add(p); };
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) { try { addPhone(decodeURIComponent(m[1])); } catch { addPhone(m[1]); } }
  for (const m of html.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^"'\s]*&)?phone=|web\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)(\+?\d{10,14})/gi)) addPhone(m[1]);
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) { try { addMail(decodeURIComponent(m[1])); } catch { addMail(m[1]); } }
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) { const e = decodeCfEmail(m[1]); if (e) addMail(e); }
  const ld = jsonLdContacts(html);
  ld.phones.forEach(addPhone); ld.emails.forEach(addMail);
  const text = deobfuscate(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  for (const m of text.matchAll(/(?:\+?55\s?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g)) addPhone(m[0]);
  for (const m of text.matchAll(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi)) addMail(m[0]);
  const soc = socialLinks(html + " " + ld.links.join(" "));
  return { phones: [...phones].slice(0, 8), emails: [...emails].slice(0, 5), instagram: soc.instagram, facebook: soc.facebook, linkedin: soc.linkedin, pages: 1 };
}

const merge = (into: WebFind, f: WebFind) => {
  into.phones = [...new Set([...into.phones, ...f.phones])].slice(0, 8);
  into.emails = [...new Set([...into.emails, ...f.emails])].slice(0, 5);
  into.instagram ??= f.instagram; into.facebook ??= f.facebook; into.linkedin ??= f.linkedin;
};

/**
 * Lê o site da empresa por inteiro: a página inicial e, a partir dela, as páginas internas mais promissoras (contato, fale conosco,
 * sobre, unidades, onde estamos, representantes…), até 8 páginas e 14 s no total, 3 por vez. Segue também links de "link na bio"
 * (Linktree e parecidos). Se o site não tem link de contato, tenta os endereços mais comuns.
 */
export async function scanSite(siteUrl: string, maxMs = 14_000): Promise<WebFind | null> {
  const home = await safeUrl(siteUrl);
  if (!home) return null;
  const t0 = Date.now();
  const html = await fetchHtml(home.toString());
  if (!html) return null;
  const found = extractContacts(html);
  const seen = new Set<string>([home.toString().replace(/\/$/, "")]);
  const htmls = [html];
  let queue = internalLinks(html, home);
  if (!queue.length) queue = ["/contato", "/fale-conosco", "/contact", "/quem-somos", "/sobre"].map((p) => ({ url: new URL(p, home).toString(), score: 1 }));
  while (queue.length && found.pages < 8 && Date.now() - t0 < maxMs && !(found.phones.length >= 4 && found.emails.length >= 2 && found.instagram)) {
    const batch = queue.splice(0, 3).filter((q) => !seen.has(q.url.replace(/\/$/, "")));
    if (!batch.length) continue;
    batch.forEach((q) => seen.add(q.url.replace(/\/$/, "")));
    const pages = await Promise.all(batch.map((q) => fetchHtml(q.url)));
    for (let i = 0; i < pages.length; i++) {
      const h = pages[i];
      if (!h) continue;
      found.pages++; htmls.push(h); merge(found, extractContacts(h));
      for (const l of internalLinks(h, new URL(batch[i].url))) if (!seen.has(l.url.replace(/\/$/, "")) && !queue.some((q) => q.url === l.url)) queue.push(l);
    }
    queue.sort((a, b) => b.score - a.score);
  }
  const bios = [...new Set(htmls.flatMap(bioLinks))].slice(0, 2);
  if (bios.length && Date.now() - t0 < maxMs + 4_000) {
    const pages = await Promise.all(bios.map((u) => fetchHtml(u)));
    for (const h of pages) if (h) { found.pages++; merge(found, extractContacts(h)); }
  }
  return found;
}

/** Quando o lead não tem site: tenta o domínio do e-mail da empresa e o do nome, e só aceita o que a página prova ser dela. */
export async function discoverSite(c: { emails: string[]; names: (string | null | undefined)[]; cnpj: string }): Promise<string | null> {
  const cands = candidateDomains(c.emails, c.names);
  if (!cands.length) return null;
  const tries = await Promise.all(cands.map(async (d) => {
    const url = `https://${d.host}`;
    const html = (await fetchHtml(url)) ?? (await fetchHtml(`https://www.${d.host}`));
    return html && belongsToCompany(html, { cnpj: c.cnpj, names: c.names, byName: d.byName }) ? url : null;
  }));
  return tries.find(Boolean) ?? null;
}

export type PlaceFind = { phone: string | null; website: string | null };

/** Google Places (Maps): telefone e site do estabelecimento. Precisa de GOOGLE_PLACES_API_KEY; sem chave, não faz nada. */
export async function findPlace(name: string, city: string | null, uf: string | null): Promise<PlaceFind | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", signal: AbortSignal.timeout(7_000), cache: "no-store",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.websiteUri,places.formattedAddress" },
      body: JSON.stringify({ textQuery: [name, city, uf].filter(Boolean).join(" "), languageCode: "pt-BR", regionCode: "BR", maxResultCount: 1 }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { places?: { nationalPhoneNumber?: string; websiteUri?: string; formattedAddress?: string }[] };
    const p = j.places?.[0];
    if (!p) return null;
    if (uf && p.formattedAddress && !new RegExp(`\\b${uf}\\b`, "i").test(p.formattedAddress)) return null;
    return { phone: p.nationalPhoneNumber ? normPhone(p.nationalPhoneNumber) : null, website: p.websiteUri ?? null };
  } catch { return null; }
}
