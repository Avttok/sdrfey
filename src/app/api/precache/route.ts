import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const OK = /\.(js|css|woff2?|png|jpe?g|svg|webp|avif|ico)$/i;
async function walk(dir: string, base: string, out: { url: string; size: number }[]) {
  let items;
  try { items = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) { await walk(full, `${base}/${it.name}`, out); continue; }
    if (!OK.test(it.name)) continue;
    const s = await stat(full).catch(() => null);
    if (s) out.push({ url: `${base}/${it.name}`, size: s.size });
  }
}

/** Lista dos arquivos estáticos do site (nomes versionados, com tamanho). A tela de carregamento usa isso para guardar tudo no navegador. Não tem nada privado aqui. */
export async function GET() {
  const root = process.cwd();
  const files: { url: string; size: number }[] = [];
  await walk(path.join(root, ".next", "static"), "/_next/static", files);
  const id = await readFile(path.join(root, ".next", "BUILD_ID"), "utf8").catch(() => "dev");
  return Response.json({ v: id.trim(), files }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } });
}
