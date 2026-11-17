import { edate, eomonth, isoParaSerial, serialParaIso } from "./datas";
import { analisarCodigo } from "./pagamento";
import type { Lancamento } from "./tipos";

export const MAX_MESES_POR_EXECUCAO = 36;

/** Pix pode ser pago todo mês com o mesmo código; boleto (linha digitável ou código de barras) não. */
export function repeteCodigo(codigo: string | undefined): boolean {
  const c = analisarCodigo(codigo);
  return !!c && c.tipo !== "boleto" && c.tipo !== "barras" && c.tipo !== "convenio";
}

/** Meses futuros: vazio ou inválido vale 1, como na macro. */
export function mesesDeRecorrencia(valor: number | null): number {
  return valor !== null && Number.isFinite(valor) ? Math.trunc(valor) : 1;
}

/**
 * Gera os lançamentos "Mensal" que faltam (seção 4.9, macro GerarRecorrentes).
 * Conta = Descrição (sem espaços nas pontas, sem diferenciar maiúsculas) + Tipo.
 * Vale a última ocorrência (maior Vencimento; no empate, a linha mais abaixo).
 * Se ela estiver "Mensal", gera cópias em Vencimento + k meses até o último dia
 * do mês de (Hoje + N meses), no máximo 36 por execução. As cópias vão para o
 * final da lista. Devolve apenas as linhas novas.
 */
export function gerarRecorrentes(
  lancs: Lancamento[],
  hoje: number,
  meses: number | null,
  novoId: () => string,
): Lancamento[] {
  const limite = eomonth(hoje, mesesDeRecorrencia(meses));

  const ultima = new Map<string, Lancamento>();
  for (const l of lancs) {
    if (l.descricao.trim() === "" || !l.vencimento) continue;
    const k = l.descricao.trim().toLocaleLowerCase("pt-BR") + "|" + l.tipo;
    const atual = ultima.get(k);
    if (!atual || isoParaSerial(l.vencimento) >= isoParaSerial(atual.vencimento!)) ultima.set(k, l);
  }

  const novas: Lancamento[] = [];
  for (const r of ultima.values()) {
    if (r.recorrente !== "Mensal") continue;
    const venc = isoParaSerial(r.vencimento!);
    const entrada = r.dataEntrada ? isoParaSerial(r.dataEntrada) : null;
    for (let m = 1; m <= MAX_MESES_POR_EXECUCAO && edate(venc, m) <= limite; m++) {
      const v = edate(venc, m);
      // Pix se repete nos próximos meses; código de barras de boleto é de uma cobrança só e não é copiado.
      const { codigoPagamento: _codigo, ...semCodigo } = r;
      const copia = repeteCodigo(r.codigoPagamento) ? r : semCodigo;
      novas.push({
        ...copia,
        id: novoId(),
        vencimento: serialParaIso(v),
        dataEntrada: serialParaIso(entrada !== null ? edate(entrada, m) : v),
      });
    }
  }
  return novas;
}
