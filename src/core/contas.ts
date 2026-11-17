import { eomonth, primeiroDiaDoMes } from "./datas";
import { somar } from "./numeros";
import type { ItemConta, TipoBaixa } from "./tipos";

export type Visualizar = "Data / mês atual" | "Todas as datas";

export interface FiltroContas {
  /** Serial da data escolhida; null = mês de Hoje. */
  dataEscolhida: number | null;
  visualizar: Visualizar;
}

export interface Periodo {
  inicio: number;
  fim: number;
}

/** Mês de Hoje (sem data escolhida) ou a data exata. */
export function periodoDoFiltro(dataEscolhida: number | null, hoje: number): Periodo {
  if (dataEscolhida === null) return { inicio: primeiroDiaDoMes(hoje), fim: eomonth(hoje, 0) };
  return { inicio: dataEscolhida, fim: dataEscolhida };
}

const dentro = (v: number, p: Periodo) => v >= p.inicio && v <= p.fim;

/** Itens do filtro (seção 4.6), sem ordenar. */
export function filtrarItens(itens: ItemConta[], filtro: FiltroContas, hoje: number): ItemConta[] {
  if (filtro.visualizar === "Todas as datas") return itens;
  const p = periodoDoFiltro(filtro.dataEscolhida, hoje);
  return itens.filter((i) => dentro(i.vencimento, p));
}

/** Em aberto primeiro, depois pagos; dentro de cada grupo, vencimento crescente (ordem estável). */
export function ordenarItens(itens: ItemConta[]): ItemConta[] {
  return [...itens].sort(
    (a, b) => Number(a.pago) - Number(b.pago) || a.vencimento - b.vencimento || a.indice - b.indice,
  );
}

export function listaDeContas(itens: ItemConta[], filtro: FiltroContas, hoje: number): ItemConta[] {
  return ordenarItens(filtrarItens(itens, filtro, hoje));
}

export interface CardsContas {
  totalNoPeriodo: number;
  emAbertoNoPeriodo: number;
  totalEmAberto: number;
  emAtraso: number;
}

/** Cards de Contas a Pagar/Receber (seção 4.7). */
export function cardsDeContas(itens: ItemConta[], filtro: FiltroContas, hoje: number): CardsContas {
  const doFiltro = filtrarItens(itens, filtro, hoje);
  const abertos = itens.filter((i) => !i.pago);
  return {
    totalNoPeriodo: somar(doFiltro.map((i) => i.valor)),
    emAbertoNoPeriodo: somar(doFiltro.filter((i) => !i.pago).map((i) => i.valor)),
    totalEmAberto: somar(abertos.map((i) => i.valor)),
    emAtraso: somar(abertos.filter((i) => i.vencimento < hoje).map((i) => i.valor)),
  };
}

/** Textos que mudam entre Contas a Pagar e Contas a Receber. */
export const TEXTOS_CONTAS = {
  Pagar: {
    titulo: "Contas a Pagar",
    ajuda:
      "Marque ✔ na conta paga: ela vai para o final da lista. Para desfazer, marque ✔ de novo.",
    listaTodas: "TODAS AS CONTAS",
    listaMes: "CONTAS DO MÊS ATUAL",
    listaData: "CONTAS DA DATA ESCOLHIDA",
    sufixo: " (pagas no final)",
    vazio: "Nenhuma conta neste período",
    situacaoBaixado: "✔ Pago",
    emAtraso: "Em atraso (vencidas e abertas)",
  },
  Receber: {
    titulo: "Contas a Receber",
    ajuda:
      "Marque ✔ no valor recebido: ele vai para o final da lista. Para desfazer, marque ✔ de novo.",
    listaTodas: "TODOS OS RECEBIMENTOS",
    listaMes: "RECEBIMENTOS DO MÊS ATUAL",
    listaData: "RECEBIMENTOS DA DATA ESCOLHIDA",
    sufixo: " (recebidos no final)",
    vazio: "Nenhum recebimento neste período",
    situacaoBaixado: "✔ Recebido",
    emAtraso: "Em atraso (vencidos e abertos)",
  },
} as const;

export function tituloDaLista(tipo: TipoBaixa, filtro: FiltroContas): string {
  const t = TEXTOS_CONTAS[tipo];
  const base =
    filtro.visualizar === "Todas as datas" ? t.listaTodas
      : filtro.dataEscolhida === null ? t.listaMes
      : t.listaData;
  return base + t.sufixo;
}

export function situacaoDoItem(tipo: TipoBaixa, item: ItemConta): string {
  return item.pago ? TEXTOS_CONTAS[tipo].situacaoBaixado : "Em aberto";
}

// ---------- Pagas e Recebidas (seção 4.8) ----------

export interface LinhaBaixada {
  tipo: "Pago" | "Recebido";
  item: ItemConta;
}

export interface PagasERecebidas {
  totalPago: number;
  totalRecebido: number;
  saldo: number;
  tituloLista: string;
  /** Baixas do mês de Hoje ou da data escolhida, por vencimento. */
  doPeriodo: LinhaBaixada[];
  /** Todas as baixas, por vencimento. */
  todas: LinhaBaixada[];
}

export function pagasERecebidas(
  pagar: ItemConta[],
  receber: ItemConta[],
  dataEscolhida: number | null,
  hoje: number,
): PagasERecebidas {
  const totalPago = somar(pagar.filter((i) => i.pago).map((i) => i.valor));
  const totalRecebido = somar(receber.filter((i) => i.pago).map((i) => i.valor));
  // Pagos primeiro e depois recebidos, ordenados por vencimento (ordem estável).
  const juntas: LinhaBaixada[] = [
    ...pagar.filter((i) => i.pago).map((item) => ({ tipo: "Pago" as const, item })),
    ...receber.filter((i) => i.pago).map((item) => ({ tipo: "Recebido" as const, item })),
  ];
  const todas = juntas
    .map((l, pos) => ({ l, pos }))
    .sort((a, b) => a.l.item.vencimento - b.l.item.vencimento || a.pos - b.pos)
    .map((x) => x.l);
  const p = periodoDoFiltro(dataEscolhida, hoje);
  return {
    totalPago,
    totalRecebido,
    saldo: totalRecebido - totalPago,
    tituloLista: dataEscolhida === null ? "BAIXAS DO MÊS ATUAL" : "BAIXAS DA DATA ESCOLHIDA",
    doPeriodo: todas.filter((l) => dentro(l.item.vencimento, p)),
    todas,
  };
}

export const VAZIO_BAIXAS_PERIODO = "Nenhuma baixa neste período";
export const VAZIO_BAIXAS_TODAS = "Nenhuma baixa registrada";

// ---------- Bolinhas do calendário de "Data escolhida" ----------

/** "aberto": o dia tem alguma conta em aberto; "pago": todas as contas do dia já foram baixadas. */
export type MarcaDia = "aberto" | "pago";

export function marcasPorDia(itens: ItemConta[]): Map<number, MarcaDia> {
  const marcas = new Map<number, MarcaDia>();
  for (const i of itens) {
    if (!i.vencimento) continue;
    if (!i.pago) marcas.set(i.vencimento, "aberto");
    else if (!marcas.has(i.vencimento)) marcas.set(i.vencimento, "pago");
  }
  return marcas;
}
