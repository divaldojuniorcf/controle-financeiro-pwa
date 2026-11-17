import { isoParaSerial } from "./datas";
import type { InvestimentoCalculado } from "./investimentos";
import { textoExcel } from "./numeros";
import type { Baixa, ItemConta, Lancamento, Origem, TipoBaixa } from "./tipos";

/** Comparação de texto do Excel (=, COUNTIFS): ignora maiúsculas/minúsculas. */
export const normalizar = (s: string) => s.toLocaleLowerCase("pt-BR");
export const textoIgual = (a: string, b: string) => normalizar(a) === normalizar(b);

interface Bruto {
  origem: Origem;
  descricao: string;
  categoria: string;
  vencimento: number;
  valor: number | null;
  ref: string;
  codigoPagamento?: string;
}

const serial = (iso: string | null) => (iso ? isoParaSerial(iso) : 0);

/**
 * Monta a base de Contas a Pagar/Receber (seções 4.1 a 4.4), na mesma ordem
 * da planilha: lançamentos do tipo na ordem da tabela, depois investimentos.
 */
function montar(brutos: Bruto[], baixas: Baixa[], tipo: TipoBaixa): ItemConta[] {
  // Chave base = Origem|Descrição|Vencimento|Valor; N = ocorrência entre iguais.
  const contagem = new Map<string, number>();
  const baixadas = new Set(
    baixas.filter((b) => textoIgual(b.tipo, tipo)).map((b) => normalizar(b.chave)),
  );
  const itens: ItemConta[] = [];
  brutos.forEach((b, indice) => {
    if (b.descricao === "") return; // linha sem descrição não entra (ok = d<>"")
    const valorTxt = b.valor === null ? "" : textoExcel(b.valor);
    const base = `${b.origem}|${b.descricao}|${b.vencimento}|${valorTxt}`;
    const n = (contagem.get(normalizar(base)) ?? 0) + 1;
    contagem.set(normalizar(base), n);
    const chave = `${base}|${n}`;
    itens.push({ ...b, chave, pago: baixadas.has(normalizar(chave)), indice });
  });
  return itens;
}

export function itensAPagar(
  lancs: Lancamento[],
  invs: InvestimentoCalculado[],
  baixas: Baixa[],
): ItemConta[] {
  const brutos: Bruto[] = [
    ...lancs.filter((l) => textoIgual(l.tipo, "Saída")).map((l) => ({
      origem: "Lançamento" as const,
      descricao: l.descricao,
      categoria: l.categoria,
      vencimento: serial(l.vencimento),
      valor: l.valor,
      ref: l.id,
      codigoPagamento: l.codigoPagamento,
    })),
    ...invs.filter((i) => i.ativo !== "").map((i) => ({
      origem: "Investimento" as const,
      descricao: "Aporte: " + i.ativo,
      categoria: "Investimentos",
      vencimento: serial(i.dataAporte),
      valor: i.valorInvestido,
      ref: i.id,
    })),
  ];
  return montar(brutos, baixas, "Pagar");
}

export function itensAReceber(
  lancs: Lancamento[],
  invs: InvestimentoCalculado[],
  baixas: Baixa[],
): ItemConta[] {
  const brutos: Bruto[] = [
    ...lancs.filter((l) => textoIgual(l.tipo, "Entrada")).map((l) => ({
      origem: "Lançamento" as const,
      descricao: l.descricao,
      categoria: l.categoria,
      vencimento: serial(l.vencimento),
      valor: l.valor,
      ref: l.id,
    })),
    ...invs.filter((i) => i.ativo !== "" && i.dataResgate).map((i) => ({
      origem: "Investimento" as const,
      descricao: "Rendimento: " + i.ativo,
      categoria: "Rendimentos de investimentos",
      vencimento: serial(i.dataResgate),
      valor: i.rendimentoNoResgate,
      ref: i.id,
    })),
  ];
  return montar(brutos, baixas, "Receber");
}
