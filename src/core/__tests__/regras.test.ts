// Regras da seção 4 e 5 com dados pequenos, independentes do dados.json.
import { describe, expect, it } from "vitest";
import { alternarBaixas } from "../baixas";
import { aplicarRecorrencia, contasDoEstado } from "../calculo";
import { cardsDeContas, listaDeContas, tituloDaLista } from "../contas";
import { calcularDashboard, classificar } from "../dashboard";
import { date, edate, eomonth, formatarData, isoParaSerial, serialParaIso } from "../datas";
import { PARAMETROS_PADRAO } from "../importacao";
import { fixo, moedaCard, textoExcel } from "../numeros";
import { gerarRecorrentes } from "../recorrencia";
import type { Estado, Lancamento } from "../tipos";

let seq = 0;
const id = () => `t${++seq}`;

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: id(), dataEntrada: null, vencimento: "2026-11-10", descricao: "Conta",
    tipo: "Saída", categoria: "Moradia", valor: 100, recorrente: "", ...p,
  };
}

function estado(lancamentos: Lancamento[], hoje = "2026-11-17"): Estado {
  return {
    lancamentos,
    investimentos: [],
    baixas: [],
    parametros: { ...PARAMETROS_PADRAO, hojeFixo: hoje },
  };
}

describe("Datas (seriais do Excel)", () => {
  it("converte ISO ↔ serial", () => {
    expect(isoParaSerial("2026-11-17")).toBe(46343);
    expect(serialParaIso(46346)).toBe("2026-11-20");
    expect(formatarData(46343)).toBe("17/11/2026");
  });
  it("EDATE e EOMONTH como no Excel", () => {
    const jan31 = date(2027, 1, 31);
    expect(serialParaIso(edate(jan31, 1))).toBe("2027-02-28");
    expect(serialParaIso(edate(jan31, 2))).toBe("2027-03-31");
    expect(serialParaIso(edate(date(2028, 1, 31), 1))).toBe("2028-02-29");
    expect(serialParaIso(eomonth(isoParaSerial("2026-11-17"), 3))).toBe("2027-02-28");
  });
});

describe("Números", () => {
  it("texto do Excel com 15 dígitos e vírgula", () => {
    expect(textoExcel(120)).toBe("120");
    expect(textoExcel(712.50000000000034)).toBe("712,5");
    expect(textoExcel(89.999999999999943)).toBe("89,9999999999999");
    expect(textoExcel(770.70544234989939)).toBe("770,705442349899");
    expect(textoExcel(99.9)).toBe("99,9");
  });
  it("FIXED e cards", () => {
    expect(fixo(8600, 2)).toBe("8.600,00");
    expect(fixo(1234567.005, 2)).toBe("1.234.567,01");
    expect(fixo(99.01162790697674, 1)).toBe("99,0");
    expect(moedaCard(0)).toBe("-");
    expect(moedaCard(-50)).toBe("-R$ 50,00");
  });
});

describe("Chave do item (4.3)", () => {
  it("N distingue lançamentos idênticos", () => {
    const c = contasDoEstado(estado([lanc({ descricao: "Internet", valor: 120 }), lanc({ descricao: "Internet", valor: 120 })]));
    expect(c.pagar.map((i) => i.chave)).toEqual([
      "Lançamento|Internet|46336|120|1",
      "Lançamento|Internet|46336|120|2",
    ]);
  });
  it("linha sem descrição não vira item", () => {
    const c = contasDoEstado(estado([lanc({ descricao: "" })]));
    expect(c.pagar).toHaveLength(0);
  });
  it("Entrada vai para Receber, Saída para Pagar", () => {
    const c = contasDoEstado(estado([lanc({ tipo: "Entrada" }), lanc({})]));
    expect(c.receber).toHaveLength(1);
    expect(c.pagar).toHaveLength(1);
  });
});

describe("Baixa ✔ e desfazer (4.4, 4.5, 4.6)", () => {
  const e = estado([
    lanc({ descricao: "A", vencimento: "2026-11-05" }),
    lanc({ descricao: "B", vencimento: "2026-11-20" }),
    lanc({ descricao: "C", vencimento: "2026-11-01" }),
  ]);
  const filtro = { dataEscolhida: null, visualizar: "Data / mês atual" as const };

  it("dar baixa grava em Baixas e move o item para o fim; desfazer volta", () => {
    let c = contasDoEstado(e);
    expect(listaDeContas(c.pagar, filtro, c.hoje).map((i) => i.descricao)).toEqual(["C", "A", "B"]);

    const itemC = c.pagar.find((i) => i.descricao === "C")!;
    e.baixas = alternarBaixas(e.baixas, [itemC], "Pagar", "2026-11-18");
    expect(e.baixas).toEqual([{
      chave: "Lançamento|C|46327|100|1", tipo: "Pagar", descricao: "C",
      vencimento: "2026-11-01", valor: 100, dataBaixa: "2026-11-18", observacao: "",
    }]);
    c = contasDoEstado(e);
    expect(listaDeContas(c.pagar, filtro, c.hoje).map((i) => i.descricao)).toEqual(["A", "B", "C"]);
    expect(cardsDeContas(c.pagar, filtro, c.hoje)).toEqual({
      totalNoPeriodo: 300, emAbertoNoPeriodo: 200, totalEmAberto: 200, emAtraso: 100,
    });

    e.baixas = alternarBaixas(e.baixas, [c.pagar.find((i) => i.descricao === "C")!], "Pagar", "2026-11-18");
    expect(e.baixas).toEqual([]);
    c = contasDoEstado(e);
    expect(listaDeContas(c.pagar, filtro, c.hoje).map((i) => i.descricao)).toEqual(["C", "A", "B"]);
  });

  it("marca vários itens de uma vez", () => {
    const c = contasDoEstado(e);
    const b = alternarBaixas([], c.pagar, "Pagar", "2026-11-18");
    expect(b).toHaveLength(3);
    expect(contasDoEstado({ ...e, baixas: b }).pagar.every((i) => i.pago)).toBe(true);
  });

  it("baixa de Pagar não marca item de Receber com a mesma chave", () => {
    const e2 = estado([lanc({ descricao: "X", tipo: "Entrada" })]);
    const c = contasDoEstado(e2);
    e2.baixas = [{ ...alternarBaixas([], c.receber, "Receber", "2026-11-18")[0]!, tipo: "Pagar" }];
    expect(contasDoEstado(e2).receber[0]!.pago).toBe(false);
  });

  it("títulos da lista", () => {
    expect(tituloDaLista("Pagar", filtro)).toBe("CONTAS DO MÊS ATUAL (pagas no final)");
    expect(tituloDaLista("Receber", { dataEscolhida: 46346, visualizar: "Data / mês atual" })).toBe(
      "RECEBIMENTOS DA DATA ESCOLHIDA (recebidos no final)");
    expect(tituloDaLista("Pagar", { dataEscolhida: 46346, visualizar: "Todas as datas" })).toBe(
      "TODAS AS CONTAS (pagas no final)");
  });
});

describe("Recorrência mensal (4.9)", () => {
  const hoje = isoParaSerial("2026-11-17");

  it("gera até o fim do mês de Hoje + N meses e não duplica", () => {
    const base = [lanc({ descricao: "Aluguel", vencimento: "2026-11-10", dataEntrada: "2026-11-01", recorrente: "Mensal" })];
    const novas = gerarRecorrentes(base, hoje, 3, id);
    expect(novas.map((l) => [l.vencimento, l.dataEntrada, l.recorrente])).toEqual([
      ["2026-12-10", "2026-12-01", "Mensal"],
      ["2027-01-10", "2027-01-01", "Mensal"],
      ["2027-02-10", "2027-02-01", "Mensal"],
    ]);
    expect(gerarRecorrentes([...base, ...novas], hoje, 3, id)).toEqual([]);
  });

  it("vale a última ocorrência; sem 'Mensal' nela, não gera", () => {
    const l = [
      lanc({ descricao: "Luz", vencimento: "2026-10-10", recorrente: "Mensal" }),
      lanc({ descricao: " luz ", vencimento: "2026-11-10", recorrente: "" }),
    ];
    expect(gerarRecorrentes(l, hoje, 3, id)).toEqual([]);
  });

  it("valor novo na última linha vale para as próximas cópias", () => {
    const l = [
      lanc({ descricao: "Net", vencimento: "2026-10-10", valor: 100 }),
      lanc({ descricao: "Net", vencimento: "2026-11-10", valor: 130, recorrente: "Mensal" }),
    ];
    expect(gerarRecorrentes(l, hoje, 1, id).map((x) => x.valor)).toEqual([130]);
  });

  it("recupera meses em atraso, no máximo 36 por execução", () => {
    const l = [lanc({ descricao: "Velha", vencimento: "2020-01-15", recorrente: "Mensal" })];
    const novas = gerarRecorrentes(l, hoje, 3, id);
    expect(novas).toHaveLength(36);
    expect(novas[35]!.vencimento).toBe("2023-01-15");
  });

  it("fim de mês segue o EDATE a partir da última ocorrência", () => {
    const l = [lanc({ descricao: "Fim", vencimento: "2026-10-31", recorrente: "Mensal" })];
    expect(gerarRecorrentes(l, hoje, 3, id).map((x) => x.vencimento)).toEqual([
      "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28",
    ]);
  });

  it("Data de entrada vazia vira o novo vencimento; meses vazio vale 1", () => {
    const l = [lanc({ descricao: "Y", vencimento: "2026-11-05", recorrente: "Mensal" })];
    const novas = gerarRecorrentes(l, hoje, null, id);
    expect(novas.map((x) => [x.vencimento, x.dataEntrada])).toEqual([["2026-12-05", "2026-12-05"]]);
  });
});

describe("Critério de aceite 4: recorrência ao abrir o app", () => {
  it("marcar 'Mensal', abrir em outra data (Hoje) e conferir as novas linhas, sem duplicar", () => {
    let e = estado([
      lanc({ descricao: "Internet", vencimento: "2026-10-15", valor: 120 }),
      lanc({ descricao: "Internet", vencimento: "2026-11-15", valor: 120 }),
    ]);
    // Abrir o app sem nenhuma conta "Mensal": nada muda.
    expect(aplicarRecorrencia(e, id).geradas).toBe(0);

    // Marcar "Mensal" na última linha: gera até fev/2027 (Hoje 17/11/2026 + 3 meses).
    e.lancamentos[1] = { ...e.lancamentos[1]!, recorrente: "Mensal" };
    let r = aplicarRecorrencia(e, id);
    expect(r.geradas).toBe(3);
    e = r.estado;
    expect(e.lancamentos.map((l) => l.vencimento)).toEqual([
      "2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15",
    ]);

    // Abrir de novo no mesmo dia: não duplica.
    expect(aplicarRecorrencia(e, id).geradas).toBe(0);

    // Abrir em outra data (Hoje = 10/01/2027): gera só março e abril.
    e = { ...e, parametros: { ...e.parametros, hojeFixo: "2027-01-10" } };
    r = aplicarRecorrencia(e, id);
    expect(r.estado.lancamentos.slice(5).map((l) => l.vencimento)).toEqual(["2027-03-15", "2027-04-15"]);
    expect(aplicarRecorrencia(r.estado, id).geradas).toBe(0);

    // As cópias aparecem em Contas a Pagar.
    expect(contasDoEstado(r.estado).pagar.filter((i) => i.descricao === "Internet")).toHaveLength(7);
  });

  it("para encerrar, limpar Recorrente na última linha", () => {
    const e = estado([lanc({ descricao: "Academia", vencimento: "2026-11-05", recorrente: "Mensal" })]);
    const r = aplicarRecorrencia(e, id);
    const ultima = r.estado.lancamentos.length - 1;
    r.estado.lancamentos[ultima] = { ...r.estado.lancamentos[ultima]!, recorrente: "" };
    expect(aplicarRecorrencia({ ...r.estado, parametros: { ...r.estado.parametros, hojeFixo: "2027-12-01" } }, id).geradas).toBe(0);
  });
});

describe("Diagnóstico (seção 5): três cenários", () => {
  it("regra de classificação", () => {
    expect(classificar(-1, 100, 0, 0.5, 0.9)).toBe("❌ FORA DE CONTROLE");
    expect(classificar(10, -1, 0, 0.5, 0.9)).toBe("⚠️ ATENÇÃO");
    expect(classificar(10, 1, 50, 0.5, 0.9)).toBe("⚠️ ATENÇÃO");
    expect(classificar(10, 1, 0, 0.95, 0.9)).toBe("⚠️ ATENÇÃO");
    expect(classificar(10, 1, 0, 0.9, 0.9)).toBe("✅ CONTAS EM CONTROLE");
  });

  it("cenários completos com frases", () => {
    const sal = lanc({ descricao: "Salário", tipo: "Entrada", categoria: "Salário", valor: 1000, vencimento: "2026-11-20" });
    const ok = calcularDashboard(contasDoEstado(estado([sal, lanc({ valor: 500, vencimento: "2026-11-25" })])), null);
    expect(ok.situacao).toBe("✅ CONTAS EM CONTROLE");
    expect(ok.frases[3]).toBe("Comprometimento da renda no mês: 50,0% (limite definido: 90%).");

    const atraso = calcularDashboard(contasDoEstado(estado([sal, lanc({ valor: 300, vencimento: "2026-11-02" })])), null);
    expect(atraso.situacao).toBe("⚠️ ATENÇÃO");
    expect(atraso.frases[2]).toBe("Há R$ 300,00 em contas a pagar vencidas e ainda em aberto.");

    const fora = calcularDashboard(contasDoEstado(estado([sal, lanc({ valor: 1500, vencimento: "2026-11-25" })])), null);
    expect(fora.situacao).toBe("❌ FORA DE CONTROLE");
    expect(fora.frases[0]).toBe("Mês analisado: déficit de R$ 500,00 (entradas R$ 1.000,00 × saídas R$ 1.500,00).");
  });

  it("comprometimento sem entradas", () => {
    expect(calcularDashboard(contasDoEstado(estado([lanc({})])), null).comprometimento).toBe(1);
    expect(calcularDashboard(contasDoEstado(estado([])), null).comprometimento).toBe(0);
  });
});
