import { describe, expect, it } from "vitest";
import { roleKindOf } from "@/modules/facts/contacts";

describe("papel do contato", () => {
  it("entende o cargo escrito do jeito que o time escreve", async () => {
    expect(await roleKindOf("Comprador")).toBe("Comprador");
    expect(await roleKindOf("Setor de compras")).toBe("Comprador");
    expect(await roleKindOf("Recepção")).toBe("Portaria");
    expect(await roleKindOf("Secretária")).toBe("Secretaria");
    expect(await roleKindOf("Sócio-diretor")).toBe("Dono ou sócio");
    expect(await roleKindOf("Eng. de manutenção")).toBe("Engenharia ou manutenção");
    expect(await roleKindOf("Faxineiro")).toBe("Outro");
    expect(await roleKindOf("  ")).toBeNull();
  });
});
