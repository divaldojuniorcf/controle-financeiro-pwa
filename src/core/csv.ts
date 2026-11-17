// CSV no padrão do Excel em pt-BR: separador ";", vírgula decimal, datas dd/mm/aaaa, UTF-8 com BOM.
import type { Baixa, DataISO, Investimento, Lancamento, Parametros } from "./tipos";

const SEP = ";";
const BOM = "﻿";

export const CABECALHOS = {
  lancamentos: ["Data de entrada", "Vencimento", "Descrição", "Tipo", "Categoria", "Valor", "Recorrente", "Código de pagamento"],
  investimentos: ["Data do aporte", "Ativo", "Valor investido", "Rentabilidade a.a.", "Data de resgate"],
  baixas: ["Chave", "Tipo", "Descrição", "Vencimento", "Valor", "Data da baixa", "Observação"],
  parametros: ["Parâmetro", "Valor"],
} as const;

export type TabelaCsv = keyof typeof CABECALHOS;

// ---------- escrita ----------

function campo(v: string): string {
  return /[";\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
const dataCsv = (iso: DataISO | null) => (iso ? iso.split("-").reverse().join("/") : "");
const numCsv = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
/** Texto que o Excel não converte em número (códigos longos com zeros à esquerda). */
const textoProtegido = (s: string | undefined) => (s ? `="${s.replace(/"/g, "\"\"")}"` : "");
const lerTextoProtegido = (s: string) => s.trim().replace(/^="(.*)"$/s, "$1").replace(/""/g, "\"").trim();

function montarCsv(linhas: string[][]): string {
  return BOM + linhas.map((l) => l.map(campo).join(SEP)).join("\r\n") + "\r\n";
}

export function lancamentosParaCsv(ls: Lancamento[]): string {
  return montarCsv([
    [...CABECALHOS.lancamentos],
    ...ls.map((l) => [dataCsv(l.dataEntrada), dataCsv(l.vencimento), l.descricao, l.tipo, l.categoria, numCsv(l.valor), l.recorrente, textoProtegido(l.codigoPagamento)]),
  ]);
}

export function investimentosParaCsv(is: Investimento[]): string {
  return montarCsv([
    [...CABECALHOS.investimentos],
    ...is.map((i) => [dataCsv(i.dataAporte), i.ativo, numCsv(i.valorInvestido), numCsv(i.rentabilidadeAA), dataCsv(i.dataResgate)]),
  ]);
}

export function baixasParaCsv(bs: Baixa[]): string {
  return montarCsv([
    [...CABECALHOS.baixas],
    ...bs.map((b) => [b.chave, b.tipo, b.descricao, dataCsv(b.vencimento), numCsv(b.valor), dataCsv(b.dataBaixa), b.observacao]),
  ]);
}

const P = {
  hoje: "Data de hoje (vazio = data atual)",
  limite: "Limite de comprometimento da renda",
  dias: "Dias da projeção de rendimentos",
  meses: "Meses futuros gerados para contas recorrentes",
  catS: "Categoria de saída",
  catE: "Categoria de entrada",
};

export function parametrosParaCsv(p: Parametros): string {
  return montarCsv([
    [...CABECALHOS.parametros],
    [P.hoje, dataCsv(p.hojeFixo)],
    [P.limite, numCsv(p.limiteComprometimento)],
    [P.dias, numCsv(p.diasProjecao)],
    [P.meses, numCsv(p.mesesRecorrencia)],
    ...p.categoriasSaida.map((c) => [P.catS, c]),
    ...p.categoriasEntrada.map((c) => [P.catE, c]),
  ]);
}

// ---------- leitura ----------

/** Lê CSV com aspas (RFC 4180) separado por ";" ou ",". */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = primeira.includes(";") ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { atual += '"'; i++; }
      else if (ch === '"') aspas = false;
      else atual += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(atual); atual = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      linha.push(atual); atual = "";
      if (linha.some((c) => c !== "")) linhas.push(linha);
      linha = [];
    } else atual += ch;
  }
  linha.push(atual);
  if (linha.some((c) => c !== "")) linhas.push(linha);
  return linhas;
}

function lerData(s: string, onde: string): DataISO | null {
  const v = s.trim();
  if (v === "") return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  throw new Error(`${onde}: data inválida "${v}" (use dd/mm/aaaa).`);
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export function lerNumero(s: string, onde: string): number | null {
  let v = s.trim().replace(/^R\$\s*/, "");
  if (v === "") return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${onde}: número inválido "${s}".`);
  return n;
}

/** Descobre a tabela pelo cabeçalho. */
export function identificarTabela(linhas: string[][]): TabelaCsv {
  const cab = (linhas[0] ?? []).map((c) => c.trim()).join("|");
  for (const [nome, cols] of Object.entries(CABECALHOS)) {
    if (cab === cols.join("|")) return nome as TabelaCsv;
  }
  // CSV de Lançamentos exportado antes do campo "Código de pagamento".
  if (cab === CABECALHOS.lancamentos.slice(0, 7).join("|")) return "lancamentos";
  throw new Error("Cabeçalho do CSV não reconhecido. Use um arquivo exportado pelo app.");
}

export type ResultadoCsv =
  | { tabela: "lancamentos"; dados: Omit<Lancamento, "id">[] }
  | { tabela: "investimentos"; dados: Omit<Investimento, "id">[] }
  | { tabela: "baixas"; dados: Baixa[] }
  | { tabela: "parametros"; dados: Parametros };

export function importarCsv(texto: string): ResultadoCsv {
  const linhas = lerCsv(texto);
  const tabela = identificarTabela(linhas);
  const corpo = linhas.slice(1);
  const c = (l: string[], i: number) => l[i] ?? "";
  switch (tabela) {
    case "lancamentos":
      return {
        tabela,
        dados: corpo.map((l, i) => {
          const o = `Linha ${i + 2}`;
          const codigo = lerTextoProtegido(c(l, 7));
          return {
            dataEntrada: lerData(c(l, 0), o), vencimento: lerData(c(l, 1), o), descricao: c(l, 2),
            tipo: c(l, 3), categoria: c(l, 4), valor: lerNumero(c(l, 5), o), recorrente: c(l, 6),
            ...(codigo ? { codigoPagamento: codigo } : {}),
          };
        }),
      };
    case "investimentos":
      return {
        tabela,
        dados: corpo.map((l, i) => {
          const o = `Linha ${i + 2}`;
          return {
            dataAporte: lerData(c(l, 0), o), ativo: c(l, 1), valorInvestido: lerNumero(c(l, 2), o),
            rentabilidadeAA: lerNumero(c(l, 3), o), dataResgate: lerData(c(l, 4), o),
          };
        }),
      };
    case "baixas":
      return {
        tabela,
        dados: corpo.map((l, i) => {
          const o = `Linha ${i + 2}`;
          const tipo = c(l, 1);
          if (tipo !== "Pagar" && tipo !== "Receber") throw new Error(`${o}: Tipo deve ser Pagar ou Receber.`);
          return {
            chave: c(l, 0), tipo, descricao: c(l, 2), vencimento: lerData(c(l, 3), o),
            valor: lerNumero(c(l, 4), o), dataBaixa: lerData(c(l, 5), o) ?? "", observacao: c(l, 6),
          };
        }),
      };
    case "parametros": {
      const valor = (nome: string) => corpo.find((l) => c(l, 0) === nome)?.[1] ?? "";
      const lista = (nome: string) => corpo.filter((l) => c(l, 0) === nome).map((l) => c(l, 1));
      return {
        tabela,
        dados: {
          hojeFixo: lerData(valor(P.hoje), P.hoje),
          limiteComprometimento: lerNumero(valor(P.limite), P.limite) ?? 0.9,
          diasProjecao: lerNumero(valor(P.dias), P.dias) ?? 365,
          mesesRecorrencia: lerNumero(valor(P.meses), P.meses),
          categoriasSaida: lista(P.catS),
          categoriasEntrada: lista(P.catE),
        },
      };
    }
  }
}
