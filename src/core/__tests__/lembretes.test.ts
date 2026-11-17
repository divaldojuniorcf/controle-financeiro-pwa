import { describe, expect, it } from "vitest";
import { isoParaSerial } from "../datas";
import { gerarLembretes, horarioDoLembrete } from "../lembretes";
import type { ItemConta } from "../tipos";

let n = 0;
function item(descricao: string, venc: string, pago = false, valor = 100): ItemConta {
  return {
    pago, origem: "Lançamento", descricao, categoria: "X", vencimento: isoParaSerial(venc),
    valor, chave: `k${++n}`, indice: n, ref: `r${n}`,
  };
}

describe("Lembretes de vencimento", () => {
  const agora = new Date(2026, 10, 17, 14, 0); // 17/11/2026 14h (horário do aparelho)

  it("véspera às 9h, inclusive na virada do mês", () => {
    expect(new Date(horarioDoLembrete(isoParaSerial("2026-11-20")))).toEqual(new Date(2026, 10, 19, 9, 0));
    expect(new Date(horarioDoLembrete(isoParaSerial("2026-12-01")))).toEqual(new Date(2026, 10, 30, 9, 0));
    expect(new Date(horarioDoLembrete(isoParaSerial("2027-01-01")))).toEqual(new Date(2026, 11, 31, 9, 0));
  });

  it("uma notificação por dia, a pagar e a receber juntos, sem valores", () => {
    const l = gerarLembretes(
      [item("Aluguel apartamento", "2026-11-20", false, 1800), item("Internet", "2026-11-20"), item("Luz", "2026-11-25")],
      [item("Salário", "2026-11-20", false, 6500)],
      agora,
    );
    expect(l.map((x) => x.dia)).toEqual(["2026-11-20", "2026-11-25"]);
    expect(l[0]).toEqual({
      dia: "2026-11-20",
      enviarEm: new Date(2026, 10, 19, 9, 0).getTime(),
      titulo: "Vencem amanhã (20/11)",
      corpo: "A pagar: Aluguel apartamento, Internet\nA receber: Salário",
    });
    expect(l.map((x) => x.corpo).join()).not.toMatch(/\d{3}|R\$/);
  });

  it("ignora contas pagas e avisos que já passaram", () => {
    const l = gerarLembretes(
      [item("Paga", "2026-11-22", true), item("Hoje", "2026-11-17"), item("Amanhã", "2026-11-18")],
      [],
      agora,
    );
    // "Amanhã" teria aviso hoje às 9h, que já passou (agora são 14h).
    expect(l).toEqual([]);
  });

  it("depois do pagamento, o dia sem contas em aberto some", () => {
    const antes = gerarLembretes([item("Luz", "2026-11-25")], [], agora);
    const depois = gerarLembretes([item("Luz", "2026-11-25", true)], [], agora);
    expect(antes).toHaveLength(1);
    expect(depois).toHaveLength(0);
  });
});
