// Código de pagamento de uma conta: Pix "copia e cola" ou boleto (linha digitável / código de barras).

export type TipoCodigo = "pix" | "boleto" | "convenio" | "barras" | "outro";

export interface CodigoAnalisado {
  tipo: TipoCodigo;
  /** Texto que vai para a área de transferência (boleto: só os números). */
  paraCopiar: string;
  /** Descrição para a tela. */
  rotulo: string;
  /** Dígitos verificadores conferem (null = formato sem verificação). */
  valido: boolean | null;
}

const ROTULOS: Record<TipoCodigo, string> = {
  pix: "Pix copia e cola",
  boleto: "Linha digitável do boleto",
  convenio: "Linha digitável (contas de consumo e tributos)",
  barras: "Código de barras do boleto",
  outro: "Código (formato não reconhecido)",
};

/** CRC16/CCITT-FALSE usado no fim do Pix copia e cola (campo 63). */
export function crc16Pix(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function pixValido(c: string): boolean {
  const m = /6304([0-9A-Fa-f]{4})$/.exec(c);
  return !!m && crc16Pix(c.slice(0, -4)) === m[1]!.toUpperCase();
}

/** Módulo 10 dos campos da linha digitável. */
function modulo10(numeros: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numeros.length - 1; i >= 0; i--) {
    const p = Number(numeros[i]) * peso;
    soma += p > 9 ? p - 9 : p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** Confere os três campos da linha digitável bancária (47 dígitos). */
function linhaBancariaValida(d: string): boolean {
  const campos: [number, number][] = [[0, 9], [10, 20], [21, 31]];
  return campos.every(([ini, dv]) => modulo10(d.slice(ini, dv)) === Number(d[dv]));
}

export function analisarCodigo(codigo: string | undefined): CodigoAnalisado | null {
  const c = (codigo ?? "").trim();
  if (c === "") return null;
  if (/^000201/.test(c)) return { tipo: "pix", paraCopiar: c, rotulo: ROTULOS.pix, valido: pixValido(c) };
  const d = c.replace(/[\s.\-]/g, "");
  if (/^\d+$/.test(d)) {
    if (d.length === 47) return { tipo: "boleto", paraCopiar: d, rotulo: ROTULOS.boleto, valido: linhaBancariaValida(d) };
    if (d.length === 48) return { tipo: "convenio", paraCopiar: d, rotulo: ROTULOS.convenio, valido: null };
    if (d.length === 44) return { tipo: "barras", paraCopiar: d, rotulo: ROTULOS.barras, valido: null };
  }
  return { tipo: "outro", paraCopiar: c, rotulo: ROTULOS.outro, valido: null };
}
