import { describe, expect, it } from "vitest";
import { analisarCodigo, crc16Pix } from "../pagamento";

// Exemplo do Manual de Padrões para Iniciação do Pix (Banco Central).
const PIX =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

describe("Código de pagamento", () => {
  it("vazio não é código", () => {
    expect(analisarCodigo("")).toBeNull();
    expect(analisarCodigo("   ")).toBeNull();
    expect(analisarCodigo(undefined)).toBeNull();
  });

  it("Pix copia e cola: reconhece e confere o CRC", () => {
    expect(crc16Pix(PIX.slice(0, -4))).toBe("1D3D");
    expect(analisarCodigo(`  ${PIX}\n`)).toEqual({ tipo: "pix", paraCopiar: PIX, rotulo: "Pix copia e cola", valido: true });
    expect(analisarCodigo(PIX.slice(0, -10) + "63041D3D")!.valido).toBe(false); // cortado ao colar
  });

  it("linha digitável: copia só os números e confere os dígitos verificadores", () => {
    const linha = "23793.38128 60000.000004 00000.000406 1 84340000006990";
    const a = analisarCodigo(linha)!;
    expect(a.tipo).toBe("boleto");
    expect(a.paraCopiar).toBe("23793381286000000000400000000406184340000006990");
    expect(a.valido).toBe(true);
    expect(analisarCodigo(linha.replace("38128", "38129"))!.valido).toBe(false);
  });

  it("código de barras (44) e contas de consumo (48)", () => {
    expect(analisarCodigo("2".repeat(44))!.tipo).toBe("barras");
    expect(analisarCodigo("8".repeat(48))!.tipo).toBe("convenio");
  });

  it("outros formatos são copiados como estão", () => {
    expect(analisarCodigo("chave@exemplo.com")).toEqual({
      tipo: "outro", paraCopiar: "chave@exemplo.com", rotulo: "Código (formato não reconhecido)", valido: null,
    });
  });
});
