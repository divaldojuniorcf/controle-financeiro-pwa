import { serialParaIso } from "./datas";
import { normalizar } from "./itens";
import type { Baixa, DataISO, ItemConta, TipoBaixa } from "./tipos";

/**
 * Marca ✔ em um ou mais itens (seção 4.5, macro ProcessarBaixa): se o item
 * não tem baixa, registra; se já tem, remove (desfaz). Devolve a nova lista.
 * `dataReal` é a data real do aparelho, não o "Hoje" dos Parâmetros.
 */
export function alternarBaixas(
  baixas: Baixa[],
  itens: ItemConta[],
  tipo: TipoBaixa,
  dataReal: DataISO,
): Baixa[] {
  let resultado = [...baixas];
  for (const item of itens) {
    const i = resultado.findIndex(
      (b) => normalizar(b.chave) === normalizar(item.chave) && normalizar(b.tipo) === normalizar(tipo),
    );
    if (i >= 0) {
      resultado = [...resultado.slice(0, i), ...resultado.slice(i + 1)];
    } else {
      resultado.push({
        chave: item.chave,
        tipo,
        descricao: item.descricao,
        vencimento: item.vencimento ? serialParaIso(item.vencimento) : null,
        valor: item.valor,
        dataBaixa: dataReal,
        observacao: "",
      });
    }
  }
  return resultado;
}
