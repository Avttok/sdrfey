/**
 * Prepara o banco: aplica as migrações e grava os dados iniciais.
 * É seguro rodar quantas vezes quiser (a Vercel roda a cada deploy): nada que já existe é sobrescrito.
 */
import { readFileSync } from "node:fs";
import { sql as dsql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql, cities, emailTemplates, settings, tagGroups, tags, users } from "../src/db";
import { DEFAULT_TEMPLATE } from "../src/modules/email/render";
import { SEED_USERS } from "../src/config/seed-users";
import { SETTINGS_SEED, TAG_GROUPS_SEED } from "../src/config/tags";
import { cityKey } from "../src/modules/import/reps";
import { hashPassword } from "../src/modules/auth/password";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("⚠️  DATABASE_URL não definida: pulando preparação do banco.");
    return;
  }

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✔ migrações aplicadas");

  // grupos e tags
  for (const [gi, g] of TAG_GROUPS_SEED.entries()) {
    await db
      .insert(tagGroups)
      .values({ key: g.key, name: g.name, exclusive: g.exclusive, mode: g.mode, sort: gi })
      .onConflictDoNothing();
    if (g.tags.length === 0) continue;
    await db
      .insert(tags)
      .values(
        g.tags.map((t, ti) => ({
          groupKey: g.key,
          key: t.key,
          label: t.label,
          color: t.color,
          sort: ti,
          blocksSorting: t.blocksSorting ?? false,
          cooldownDays: t.cooldownDays ?? null,
          autoOnly: t.autoOnly ?? false,
        })),
      )
      .onConflictDoNothing();
  }
  console.log("✔ tags");

  // configurações
  for (const [key, value] of Object.entries(SETTINGS_SEED)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }

  // modelo de e-mail inicial (só se ainda não existir nenhum)
  const [{ n: nTpl }] = await db.select({ n: dsql<number>`count(*)` }).from(emailTemplates);
  if (Number(nTpl) === 0) await db.insert(emailTemplates).values({ name: DEFAULT_TEMPLATE.name, subject: DEFAULT_TEMPLATE.subject, body: DEFAULT_TEMPLATE.body, bodyHtml: DEFAULT_TEMPLATE.html });

  // cidades (para achar o representante mais próximo)
  const [{ count }] = await db.select({ count: sqlCount() }).from(cities);
  if (Number(count) === 0) {
    const rows = JSON.parse(readFileSync("./src/db/data/cities.json", "utf8")) as [number, string, string, number, number][];
    for (let i = 0; i < rows.length; i += 1000) {
      await db
        .insert(cities)
        .values(rows.slice(i, i + 1000).map(([ibge, name, uf, lat, lon]) => ({ ibge, name, nameNorm: cityKey(name), uf, lat, lon })))
        .onConflictDoNothing();
    }
    console.log(`✔ ${rows.length} cidades`);
  }

  // usuários iniciais
  const initial = process.env.SEED_INITIAL_PASSWORD || "12345";
  const hash = await hashPassword(initial);
  for (const u of SEED_USERS) {
    await db
      .insert(users)
      .values({ username: u.username, name: u.name, roles: u.roles, passwordHash: hash, mustChangePassword: true })
      .onConflictDoNothing({ target: users.username });
  }
  console.log("✔ usuários");
}

const sqlCount = () => dsql<number>`count(*)`;

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
