// Onde o app está rodando: aberto pelo ícone da Tela de Início ou dentro do navegador.

/** iPhone ou iPad (o iPad recente se apresenta como Mac com toque). */
export function ehIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Aberto pelo ícone (modo app), e não numa aba do navegador. */
export function emModoApp(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Acha o código num texto colado (só o código ou a mensagem inteira do convite).
 * Procura o formato XXXXX-XXXXX com as letras e números usados nos convites (sem 0, 1, I e O),
 * para não confundir com palavras da mensagem como "FINANCEIRO".
 */
export function codigoNoTexto(texto: string): string {
  const comHifen = /(?:^|[^A-Z0-9])([A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5})(?![A-Z0-9])/.exec(texto.toUpperCase());
  if (comHifen) return comHifen[1]!;
  const so = texto.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-HJ-NP-Z2-9]{10}$/.test(so) ? `${so.slice(0, 5)}-${so.slice(5)}` : texto.trim();
}

/** Convite vindo no link (?convite=ABCDE-FGH23), já normalizado; "" se não houver. */
export function conviteDoLink(): string {
  const c = (new URLSearchParams(location.search).get("convite") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : "";
}
