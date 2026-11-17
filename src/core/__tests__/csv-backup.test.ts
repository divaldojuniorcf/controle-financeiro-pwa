import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarBackup } from "../backup";
import { contasDoEstado } from "../calculo";
import {
  baixasParaCsv, importarCsv, investimentosParaCsv, lancamentosParaCsv, lerCsv, lerNumero, parametrosParaCsv,
} from "../csv";
import { calcularDashboard } from "../dashboard";
import { importarDados } from "../importacao";

let n = 0;
const id = () => `c${++n}`;
const sem = <T extends { id: string }>(xs: T[]) => xs.map(({ id: _i, ...r }) => r);

describe("CSV", () => {
  it("lê aspas, ponto e vírgula e quebras de linha", () => {
    expect(lerCsv('﻿a;b\r\n"x;y";"di""z"\r\n"linha\nnova";\r\n')).toEqual([
      ["a", "b"], ["x;y", 'di"z'], ["linha\nnova", ""],
    ]);
  });
  it("números em pt-BR", () => {
    expect(lerNumero("1.234,56", "")).toBe(1234.56);
    expect(lerNumero("R$ 99,9", "")).toBe(99.9);
    expect(lerNumero("0.135", "")).toBe(0.135);
    expect(lerNumero("", "")).toBeNull();
  });
  it("cabeçalho desconhecido dá erro claro", () => {
    expect(() => importarCsv("x;y\n1;2")).toThrow(/não reconhecido/);
  });
});

const ARQUIVO = resolve(__dirname, "../../../dados.json");

describe.skipIf(!existsSync(ARQUIVO))("Ida e volta com os dados da planilha", () => {
  const { estado } = existsSync(ARQUIVO)
    ? importarDados(JSON.parse(readFileSync(ARQUIVO, "utf8")), id)
    : ({ estado: null } as never);

  it("CSV exporta e reimporta sem perda", () => {
    const l = importarCsv(lancamentosParaCsv(estado.lancamentos));
    expect(l.dados).toEqual(sem(estado.lancamentos));
    const i = importarCsv(investimentosParaCsv(estado.investimentos));
    expect(i.dados).toEqual(sem(estado.investimentos));
    const b = importarCsv(baixasParaCsv(estado.baixas));
    expect(b.dados).toEqual(estado.baixas);
    const p = importarCsv(parametrosParaCsv(estado.parametros));
    expect(p.dados).toEqual(estado.parametros);
  });

  it("backup JSON reimporta com os mesmos resultados", () => {
    estado.parametros.hojeFixo = "2026-11-17";
    const volta = importarDados(JSON.parse(JSON.stringify(gerarBackup(estado, "2026-11-20"))), id);
    expect(volta.dataAnalise).toBe("2026-11-20");
    expect(sem(volta.estado.lancamentos)).toEqual(sem(estado.lancamentos));
    const a = calcularDashboard(contasDoEstado(estado), 46346);
    const b = calcularDashboard(contasDoEstado(volta.estado), 46346);
    expect(b).toEqual(a);
  });
});
