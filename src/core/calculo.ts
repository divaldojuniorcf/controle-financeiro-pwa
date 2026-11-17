import { hojeDoAparelho, isoParaSerial } from "./datas";
import { calcularInvestimentos, resumirInvestimentos } from "./investimentos";
import { itensAPagar, itensAReceber } from "./itens";
import { gerarRecorrentes } from "./recorrencia";
import type { Estado } from "./tipos";

/** "Hoje" dos Parâmetros: data fixa, ou a data atual do aparelho. */
export function hojeDoEstado(estado: Estado, agora: Date = new Date()): number {
  return isoParaSerial(estado.parametros.hojeFixo ?? hojeDoAparelho(agora));
}

/** Recalcula tudo o que as telas usam a partir do estado. */
export function contasDoEstado(estado: Estado, agora: Date = new Date()) {
  const hoje = hojeDoEstado(estado, agora);
  const investimentos = calcularInvestimentos(estado.investimentos, hoje, estado.parametros.diasProjecao);
  return {
    hoje,
    parametros: estado.parametros,
    investimentos,
    resumoInv: resumirInvestimentos(investimentos),
    pagar: itensAPagar(estado.lancamentos, investimentos, estado.baixas),
    receber: itensAReceber(estado.lancamentos, investimentos, estado.baixas),
  };
}

export type Contas = ReturnType<typeof contasDoEstado>;

/**
 * Roda a recorrência mensal (seção 4.9) sobre o estado: acrescenta no final
 * as cópias que faltam. Usada ao abrir o app e ao mudar o campo Recorrente.
 */
export function aplicarRecorrencia(
  estado: Estado,
  novoId: () => string,
  agora: Date = new Date(),
): { estado: Estado; geradas: number } {
  const novas = gerarRecorrentes(estado.lancamentos, hojeDoEstado(estado, agora), estado.parametros.mesesRecorrencia, novoId);
  if (novas.length === 0) return { estado, geradas: 0 };
  return { estado: { ...estado, lancamentos: [...estado.lancamentos, ...novas] }, geradas: novas.length };
}
