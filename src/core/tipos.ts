/** Data civil no formato "aaaa-mm-dd" (sem hora e sem fuso). */
export type DataISO = string;

export type TipoLancamento = "Entrada" | "Saída";
export type TipoBaixa = "Pagar" | "Receber";
export type Origem = "Lançamento" | "Investimento";

/** Linha da tabela tblLanc. A ordem do array é a ordem das linhas na planilha. */
export interface Lancamento {
  id: string;
  dataEntrada: DataISO | null;
  vencimento: DataISO | null;
  descricao: string;
  tipo: string; // "Entrada" | "Saída" (texto livre na planilha; só esses dois geram itens)
  categoria: string;
  valor: number | null;
  recorrente: string; // "" | "Mensal"
}

/** Linha da tabela tblInv (só os campos digitados). */
export interface Investimento {
  id: string;
  dataAporte: DataISO | null;
  ativo: string;
  valorInvestido: number | null;
  rentabilidadeAA: number | null; // 0,135 = 13,5% a.a.
  dataResgate: DataISO | null;
}

/** Linha da aba Baixas. */
export interface Baixa {
  chave: string;
  tipo: TipoBaixa;
  descricao: string;
  vencimento: DataISO | null;
  valor: number | null;
  dataBaixa: DataISO;
  observacao: string;
}

export interface Parametros {
  /** null = data atual do aparelho (como HOJE() na planilha). */
  hojeFixo: DataISO | null;
  limiteComprometimento: number;
  diasProjecao: number;
  /** null ou inválido = 1, como na macro. */
  mesesRecorrencia: number | null;
  categoriasSaida: string[];
  categoriasEntrada: string[];
}

export interface Estado {
  lancamentos: Lancamento[];
  investimentos: Investimento[];
  baixas: Baixa[];
  parametros: Parametros;
}

/** Item de Contas a Pagar ou Contas a Receber (colunas AA:AG da planilha). */
export interface ItemConta {
  pago: boolean;
  origem: Origem;
  descricao: string;
  categoria: string;
  /** Número serial do Excel (0 se a data estiver vazia, como o FILTER faz). */
  vencimento: number;
  /** null quando a célula de origem está vazia (fica fora de todas as somas). */
  valor: number | null;
  chave: string;
  /** Posição na base da planilha (lançamentos primeiro, depois investimentos). */
  indice: number;
  /** id do lançamento ou investimento que gerou o item. */
  ref: string;
}
