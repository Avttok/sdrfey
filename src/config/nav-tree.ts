import { NAV, GROUP_ICONS } from "@/config/nav";
import { NAV_ICONS } from "@/config/nav-icons";

/** Estrutura livre da barra: links soltos e pastas (criadas pelo Adm) com os links dentro, na ordem exata. */
export type TreeLink = { type: "link"; href: string };
export type TreeFolder = { type: "folder"; id: string; label: string; icon?: string; items: string[] };
export type NavTree = (TreeLink | TreeFolder)[];

const KNOWN = new Set(NAV.map((n) => n.href));

/** Limpa o que veio de fora: só abas conhecidas, cada aba uma única vez, pastas com nome curto. */
export function cleanTree(input: unknown): NavTree | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>(), ids = new Set<string>();
  const take = (h: unknown) => (typeof h === "string" && KNOWN.has(h) && !seen.has(h) ? (seen.add(h), h) : null);
  const out: NavTree = [];
  for (const n of input.slice(0, 60)) {
    if (!n || typeof n !== "object") continue;
    const o = n as Record<string, unknown>;
    if (o.type === "link") { const h = take(o.href); if (h) out.push({ type: "link", href: h }); }
    else if (o.type === "folder") {
      const id = typeof o.id === "string" ? o.id.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) : "";
      if (!id || ids.has(id)) continue;
      ids.add(id);
      const label = (typeof o.label === "string" ? o.label.trim() : "").slice(0, 24) || "Pasta";
      const icon = typeof o.icon === "string" && o.icon in NAV_ICONS ? o.icon : undefined;
      const items = (Array.isArray(o.items) ? o.items : []).map(take).filter((x): x is string => !!x);
      out.push({ type: "folder", id, label, ...(icon ? { icon } : {}), items });
    }
  }
  // abas novas que ainda não estão na estrutura entram no fim, soltas
  // (se a aba pertence a um grupo cuja pasta já existe, ela entra nessa pasta: ex.: Metas de Vendas na pasta Vendas)
  for (const n of NAV) {
    if (seen.has(n.href) || n.href === "/conta") continue;
    const sibling = n.group ? NAV.filter((x) => x.group === n.group && x.href !== n.href).map((x) => x.href) : [];
    const folder = out.find((o): o is TreeFolder => o.type === "folder" && o.items.some((h) => sibling.includes(h)));
    if (folder) folder.items.push(n.href); else out.push({ type: "link", href: n.href });
  }
  return out;
}

/** Ponto de partida do editor: as pastas padrão do sistema (com os nomes/ícones atuais). */
const GROUP_ICON_KEY: Record<string, string> = { Pessoas: "contact", Info: "info", SDR: "headset", Vendas: "handshake", "Opções": "settings", "Gestão": "shieldhalf" };

export function defaultTree(order: string[], groupLabels: Record<string, string | undefined> = {}, groupIcons: Record<string, string | undefined> = {}): NavTree {
  const items = order.map((h) => NAV.find((n) => n.href === h)).filter((n): n is (typeof NAV)[number] => !!n && n.href !== "/conta");
  const out: NavTree = [];
  const done = new Set<string>();
  for (const it of items) {
    if (!it.group) { out.push({ type: "link", href: it.href }); continue; }
    if (done.has(it.group)) continue;
    done.add(it.group);
    const g = items.filter((x) => x.group === it.group).map((x) => x.href);
    out.push({ type: "folder", id: `g-${it.group.toLowerCase().replace(/[^a-z0-9]/g, "")}`, label: groupLabels[it.group] ?? it.group, ...((groupIcons[it.group] ?? GROUP_ICON_KEY[it.group]) ? { icon: (groupIcons[it.group] ?? GROUP_ICON_KEY[it.group])! } : {}), items: g });
  }
  return out;
}
export { GROUP_ICONS };
