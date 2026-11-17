// Números: somas, conversão para texto como o Excel faz e formatação pt-BR.

/**
 * Soma de valores em R$. Valores com até 2 casas decimais são somados em
 * centavos inteiros (sem erro de ponto flutuante). Valores calculados com
 * mais casas (rendimentos por juros compostos) entram como o Excel soma.
 */
export function somar(valores: Iterable<number | null | undefined>): number {
  let centavos = 0;
  let resto = 0;
  for (const v of valores) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const c = Math.round(v * 100);
    if (Math.abs(v * 100 - c) < 1e-6) centavos += c;
    else resto += v;
  }
  return centavos / 100 + resto;
}

/** Arredonda como o Excel: 15 dígitos significativos e meio para longe do zero. */
export function arredondar(x: number, casas: number): number {
  const v = Number(Math.abs(x).toPrecision(15));
  const f = 10 ** casas;
  const r = Math.round(Number((v * f).toPrecision(15))) / f;
  return x < 0 ? -r : r;
}

/**
 * Número convertido em texto como o Excel faz ao concatenar (&) em pt-BR:
 * até 15 dígitos significativos, sem zeros à direita, vírgula decimal.
 * Ex.: 712.50000000000034 → "712,5"; 89.999999999999943 → "89,9999999999999".
 */
export function textoExcel(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  return String(Number(x.toPrecision(15))).replace(".", ",");
}

/** FIXED(x; casas) do Excel em pt-BR: "1.234,56". */
export function fixo(x: number, casas: number): string {
  const r = arredondar(x, casas);
  const [int, dec] = Math.abs(r).toFixed(casas).split(".");
  const milhar = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (r < 0 ? "-" : "") + milhar + (casas > 0 ? "," + dec : "");
}

/** R$ 1.234,56 (negativos com sinal). */
export function moeda(x: number): string {
  const s = fixo(x, 2);
  return s.startsWith("-") ? `-R$ ${s.slice(1)}` : `R$ ${s}`;
}

/** Valor de card: zero aparece como "-". */
export function moedaCard(x: number): string {
  return arredondar(x, 2) === 0 ? "-" : moeda(x);
}

/** 0,9901 → "99,0%" */
export function percentual(x: number, casas = 1): string {
  return `${fixo(x * 100, casas)}%`;
}
