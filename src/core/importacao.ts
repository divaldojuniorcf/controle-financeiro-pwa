import type { Baixa, Estado, Investimento, Lancamento, Parametros, TipoBaixa } from "./tipos";

/** Formato do dados.json exportado da planilha (e também do backup do app). */
export interface ArquivoDados {
  formato: string;
  versao: number;
  parametros: Partial<Parametros> & { hoje?: string | null };
  lancamentos: Omit<Lancamento, "id">[];
  investimentos: Omit<Investimento, "id">[];
  baixas: Baixa[];
  dashboard?: { dataAnalise?: string | null };
}

export const FORMATOS_ACEITOS = ["controle-financeiro-planilha", "controle-financeiro-app"];

export const PARAMETROS_PADRAO: Parametros = {
  hojeFixo: null,
  limiteComprometimento: 0.9,
  diasProjecao: 365,
  mesesRecorrencia: 3,
  categoriasSaida: [
    "Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer",
    "Cartão de crédito", "Contas da casa", "Impostos e taxas", "Dívidas e empréstimos",
    "Investimentos", "Outras saídas",
  ],
  categoriasEntrada: [
    "Salário", "Freelance e extras", "Aluguel recebido", "Vendas",
    "Rendimentos de investimentos", "Outras entradas", "Reembolsos", "Presentes e doações",
  ],
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function data(v: unknown, campo: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !ISO.test(v)) throw new Error(`${campo}: data inválida (${String(v)})`);
  return v;
}

function numero(v: unknown, campo: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${campo}: número inválido (${String(v)})`);
  return v;
}

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Lê e valida um dados.json. Lança Error com mensagem em pt-BR se algo estiver errado. */
export function importarDados(json: unknown, novoId: () => string): { estado: Estado; dataAnalise: string | null } {
  if (typeof json !== "object" || json === null) throw new Error("Arquivo vazio ou inválido.");
  const a = json as Partial<ArquivoDados>;
  if (!a.formato || !FORMATOS_ACEITOS.includes(a.formato))
    throw new Error("Este arquivo não é um dados.json do Controle Financeiro.");
  if (!Array.isArray(a.lancamentos) || !Array.isArray(a.investimentos) || !Array.isArray(a.baixas))
    throw new Error("Faltam as listas de lançamentos, investimentos ou baixas.");

  const lancamentos: Lancamento[] = a.lancamentos.map((l, i) => {
    const c = `Lançamento ${i + 1}`;
    return {
      id: novoId(),
      dataEntrada: data(l.dataEntrada, `${c}, Data de entrada`),
      vencimento: data(l.vencimento, `${c}, Vencimento`),
      descricao: texto(l.descricao),
      tipo: texto(l.tipo),
      categoria: texto(l.categoria),
      valor: numero(l.valor, `${c}, Valor`),
      recorrente: texto(l.recorrente),
      ...(texto(l.codigoPagamento).trim() ? { codigoPagamento: texto(l.codigoPagamento).trim() } : {}),
    };
  });

  const investimentos: Investimento[] = a.investimentos.map((v, i) => {
    const c = `Investimento ${i + 1}`;
    return {
      id: novoId(),
      dataAporte: data(v.dataAporte, `${c}, Data do aporte`),
      ativo: texto(v.ativo),
      valorInvestido: numero(v.valorInvestido, `${c}, Valor investido`),
      rentabilidadeAA: numero(v.rentabilidadeAA, `${c}, Rentabilidade a.a.`),
      dataResgate: data(v.dataResgate, `${c}, Data de resgate`),
    };
  });

  const baixas: Baixa[] = a.baixas.map((b, i) => {
    const c = `Baixa ${i + 1}`;
    if (b.tipo !== "Pagar" && b.tipo !== "Receber") throw new Error(`${c}: tipo deve ser Pagar ou Receber.`);
    return {
      chave: texto(b.chave),
      tipo: b.tipo as TipoBaixa,
      descricao: texto(b.descricao),
      vencimento: data(b.vencimento, `${c}, Vencimento`),
      valor: numero(b.valor, `${c}, Valor`),
      dataBaixa: data(b.dataBaixa, `${c}, Data da baixa`) ?? "",
      observacao: texto(b.observacao),
    };
  });

  const p = a.parametros ?? {};
  const parametros: Parametros = {
    hojeFixo: data(p.hojeFixo ?? p.hoje, "Parâmetros, Hoje"),
    limiteComprometimento: numero(p.limiteComprometimento, "Limite") ?? PARAMETROS_PADRAO.limiteComprometimento,
    diasProjecao: numero(p.diasProjecao, "Dias da projeção") ?? PARAMETROS_PADRAO.diasProjecao,
    mesesRecorrencia: numero(p.mesesRecorrencia, "Meses futuros"),
    categoriasSaida: Array.isArray(p.categoriasSaida) ? p.categoriasSaida.map(texto) : PARAMETROS_PADRAO.categoriasSaida,
    categoriasEntrada: Array.isArray(p.categoriasEntrada) ? p.categoriasEntrada.map(texto) : PARAMETROS_PADRAO.categoriasEntrada,
  };

  return {
    estado: { lancamentos, investimentos, baixas, parametros },
    dataAnalise: data(a.dashboard?.dataAnalise, "Data de análise"),
  };
}
