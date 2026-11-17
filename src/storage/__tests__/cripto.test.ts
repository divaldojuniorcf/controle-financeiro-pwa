import { describe, expect, it } from "vitest";
import { abrirComPin, cifrar, derivarChave, novoSalt, PIN_VALIDO, PinIncorreto } from "../cripto";

// Menos iterações só para o teste ficar rápido; o app usa ITERACOES.
const IT = 1_000;

describe("Criptografia dos dados com PIN", () => {
  const dados = { lancamentos: [{ descricao: "Aluguel", valor: 1800 }], ui: { dataAnalise: null } };

  it("cifra e abre com o PIN certo", async () => {
    const salt = novoSalt();
    const c = await cifrar(await derivarChave("2468", salt, IT), salt, dados, IT);
    const texto = new TextDecoder().decode(c.dados);
    expect(texto).not.toContain("Aluguel");
    const { valor } = await abrirComPin("2468", c);
    expect(valor).toEqual(dados);
  });

  it("PIN errado é recusado", async () => {
    const salt = novoSalt();
    const c = await cifrar(await derivarChave("2468", salt, IT), salt, dados, IT);
    await expect(abrirComPin("1357", c)).rejects.toBeInstanceOf(PinIncorreto);
  });

  it("cada gravação usa um IV novo", async () => {
    const salt = novoSalt();
    const chave = await derivarChave("2468", salt, IT);
    const a = await cifrar(chave, salt, dados, IT);
    const b = await cifrar(chave, salt, dados, IT);
    expect(a.iv).not.toEqual(b.iv);
  });

  it("PIN tem de 4 a 8 dígitos", () => {
    expect(PIN_VALIDO.test("1234")).toBe(true);
    expect(PIN_VALIDO.test("12345678")).toBe(true);
    expect(PIN_VALIDO.test("123")).toBe(false);
    expect(PIN_VALIDO.test("12a4")).toBe(false);
  });
});
