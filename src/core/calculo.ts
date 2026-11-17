import { hojeDoAparelho, isoParaSerial } from "./datas";
import { calcularInvestimentos, resumirInvestimentos } from "./investimentos";
import { itensAPagar, itensAReceber } from "./itens";
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
