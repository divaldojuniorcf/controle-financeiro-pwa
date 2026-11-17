import { isoParaSerial } from "./datas";
import { somar } from "./numeros";
import type { Investimento } from "./tipos";

/** Linha de tblInv com as colunas calculadas (seção 4.10). null = célula vazia. */
export interface InvestimentoCalculado extends Investimento {
  diasAplicados: number | null;
  rendimentoAteHoje: number | null;
  valorAtual: number | null;
  rendimentoProjetado12m: number | null;
  totalProjetado12m: number | null;
  rendimentoNoResgate: number | null;
}

export interface ResumoInvestimentos {
  totalInvestido: number;
  rendimentoAcumulado: number;
  carteiraAtual: number;
  rendimentoProjetado: number;
  totalProjetado: number;
  rentabilidadeMediaPonderada: number;
}

const serial = (iso: string | null) => (iso ? isoParaSerial(iso) : 0);

export function calcularInvestimento(
  inv: Investimento,
  hoje: number,
  diasProjecao: number,
): InvestimentoCalculado {
  const vazio = {
    diasAplicados: null, rendimentoAteHoje: null, valorAtual: null,
    rendimentoProjetado12m: null, totalProjetado12m: null, rendimentoNoResgate: null,
  };
  if (inv.valorInvestido === null) return { ...inv, ...vazio };

  const valor = inv.valorInvestido;
  const taxa = inv.rentabilidadeAA ?? 0;
  const aporte = serial(inv.dataAporte);
  const resgate = inv.dataResgate ? isoParaSerial(inv.dataResgate) : null;
  const juros = (dias: number) => valor * ((1 + taxa) ** (dias / 365) - 1);

  const diasAplicados = Math.max(0, Math.min(hoje, resgate ?? hoje) - aporte);
  const rendimentoAteHoje = juros(diasAplicados);
  const fimProjecao = hoje + diasProjecao;
  const rendimentoProjetado12m = juros(Math.max(0, Math.min(fimProjecao, resgate ?? fimProjecao) - aporte));

  return {
    ...inv,
    diasAplicados,
    rendimentoAteHoje,
    valorAtual: valor + rendimentoAteHoje,
    rendimentoProjetado12m,
    totalProjetado12m: valor + rendimentoProjetado12m,
    rendimentoNoResgate: resgate === null ? null : juros(resgate - aporte),
  };
}

export function calcularInvestimentos(
  invs: Investimento[],
  hoje: number,
  diasProjecao: number,
): InvestimentoCalculado[] {
  return invs.map((i) => calcularInvestimento(i, hoje, diasProjecao));
}

export function resumirInvestimentos(calc: InvestimentoCalculado[]): ResumoInvestimentos {
  const totalInvestido = somar(calc.map((c) => c.valorInvestido));
  const somaProduto = calc.reduce(
    (s, c) => s + (c.valorInvestido ?? 0) * (c.rentabilidadeAA ?? 0),
    0,
  );
  return {
    totalInvestido,
    rendimentoAcumulado: somar(calc.map((c) => c.rendimentoAteHoje)),
    carteiraAtual: somar(calc.map((c) => c.valorAtual)),
    rendimentoProjetado: somar(calc.map((c) => c.rendimentoProjetado12m)),
    totalProjetado: somar(calc.map((c) => c.totalProjetado12m)),
    rentabilidadeMediaPonderada: totalInvestido !== 0 ? somaProduto / totalInvestido : 0,
  };
}
