import { describe, expect, it } from "vitest";
import {
  aplicarAcao, criarConvite, formatarCodigo, gerarCodigo, lerConvite, listarConvites, normalizarCodigo,
  usarConvite, verificarConvite, vincularLembrete, type KV,
} from "./convites";

function kvFalso(): KV & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    get: async (k) => dados.get(k) ?? null,
    put: async (k, v) => void dados.set(k, v),
    delete: async (k) => void dados.delete(k),
    list: async ({ prefix }) => ({ keys: [...dados.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
  };
}

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("Convites", () => {
  it("código legível, sem letras confundíveis, aceito com hífen, espaços e minúsculas", () => {
    for (let i = 0; i < 50; i++) expect(gerarCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(normalizarCodigo(" abcde-fgh23 ")).toBe("ABCDEFGH23");
    expect(formatarCodigo("ABCDEFGH23")).toBe("ABCDE-FGH23");
  });

  it("1 convite = 1 aparelho", async () => {
    const kv = kvFalso();
    const c = await criarConvite(kv, "amigo-joão");
    const uso = await usarConvite(kv, formatarCodigo(c.codigo).toLowerCase(), A);
    expect(uso.situacao).toBe("ok");
    expect((await usarConvite(kv, c.codigo, B)).situacao).toBe("em-uso");
    expect((await usarConvite(kv, "NAOEXISTE1", A)).situacao).toBe("invalido");
  });

  it("verificação confere aparelho e segredo; bloqueio corta o acesso e para os lembretes", async () => {
    const kv = kvFalso();
    const c = await criarConvite(kv, "amiga");
    const uso = await usarConvite(kv, c.codigo, A);
    if (uso.situacao !== "ok") throw new Error();
    expect(await verificarConvite(kv, c.codigo, A, uso.token)).toBe("ok");
    expect(await verificarConvite(kv, c.codigo, A, "x".repeat(64))).toBe("invalido");
    expect(await verificarConvite(kv, c.codigo, B, uso.token)).toBe("invalido");

    kv.dados.set("d:lemb-1", "{}");
    await vincularLembrete(kv, c.codigo, "lemb-1");
    await aplicarAcao(kv, c.codigo, "bloquear", "d:");
    expect(await verificarConvite(kv, c.codigo, A, uso.token)).toBe("bloqueado");
    expect(kv.dados.has("d:lemb-1")).toBe(false);
    expect((await usarConvite(kv, c.codigo, B)).situacao).toBe("bloqueado");

    await aplicarAcao(kv, c.codigo, "desbloquear", "d:");
    expect(await verificarConvite(kv, c.codigo, A, uso.token)).toBe("ok");
  });

  it("liberar solta o aparelho para usar em outro celular; excluir apaga", async () => {
    const kv = kvFalso();
    const c = await criarConvite(kv, "troca de celular");
    const uso = await usarConvite(kv, c.codigo, A);
    if (uso.situacao !== "ok") throw new Error();
    await aplicarAcao(kv, c.codigo, "liberar", "d:");
    expect(await verificarConvite(kv, c.codigo, A, uso.token)).toBe("invalido");
    expect((await usarConvite(kv, c.codigo, B)).situacao).toBe("ok");
    await aplicarAcao(kv, c.codigo, "excluir", "d:");
    expect(await lerConvite(kv, c.codigo)).toBeNull();
    expect(await listarConvites(kv)).toEqual([]);
  });

  it("último acesso é gravado no máximo a cada 12 h", async () => {
    const kv = kvFalso();
    const c = await criarConvite(kv, "x", 0);
    const uso = await usarConvite(kv, c.codigo, A, 1_000);
    if (uso.situacao !== "ok") throw new Error();
    await verificarConvite(kv, c.codigo, A, uso.token, 2_000);
    expect((await lerConvite(kv, c.codigo))!.ultimoAcesso).toBe(1_000);
    await verificarConvite(kv, c.codigo, A, uso.token, 1_000 + 12 * 3_600_000);
    expect((await lerConvite(kv, c.codigo))!.ultimoAcesso).toBe(1_000 + 12 * 3_600_000);
  });
});
