import { describe, expect, it } from "vitest";
import { dentroDoPrazoOffline } from "../convite";
import { codigoNoTexto } from "../plataforma";

describe("Convite sem internet", () => {
  const dia = 86_400_000;
  it("funciona por até 7 dias desde a última confirmação", () => {
    expect(dentroDoPrazoOffline(0, 6 * dia)).toBe(true);
    expect(dentroDoPrazoOffline(0, 7 * dia - 1)).toBe(true);
    expect(dentroDoPrazoOffline(0, 7 * dia)).toBe(false);
  });
});

describe("Colar o convite", () => {
  const msg = "Você recebeu um convite para o app Controle Financeiro.\n\nSeu convite: KQ7MP-X3ZTA\n\n1. Abra este link no Safari: https://x.github.io/app/?convite=KQ7MP-X3ZTA";
  it("acha o código na mensagem inteira, sem confundir com palavras", () => {
    expect(codigoNoTexto(msg)).toBe("KQ7MP-X3ZTA");
    expect(codigoNoTexto("FINANCEIRO")).toBe("FINANCEIRO".trim()); // tem I e O: não é código
  });
  it("aceita só o código, com ou sem hífen, em minúsculas", () => {
    expect(codigoNoTexto(" kq7mp-x3zta ")).toBe("KQ7MP-X3ZTA");
    expect(codigoNoTexto("KQ7MPX3ZTA")).toBe("KQ7MP-X3ZTA");
  });
});
