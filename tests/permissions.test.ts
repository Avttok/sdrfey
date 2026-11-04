import { describe, expect, it } from "vitest";
import { resolvePermissions } from "@/modules/permissions/resolve";

describe("permissões", () => {
  it("Adm tem tudo, sempre — mesmo com ajuste negando", () => {
    const p = resolvePermissions(["user", "admin"], { "tab.painel": false }, { admin: { "tab.painel": false } });
    expect(Object.values(p).every(Boolean)).toBe(true);
  });
  it("usuário comum não vê aba do gestor", () => {
    const p = resolvePermissions(["user"]);
    expect(p["tab.leads"]).toBe(true);
    expect(p["tab.registro"]).toBe(false);
    expect(p["panel.equipe"]).toBe(false);
  });
  it("gestor vê painel da equipe; o Adm pode tirar a aba Painel do cargo", () => {
    expect(resolvePermissions(["user", "manager"])["panel.ranking"]).toBe(true);
    expect(resolvePermissions(["user", "manager"], {}, { manager: { "tab.painel": false }, user: { "tab.painel": false } })["tab.painel"]).toBe(false);
  });
  it("ajuste individual vale mais que o cargo", () => {
    expect(resolvePermissions(["user"], { "tab.registro": true })["tab.registro"]).toBe(true);
    expect(resolvePermissions(["user", "manager"], { "tab.registro": false })["tab.registro"]).toBe(false);
  });
});
