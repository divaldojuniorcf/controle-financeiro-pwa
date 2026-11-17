// Regras do agendador, sem dependência do Cloudflare (testáveis no Node).

/** Avisos atrasados mais que isto (servidor fora do ar, por exemplo) são descartados sem enviar. */
export const ATRASO_MAXIMO_MS = 6 * 3_600_000;
export const MAX_HORARIOS = 400;

/** Serviços de notificação aceitos: o servidor só envia para eles. */
const SERVICOS_PUSH = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

export interface Assinatura {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

export interface Dispositivo {
  /** SHA-256 (hex) do segredo do aparelho. */
  hash: string;
  assinatura: Assinatura;
  /** Horários (ms) dos próximos avisos. Nenhum nome, valor ou descrição. */
  horarios: number[];
}

export function separarVencidos(horarios: number[], agora: number): { enviar: boolean; restantes: number[] } {
  const vencidos = horarios.filter((t) => t <= agora);
  return {
    enviar: vencidos.some((t) => agora - t <= ATRASO_MAXIMO_MS),
    restantes: horarios.filter((t) => t > agora),
  };
}

export function validarHorarios(x: unknown): number[] | null {
  if (!Array.isArray(x) || x.length > MAX_HORARIOS) return null;
  if (!x.every((t) => typeof t === "number" && Number.isFinite(t) && t > 0)) return null;
  return [...new Set(x as number[])].sort((a, b) => a - b);
}

export function validarAssinatura(x: unknown): Assinatura | null {
  if (typeof x !== "object" || x === null) return null;
  const endpoint = (x as Assinatura).endpoint;
  if (typeof endpoint !== "string") return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !SERVICOS_PUSH.some((r) => r.test(url.hostname))) return null;
  return { endpoint };
}

export const ID_VALIDO = /^[0-9a-f-]{36}$/;
