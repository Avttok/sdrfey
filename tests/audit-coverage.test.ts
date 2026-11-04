import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

/**
 * Regra de ouro: tudo que muda dados de leads, contatos, visitas, tags, usuários, representantes
 * ou configurações PRECISA registrar no histórico. Este teste falha se alguém criar uma
 * alteração nova sem passar por logAudit / setLeadTags.
 */
describe("auditoria cobre toda alteração", () => {
  const WRITE = /\.(update|delete|insert)\(\s*(leads|leadTags|leadChannels|leadPeople|visits|users|tags|reps|settings|emailTemplates)\s*\)/;
  const files = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("src/db/"));
  it("todo arquivo que altera essas tabelas registra no histórico", () => {
    const offenders = files.filter((f) => { const t = readFileSync(f, "utf8"); return WRITE.test(t) && !/logAudit|setLeadTags/.test(t); });
    expect(offenders, `Sem registro de auditoria: ${offenders.join(", ")}`).toEqual([]);
  });
});
