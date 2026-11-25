import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });
const GUARD = /require\w*\(|loadDeal\(|load\(|currentUser\(|getCurrentUser|resolveSeller\(|allowed\(|leadEditor\(|visitForEditing\(|findDuplicateSetsAction\(/;
/** Ações abertas de propósito (antes do login) ou que só repassam para outra ação com guarda. */
const OPEN = new Set(["loginAction", "logoutAction", "quickLoginAction", "forgetQuickAction", "roleKindOf", "findDuplicatesAction"]);

describe("ações do servidor", () => {
  it("toda ação exportada passa por uma verificação de acesso (ou está na lista das abertas)", () => {
    const bad: string[] = [];
    for (const f of walk("src")) {
      const s = readFileSync(f, "utf8");
      if (!/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*"use server"/.test(s)) continue;
      for (const m of s.matchAll(/export async function (\w+)/g)) {
        const i = (m.index ?? 0) + m[0].length; const j = s.indexOf("\nexport ", i);
        if (!GUARD.test(s.slice(i, j > 0 ? j : s.length)) && !OPEN.has(m[1])) bad.push(`${f}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
