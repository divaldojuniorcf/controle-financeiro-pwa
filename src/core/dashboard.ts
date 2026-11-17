import type { Contas } from "./calculo";
import { date, edate, eomonth, primeiroDiaDoMes, ano } from "./datas";
import { textoIgual } from "./itens";
import { fixo, somar } from "./numeros";
import type { ItemConta, Parametros } from "./tipos";

/** Quantas categorias a planilha lê para o Dashboard (Parâmetros!A10:A21 e C10:C17). */
export const LINHAS_CATEGORIAS_SAIDA = 12;
export const LINHAS_CATEGORIAS_ENTRADA = 8;

/** Listas CatSaida e CatEntrada da planilha: menu de Categoria conforme o Tipo. */
export function categoriasDoTipo(p: Parametros, tipo: string): string[] {
  if (tipo === "Saída") return p.categoriasSaida.slice(0, LINHAS_CATEGORIAS_SAIDA).filter((c) => c !== "");
  if (tipo === "Entrada") return p.categoriasEntrada.slice(0, LINHAS_CATEGORIAS_ENTRADA).filter((c) => c !== "");
  return [];
}

export type Situacao = "❌ FORA DE CONTROLE" | "⚠️ ATENÇÃO" | "✅ CONTAS EM CONTROLE";

export const CORES_SITUACAO: Record<Situacao, { fundo: string; texto: string }> = {
  "✅ CONTAS EM CONTROLE": { fundo: "#C6EFCE", texto: "#006100" },
  "⚠️ ATENÇÃO": { fundo: "#FFEB9C", texto: "#7F6000" },
  "❌ FORA DE CONTROLE": { fundo: "#FFC7CE", texto: "#9C0006" },
};

export interface LinhaMensal { mes: number; entradas: number; saidas: number; saldo: number; saldoAcumulado: number }
export interface LinhaCategoriaSaida { categoria: string; valor: number; pctRenda: number; pctSaidas: number }
export interface LinhaFonteEntrada { categoria: string; valor: number; pctEntradas: number }
export interface LinhaComposicao { nome: string; valor: number; pct: number }
export interface LinhaSituacaoContas { nome: string; baixado: number; emAberto: number }

export interface Dashboard {
  dataAnalise: number;
  mesAnalisado: number;
  // DATA ESCOLHIDA
  entradasData: number;
  saidasData: number;
  saldoData: number;
  // MÊS ANALISADO
  entradasMes: number;
  saidasMes: number;
  saldoMes: number;
  // TODAS AS DATAS
  aPagarEmAberto: number;
  aReceberEmAberto: number;
  saldoEmAberto: number;
  carteiraAtual: number;
  rendimentoAcumulado: number;
  rendimentoProjetado12m: number;
  // Indicadores do diagnóstico
  pagarVencidasEmAberto: number;
  comprometimento: number;
  limiteComprometimento: number;
  pctRendaInvestida: number;
  pctRendaRendimentos: number;
  situacao: Situacao;
  frases: [string, string, string, string];
  // Tabelas de apoio dos gráficos
  mensal: LinhaMensal[];
  categoriasSaida: LinhaCategoriaSaida[];
  totalCategoriasSaida: { valor: number; pctRenda: number; pctSaidas: number };
  fontesEntrada: LinhaFonteEntrada[];
  totalFontesEntrada: { valor: number; pctEntradas: number };
  composicaoCarteira: LinhaComposicao[];
  situacaoContas: LinhaSituacaoContas[];
}

export const REGRA_DIAGNOSTICO =
  "Regra: FORA DE CONTROLE = saldo do mês negativo; ATENÇÃO = déficit na data, conta vencida em aberto ou comprometimento acima do limite; senão, EM CONTROLE.";

const soma = (itens: ItemConta[]) => somar(itens.map((i) => i.valor));
const noIntervalo = (itens: ItemConta[], ini: number, fim: number) =>
  itens.filter((i) => i.vencimento >= ini && i.vencimento <= fim);
const naData = (itens: ItemConta[], d: number) => itens.filter((i) => i.vencimento === d);
const daCategoria = (itens: ItemConta[], c: string) => itens.filter((i) => textoIgual(i.categoria, c));

export function classificar(saldoMes: number, saldoData: number, vencidas: number, comp: number, limite: number): Situacao {
  if (saldoMes < 0) return "❌ FORA DE CONTROLE";
  if (saldoData < 0 || vencidas > 0 || comp > limite) return "⚠️ ATENÇÃO";
  return "✅ CONTAS EM CONTROLE";
}

/** Seção 5. `dataAnaliseEscolhida` null = Hoje. */
export function calcularDashboard(
  contas: Contas,
  dataAnaliseEscolhida: number | null,
): Dashboard {
  const { pagar, receber, resumoInv, hoje, parametros } = contas;
  const dataAnalise = dataAnaliseEscolhida ?? hoje;
  const mesAnalisado = primeiroDiaDoMes(dataAnalise);
  const fimMes = eomonth(mesAnalisado, 0);

  const entradasData = soma(naData(receber, dataAnalise));
  const saidasData = soma(naData(pagar, dataAnalise));
  const saldoData = entradasData - saidasData;

  const recMes = noIntervalo(receber, mesAnalisado, fimMes);
  const pagMes = noIntervalo(pagar, mesAnalisado, fimMes);
  const entradasMes = soma(recMes);
  const saidasMes = soma(pagMes);
  const saldoMes = entradasMes - saidasMes;

  const aPagarEmAberto = soma(pagar.filter((i) => !i.pago));
  const aReceberEmAberto = soma(receber.filter((i) => !i.pago));
  const pagarVencidasEmAberto = soma(pagar.filter((i) => !i.pago && i.vencimento < hoje));

  const comprometimento = entradasMes > 0 ? saidasMes / entradasMes : saidasMes > 0 ? 1 : 0;
  const limite = parametros.limiteComprometimento;
  const pctRendaInvestida = entradasMes > 0 ? soma(daCategoria(pagMes, "Investimentos")) / entradasMes : 0;
  const pctRendaRendimentos =
    entradasMes > 0 ? soma(daCategoria(recMes, "Rendimentos de investimentos")) / entradasMes : 0;

  const situacao = classificar(saldoMes, saldoData, pagarVencidasEmAberto, comprometimento, limite);
  const sd = (x: number) => (x >= 0 ? "superávit" : "déficit");
  const frases: Dashboard["frases"] = [
    `Mês analisado: ${sd(saldoMes)} de R$ ${fixo(Math.abs(saldoMes), 2)} (entradas R$ ${fixo(entradasMes, 2)} × saídas R$ ${fixo(saidasMes, 2)}).`,
    `Data de análise: ${sd(saldoData)} de R$ ${fixo(Math.abs(saldoData), 2)}.`,
    pagarVencidasEmAberto > 0
      ? `Há R$ ${fixo(pagarVencidasEmAberto, 2)} em contas a pagar vencidas e ainda em aberto.`
      : "Nenhuma conta a pagar vencida em aberto.",
    `Comprometimento da renda no mês: ${fixo(comprometimento * 100, 1)}% (limite definido: ${fixo(limite * 100, 0)}%).`,
  ];

  // Mensal do ano analisado (jan a dez)
  const jan = date(ano(dataAnalise), 1, 1);
  let acumulado = 0;
  const mensal = Array.from({ length: 12 }, (_, k) => {
    const ini = edate(jan, k);
    const fim = eomonth(ini, 0);
    const entradas = soma(noIntervalo(receber, ini, fim));
    const saidas = soma(noIntervalo(pagar, ini, fim));
    acumulado += entradas - saidas;
    return { mes: ini, entradas, saidas, saldo: entradas - saidas, saldoAcumulado: acumulado };
  });

  // Categorias de saída (mês)
  const catS = parametros.categoriasSaida.slice(0, LINHAS_CATEGORIAS_SAIDA).filter((c) => c !== "");
  const valoresS = catS.map((c) => soma(daCategoria(pagMes, c)));
  const somaS = somar(valoresS);
  const categoriasSaida = catS.map((categoria, k) => ({
    categoria,
    valor: valoresS[k]!,
    pctRenda: entradasMes > 0 ? valoresS[k]! / entradasMes : 0,
    pctSaidas: somaS > 0 ? valoresS[k]! / somaS : 0,
  }));

  // Fontes de entrada (mês)
  const catE = parametros.categoriasEntrada.slice(0, LINHAS_CATEGORIAS_ENTRADA).filter((c) => c !== "");
  const valoresE = catE.map((c) => soma(daCategoria(recMes, c)));
  const somaE = somar(valoresE);
  const fontesEntrada = catE.map((categoria, k) => ({
    categoria,
    valor: valoresE[k]!,
    pctEntradas: somaE > 0 ? valoresE[k]! / somaE : 0,
  }));

  // Composição da carteira
  const comp = [
    { nome: "Capital investido", valor: resumoInv.totalInvestido },
    { nome: "Rendimento até hoje", valor: resumoInv.rendimentoAcumulado },
    {
      nome: "Rend. projetado adicional (12m)",
      valor: Math.max(0, resumoInv.rendimentoProjetado - resumoInv.rendimentoAcumulado),
    },
  ];
  const somaComp = comp.reduce((s, c) => s + c.valor, 0);

  return {
    dataAnalise,
    mesAnalisado,
    entradasData, saidasData, saldoData,
    entradasMes, saidasMes, saldoMes,
    aPagarEmAberto,
    aReceberEmAberto,
    saldoEmAberto: aReceberEmAberto - aPagarEmAberto,
    carteiraAtual: resumoInv.carteiraAtual,
    rendimentoAcumulado: resumoInv.rendimentoAcumulado,
    rendimentoProjetado12m: resumoInv.rendimentoProjetado,
    pagarVencidasEmAberto,
    comprometimento,
    limiteComprometimento: limite,
    pctRendaInvestida,
    pctRendaRendimentos,
    situacao,
    frases,
    mensal,
    categoriasSaida,
    totalCategoriasSaida: {
      valor: somaS,
      pctRenda: categoriasSaida.reduce((s, c) => s + c.pctRenda, 0),
      pctSaidas: categoriasSaida.reduce((s, c) => s + c.pctSaidas, 0),
    },
    fontesEntrada,
    totalFontesEntrada: { valor: somaE, pctEntradas: fontesEntrada.reduce((s, c) => s + c.pctEntradas, 0) },
    composicaoCarteira: comp.map((c) => ({ ...c, pct: somaComp > 0 ? c.valor / somaComp : 0 })),
    situacaoContas: [
      { nome: "Contas a pagar", baixado: soma(pagar.filter((i) => i.pago)), emAberto: aPagarEmAberto },
      { nome: "Contas a receber", baixado: soma(receber.filter((i) => i.pago)), emAberto: aReceberEmAberto },
    ],
  };
}
