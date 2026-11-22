import { describe, expect, it } from "vitest";
import { mergeRepeatedColumns, parseCsv } from "@/modules/import/csv";
import { fieldOfHeader } from "@/modules/import/fields";
import { parseLeadRows } from "@/modules/import/leads-parse";

const multi = (h: string) => { const f = fieldOfHeader("leads", h); return f && ["phone", "email", "contact"].includes(f.key) ? f.key : null; };

describe("colunas repetidas na importação", () => {
  it("junta telefones, e-mails e contatos de colunas do mesmo tipo", () => {
    const csv = "CNPJ,Razão Social,Telefone,Telefone,Email,Email,Contato,Contato\n11222333000181,ACME,11 4070-5511,11 2947-6030,a@acme.com,b@acme.com,Renato,Ana\n";
    const m = mergeRepeatedColumns(parseCsv(csv), multi);
    expect(m.headers.filter((h) => /tel/i.test(h))).toHaveLength(1);
    const { drafts } = parseLeadRows(m.headers, m.rows);
    expect(drafts[0].phones).toHaveLength(2);
    expect(drafts[0].emails).toEqual(["a@acme.com", "b@acme.com"]);
    expect(drafts[0].contactName).toBe("Renato / Ana");
  });
});
