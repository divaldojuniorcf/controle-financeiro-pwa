// Importar e exportar (JSON e CSV) entre o app e arquivos.
import { gerarBackup } from "../core/backup";
import { baixasParaCsv, importarCsv, investimentosParaCsv, lancamentosParaCsv, parametrosParaCsv } from "../core/csv";
import { importarDados } from "../core/importacao";
import type { DataISO, Estado } from "../core/tipos";
import { dataParaNomeDeArquivo, salvarArquivo } from "../storage/arquivos";
import { novoId } from "./estado";

export async function lerJson(arquivo: File) {
  let json: unknown;
  try {
    json = JSON.parse(await arquivo.text());
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  return importarDados(json, novoId);
}

export function resumoDaImportacao(e: Estado): string {
  return `${e.lancamentos.length} lançamentos, ${e.investimentos.length} investimentos e ${e.baixas.length} baixas.`;
}

export async function exportarJson(estado: Estado, dataAnalise: DataISO | null): Promise<void> {
  const conteudo = JSON.stringify(gerarBackup(estado, dataAnalise), null, 2);
  await salvarArquivo(`controle-financeiro-${dataParaNomeDeArquivo()}.json`, conteudo, "application/json");
}

const NOMES_CSV = {
  lancamentos: "Lançamentos",
  investimentos: "Investimentos",
  baixas: "Baixas",
  parametros: "Parâmetros",
} as const;

export async function exportarCsv(estado: Estado, tabela: keyof typeof NOMES_CSV): Promise<void> {
  const conteudo =
    tabela === "lancamentos" ? lancamentosParaCsv(estado.lancamentos)
      : tabela === "investimentos" ? investimentosParaCsv(estado.investimentos)
      : tabela === "baixas" ? baixasParaCsv(estado.baixas)
      : parametrosParaCsv(estado.parametros);
  await salvarArquivo(`${NOMES_CSV[tabela]}-${dataParaNomeDeArquivo()}.csv`, conteudo, "text/csv");
}

/** Lê um CSV exportado pelo app e devolve o estado com aquela tabela substituída. */
export async function aplicarCsv(arquivo: File, estado: Estado): Promise<{ estado: Estado; descricao: string }> {
  const r = importarCsv(await arquivo.text());
  switch (r.tabela) {
    case "lancamentos":
      return {
        estado: { ...estado, lancamentos: r.dados.map((l) => ({ ...l, id: novoId() })) },
        descricao: `${r.dados.length} lançamentos (substituem os atuais)`,
      };
    case "investimentos":
      return {
        estado: { ...estado, investimentos: r.dados.map((i) => ({ ...i, id: novoId() })) },
        descricao: `${r.dados.length} investimentos (substituem os atuais)`,
      };
    case "baixas":
      return { estado: { ...estado, baixas: r.dados }, descricao: `${r.dados.length} baixas (substituem as atuais)` };
    case "parametros":
      return { estado: { ...estado, parametros: r.dados }, descricao: "Parâmetros e listas de categorias (substituem os atuais)" };
  }
}
