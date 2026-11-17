import type { DataISO } from "./tipos";

// Datas são tratadas como número serial do Excel (dias desde 30/12/1899),
// calculadas em UTC para não depender do fuso do aparelho.
const DIA_MS = 86_400_000;
const BASE_UTC = Date.UTC(1899, 11, 30);

export function isoParaSerial(iso: DataISO): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  return Math.round((Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) - BASE_UTC) / DIA_MS);
}

export function serialParaIso(serial: number): DataISO {
  const d = new Date(BASE_UTC + Math.floor(serial) * DIA_MS);
  const a = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

function partes(serial: number): [number, number, number] {
  const d = new Date(BASE_UTC + Math.floor(serial) * DIA_MS);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}

function serialDe(ano: number, mes0: number, dia: number): number {
  return Math.round((Date.UTC(ano, mes0, dia) - BASE_UTC) / DIA_MS);
}

/** DATE(ano; mês; dia), com mês de 1 a 12 (aceita estouro, como no Excel). */
export function date(ano: number, mes: number, dia: number): number {
  return serialDe(ano, mes - 1, dia);
}

export function ano(serial: number): number {
  return partes(serial)[0];
}

export function mes(serial: number): number {
  return partes(serial)[1] + 1;
}

/** EOMONTH(data; meses): último dia do mês, n meses depois. */
export function eomonth(serial: number, meses: number): number {
  const [a, m] = partes(serial);
  return serialDe(a, m + meses + 1, 0);
}

/** EDATE(data; meses): mesmo dia, n meses depois, limitado ao fim do mês. */
export function edate(serial: number, meses: number): number {
  const [a, m, d] = partes(serial);
  const ultimo = partes(serialDe(a, m + meses + 1, 0))[2];
  return serialDe(a, m + meses, Math.min(d, ultimo));
}

/** DATE(ANO(data); MÊS(data); 1). */
export function primeiroDiaDoMes(serial: number): number {
  const [a, m] = partes(serial);
  return serialDe(a, m, 1);
}

/** Data civil de hoje no fuso do aparelho. */
export function hojeDoAparelho(agora: Date = new Date()): DataISO {
  const a = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/** dd/mm/aaaa */
export function formatarData(serialOuIso: number | DataISO | null): string {
  if (serialOuIso === null || serialOuIso === "") return "";
  const iso = typeof serialOuIso === "number" ? serialParaIso(serialOuIso) : serialOuIso;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDoMes(serial: number): string {
  return MESES[mes(serial) - 1]!;
}

/** "nov/2026" */
export function formatarMesAno(serial: number): string {
  return `${nomeDoMes(serial).slice(0, 3)}/${ano(serial)}`;
}
