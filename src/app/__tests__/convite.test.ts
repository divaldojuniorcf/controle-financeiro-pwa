import { describe, expect, it } from "vitest";
import { dentroDoPrazoOffline } from "../convite";

describe("Convite sem internet", () => {
  const dia = 86_400_000;
  it("funciona por até 7 dias desde a última confirmação", () => {
    expect(dentroDoPrazoOffline(0, 6 * dia)).toBe(true);
    expect(dentroDoPrazoOffline(0, 7 * dia - 1)).toBe(true);
    expect(dentroDoPrazoOffline(0, 7 * dia)).toBe(false);
  });
});
