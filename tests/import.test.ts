import { describe, expect, it } from "vitest";
import { LEAD_COLUMNS, mapColumns } from "@/modules/import/columns";
import { parseCsv } from "@/modules/import/csv";
import { parseLeadRows } from "@/modules/import/leads-parse";
import {
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
  normalizeEmail,
  parseLegacyDate,
  splitPhones,
} from "@/modules/import/normalize";
import { resolveAccent } from "@/config/theme";
import { hasRole } from "@/config/roles";
import { checkPasswordRules } from "@/modules/auth/password";

describe("limpeza de dados", () => {
  it("normaliza CNPJ e restaura zeros perdidos pelo Excel", () => {
    expect(normalizeCnpj("36.740.443/0001-66").cnpj).toBe("36740443000166");
    expect(normalizeCnpj("3674044300166")).toEqual({ cnpj: "03674044300166", padded: true });
    expect(normalizeCnpj("123").cnpj).toBeNull();
    expect(formatCnpj("36740443000166")).toBe("36.740.443/0001-66");
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
  });

  it("separa, limpa e deduplica telefones", () => {
    expect(splitPhones("(61) 3612-1828 / (61) 3612-4032 / (61) 3612-4032").phones).toEqual(["6136121828", "6136124032"]);
    // celular antigo sem o 9 ganha o dígito
    expect(splitPhones("(47) 9159-8777")).toEqual({ phones: ["47991598777"], fixed: 1 });
    // fixo não é alterado; prefixo 55 e lixo são removidos
    expect(splitPhones("+55 (11) 2446-5000").phones).toEqual(["1124465000"]);
    expect(splitPhones("1111111111 / 123").phones).toEqual([]);
  });

  it("normaliza e-mail e datas", () => {
    expect(normalizeEmail(" CONTATO@Empresa.COM.BR ")).toBe("contato@empresa.com.br");
    expect(normalizeEmail("sem arroba")).toBeNull();
    expect(parseLegacyDate("25-10-2026 17:49:00")?.toISOString()).toBe("2026-10-25T20:49:00.000Z");
    expect(parseLegacyDate("lixo")).toBeNull();
  });
});

describe("importação de leads", () => {
  const csv = [
    "CODSAP,EMPRESA,CNPJ,CONTATO,TELEFONE,CARGO,INTERESSE,MEIO,QUALIFICADO,AGENDADO,SITUAÇÃO,OPSDR,OBSERVAÇÃO,USO,EMAIL,PORTE,CAPITAL",
    ',A LTDA,11.222.333/0001-81,,(47) 9159-8777,,QUENTE,"LIGAÇÃO, WPP",SIM,SIM,ATENDENDO,RUAN,falou com o dono,LIVRE,a@a.com,ME (ATÉ 9 FUNC.),R$ 10.000',
    ",CONTABIL LTDA,22.333.444/0001-55,,,,,BOT,NÃO,,CONTABILIDADE,AUTO,,LIVRE,x@contabil.com,,",
    ",BAIXADA LTDA,33.444.555/0001-66,,,,,BOT,NÃO,,\"AUTO DESCARTE, BAIXADA\",AUTO,,LIVRE,,,",
    ",SEM CNPJ,,,,,,,,,,,,LIVRE,,,",
    ",DUPLICADA,11222333000181,,,,,,,,,,,LIVRE,,,",
    ",REF LTDA,44.555.666/0001-77,,,,,,,,,#REF!,,LIVRE,,,",
  ].join("\n");

  const { headers, rows } = parseCsv(csv);
  const { drafts, report } = parseLeadRows(headers, rows);
  const byName = (n: string) => drafts.find((d) => d.company === n)!;
  const keys = (n: string) => byName(n).tags.map((t) => `${t.group}:${t.key}`);

  it("converte valores antigos em tags novas", () => {
    expect(keys("A LTDA")).toEqual(
      expect.arrayContaining([
        "temperatura:quente",
        "meio:ligacao",
        "meio:whatsapp",
        "qualificacao:qualificado",
        "agenda:agendado",
        "situacao:conversando",
        "porte:me_ate_9_func",
        "capital:r_10_000",
      ]),
    );
    expect(byName("A LTDA").timesWorked).toBe(1);
    expect(byName("A LTDA").phones).toEqual(["47991598777"]);
    expect(byName("A LTDA").email).toBe("a@a.com");
  });

  it("devolve ao sorteio quem o robô descartou só por ser contabilidade", () => {
    expect(keys("CONTABIL LTDA")).toEqual(["situacao:contabilidade"]);
    expect(byName("CONTABIL LTDA").timesWorked).toBe(0);
    expect(report.fixes.contabilidadeReativados).toBe(1);
  });

  it("mantém o descarte automático por situação cadastral", () => {
    expect(keys("BAIXADA LTDA")).toEqual(
      expect.arrayContaining(["situacao:auto_descarte", "situacao:baixada", "qualificacao:desqualificado", "meio:bot"]),
    );
  });

  it("rejeita linhas ruins e conta duplicadas", () => {
    expect(report.rejected).toEqual([{ line: 5, company: "SEM CNPJ", reason: "CNPJ inválido ou vazio" }]);
    expect(report.duplicatesInFile).toBe(1);
    expect(byName("REF LTDA").ownerName).toBeNull();
  });

  it("avisa quando faltam colunas obrigatórias", () => {
    const r = parseLeadRows(["FOO"], [{ FOO: "x" }]);
    expect(r.report.missingColumns).toEqual(["CNPJ", "EMPRESA"]);
    expect(r.drafts).toEqual([]);
  });
});

describe("cargos, cores e senhas", () => {
  it("Adm herda Gestor e Usuário", () => {
    expect(hasRole(["admin"], "user")).toBe(true);
    expect(hasRole(["manager"], "admin")).toBe(false);
    expect(hasRole(["user"], "manager")).toBe(false);
  });

  it("cor padrão segue o cargo mais alto, e a escolha da pessoa vence", () => {
    expect(resolveAccent(null, ["user"]).key).toBe("azul");
    expect(resolveAccent(null, ["user", "manager"]).key).toBe("amarelo");
    expect(resolveAccent(null, ["user", "manager", "admin"]).key).toBe("amarelo"); // o Adm não aparece na cor: a equipe não vê quem é admin
    expect(resolveAccent(null, ["admin"]).key).toBe("vermelho");
    expect(resolveAccent("verde", ["admin"]).key).toBe("verde");
    expect(resolveAccent("invalida", ["user"]).key).toBe("azul");
  });

  it("valida regras de senha", () => {
    expect(checkPasswordRules("12345")).not.toBeNull();
    expect(checkPasswordRules("somenteletras")).not.toBeNull();
    expect(checkPasswordRules("senhaBoa123")).toBeNull();
  });
});

import { cleanEoxId, cleanSfId } from "@/modules/import/leads-parse";
describe("Id EOX e Id Salesforce na planilha", () => {
  it("aceita número, id da API e link; recusa lixo", () => {
    expect(cleanEoxId("1293925")).toBe("1293925");
    expect(cleanEoxId("6x1293925")).toBe("1293925");
    expect(cleanEoxId("https://fey.vocallcontact.com.br/index.php?module=Accounts&view=Detail&record=1293925")).toBe("1293925");
    expect(cleanEoxId("abc")).toBeNull();
    expect(cleanEoxId("0")).toBeNull();
    expect(cleanSfId("0015e00000AbCdEfGH")).toBe("0015e00000AbCdEfGH");
    expect(cleanSfId("curto")).toBeNull();
  });
  it("os cabeçalhos da exportação são reconhecidos", () => {
    const m = mapColumns(["CNPJ", "idEmpresa", "Id SF"], LEAD_COLUMNS);
    expect(m.eoxId).toBe("idEmpresa"); expect(m.sfId).toBe("Id SF");
  });
});
